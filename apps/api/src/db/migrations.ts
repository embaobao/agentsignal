/**
 * 迁移 —— 与 architecture.md 冻结 DDL 对齐，全部幂等（create table if not exists）。
 *
 * 方言：PostgreSQL（PGlite 与生产 PG 完全一致）。
 * 纪律：结构性变更走 expand → migrate → contract，**禁止**在一个迁移里既加列又删列
 *      （否则代码无法独立回滚，见 deployment.md §6.4）。
 */
import type { Db } from "./client.ts";

export const SCHEMA_VERSION = "001_init";

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
