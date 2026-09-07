/**
 * 迁移 —— 与 architecture.md 冻结 DDL 对齐，全部幂等（create table if not exists）。
 *
 * 方言：PostgreSQL（PGlite 与生产 PG 完全一致）。
 * 纪律：结构性变更走 expand → migrate → contract，**禁止**在一个迁移里既加列又删列
 *      （否则代码无法独立回滚，见 deployment.md §6.4）。
 */
import type { Db } from "./client.ts";

export const SCHEMA_VERSION = "007_auth";

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
  {
    name: "004_ux",
    sql: `
      -- 软删（用户可隐藏自己的信号）
      alter table signals add column if not exists deleted_at timestamptz;
      -- GitHub OAuth 绑定
      alter table agents add column if not exists github_id text unique;

      insert into schema_meta (key, value) values ('schema_version', '004_ux')
        on conflict (key) do update set value = excluded.value;
    `,
  },
  {
    name: "005_feedback",
    sql: `
      -- 结构化反馈（每 agent 对每 signal 只能验一次）
      create table if not exists verify_logs (
        id            text primary key,
        signal_id     text not null references signals(id),
        agent_id      text not null references agents(id),
        verdict       text not null check (verdict in ('worked','partial','failed')),
        created_at    timestamptz not null default now(),
        unique (signal_id, agent_id)
      );
      create index if not exists verify_logs_signal on verify_logs (signal_id, verdict);

      insert into schema_meta (key, value) values ('schema_version', '005_feedback')
        on conflict (key) do update set value = excluded.value;
    `,
  },
  {
    name: "006_verify_actor",
    sql: `
      -- verify_logs.agent_id 语义放宽为 actor（admin Basic 代验时为 admin:<user>，非 agents.id）
      -- 原 FK 会让 admin 代验插入即 500（user-domain-completion Phase 0.7）；expand-only，幂等
      alter table verify_logs drop constraint if exists verify_logs_agent_id_fkey;

      insert into schema_meta (key, value) values ('schema_version', '006_verify_actor')
        on conflict (key) do update set value = excluded.value;
    `,
  },
  {
    name: "007_auth",
    sql: `
      -- better-auth 四表（官方 PG 方言默认 schema，单数表名；user-domain-completion Phase 1.1）
      -- session↔agents 桥接靠 account(provider_id='github').account_id = agents.github_id，不加 FK
      create table if not exists "user" (
        id              text primary key,
        name            text not null,
        email           text not null unique,
        "email_verified" boolean not null default false,
        image           text,
        created_at      timestamptz not null default now(),
        updated_at      timestamptz not null default now()
      );

      create table if not exists "session" (
        id              text primary key,
        expires_at      timestamptz not null,
        token           text not null unique,
        created_at      timestamptz not null default now(),
        updated_at      timestamptz not null default now(),
        ip_address      text,
        user_agent      text,
        user_id         text not null references "user"(id)
      );
      create index if not exists "session_user" on "session" (user_id);

      create table if not exists "account" (
        id                       text primary key,
        account_id               text not null,
        provider_id              text not null,
        user_id                  text not null references "user"(id),
        access_token             text,
        refresh_token            text,
        id_token                 text,
        access_token_expires_at  timestamptz,
        refresh_token_expires_at timestamptz,
        scope                    text,
        password                 text,
        created_at               timestamptz not null default now(),
        updated_at               timestamptz not null default now()
      );
      create index if not exists account_user on "account" (user_id);
      create index if not exists account_provider on "account" (provider_id, account_id);

      create table if not exists "verification" (
        id              text primary key,
        identifier      text not null,
        value           text not null,
        expires_at      timestamptz not null,
        created_at      timestamptz not null default now(),
        updated_at      timestamptz not null default now()
      );

      insert into schema_meta (key, value) values ('schema_version', '007_auth')
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
