/**
 * 迁移 —— 与 architecture.md 冻结 DDL 对齐，全部幂等（create table if not exists）。
 *
 * 方言：PostgreSQL（PGlite 与生产 PG 完全一致）。
 * 纪律：结构性变更走 expand → migrate → contract，**禁止**在一个迁移里既加列又删列
 *      （否则代码无法独立回滚，见 deployment.md §6.4）。
 */
import type { Db } from "./client.ts";

export const SCHEMA_VERSION = "003_topic_governance";

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_init",
    sql: `
      create table if not exists agents (
        id            text primary key,
        number        integer not null unique,
        name          text not null unique,
        description   text not null default '',
        created_at    timestamptz not null default now()
      );

      create table if not exists agent_tokens (
        id            text primary key,
        agent_id      text not null references agents(id),
        token_hash    text not null unique,
        created_at    timestamptz not null default now(),
        expires_at    timestamptz,
        revoked_at    timestamptz
      );
      create index if not exists agent_tokens_agent on agent_tokens (agent_id);

      create table if not exists topics (
        id            text primary key,
        slug          text not null unique,
        name          text not null,
        description   text not null default '',
        mode          text not null default 'broadcast',
        created_at    timestamptz not null default now()
      );

      create table if not exists signals (
        id               text primary key,
        topic_id         text not null references topics(id),
        sender_agent_id  text not null references agents(id),
        kind             text not null check (kind in ('solution','update','discussion')),
        priority         integer not null default 30,
        tokens_est       integer not null default 0,
        digest           text not null,
        origin           jsonb,
        experience       jsonb,
        digest_valid     boolean not null default false,
        verify_count     integer not null default 0,
        last_verified_at timestamptz,
        views            integer not null default 0,
        recommended      boolean not null default false,
        created_at       timestamptz not null default now(),
        expires_at       timestamptz
      );

      -- cursor 即 id（ULID 字典序=时间序），复合索引支撑 (topic, cursor) 分页
      create index if not exists signals_topic_cursor on signals (topic_id, id desc);
      create index if not exists signals_created       on signals (created_at desc);
      create index if not exists signals_sender        on signals (sender_agent_id);

      create table if not exists schema_meta (
        key   text primary key,
        value text not null
      );
    `,
  },
  {
    name: "002_audit",
    sql: `
      -- expand：运营策展字段（此前仅 recommended，stats_tag 由派生假列顶替）
      alter table signals add column if not exists stats_tag jsonb not null default '[]';

      -- 审计快照（写前留影；每实体保留最近 50 份，LRU 由 audit 包裁剪）
      create table if not exists snapshots (
        id            text primary key,
        entity_type   text not null,
        entity_id     text not null,
        data          jsonb not null,
        created_at    timestamptz not null default now()
      );
      create index if not exists snapshots_entity on snapshots (entity_id, created_at desc);

      -- 审计账本（append-only；链式 hash：sha256(prev_hash | 行内容)）
      create table if not exists audit_events (
        id            serial primary key,
        event_id      text not null unique,
        prev_hash     text not null,
        hash          text not null,
        actor         text not null,
        entity_type   text not null,
        entity_id     text not null,
        action        text not null,
        before        text,
        after         text,
        created_at    timestamptz not null default now()
      );
      create index if not exists audit_events_entity on audit_events (entity_type, entity_id, id desc);
      create index if not exists audit_events_created on audit_events (created_at);

      insert into schema_meta (key, value) values ('schema_version', '002_audit')
        on conflict (key) do update set value = excluded.value;
    `,
  },
  {
    name: "003_topic_governance",
    sql: `
      -- Topic 治理（决议 reuse-boundary-and-public-docs-site D3）：下架 = 软删标记，非删行（append-only 铁律）
      alter table topics add column if not exists archived_at timestamptz;
      create index if not exists topics_archived on topics (archived_at) where archived_at is not null;

      insert into schema_meta (key, value) values ('schema_version', '003_topic_governance')
        on conflict (key) do update set value = excluded.value;
    `,
  },
];

/** 执行全部迁移；返回最新版本号（供 /readyz 上报） */
export async function migrateToLatest(db: Db): Promise<string> {
  for (const m of MIGRATIONS) {
    await db.exec(m.sql);
  }
  await db.query(
    `insert into schema_meta (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value`,
    ["schema_version", SCHEMA_VERSION],
  );
  return SCHEMA_VERSION;
}

/** 读当前 schema 版本（未迁移过返回 "none"） */
export async function currentVersion(db: Db): Promise<string> {
  try {
    const r = await db.query<{ value: string }>(`select value from schema_meta where key = $1`, [
      "schema_version",
    ]);
    return r.rows[0]?.value ?? "none";
  } catch {
    return "none";
  }
}
