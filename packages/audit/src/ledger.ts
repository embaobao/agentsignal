/**
 * 审计账本 —— append-only 事件链（PG 表 audit_events），audit-restore Phase 1B-1。
 *
 * 口径（按 standardize-node-postgres 决议修订）：账本落 Postgres，非 JSON Lines 文件。
 * 链式 hash：hash = sha256(`prev_hash|event_id|actor|entity_type|entity_id|action|before|after`)。
 * 坏链 = 存储哈希与重算不符（verify 返回 broken_at）。
 *
 * 快照（snapshots 表）：写前留影 before-image；每实体保留最近 50 份，写入后裁剪。
 */
import { createHash } from "node:crypto";
import { prefixed } from "@agentssignal/protocol";

/** 结构化最小接口：apps/api 的 Db（pg）与测试夹具均天然满足 */
export interface SqlDb {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[] }>;
}

export type EntityType = "signal" | "agent" | "token";
export type AuditAction = "create" | "update";

export interface AuditEventInput {
  actor: string; // agt_<ulid> | admin:<user> | system
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
}

export interface AuditEventRow {
  id: number;
  event_id: string;
  prev_hash: string;
  hash: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before: unknown;
  after: unknown;
  created_at: string | Date;
}

const GENESIS = "GENESIS";

function canonical(
  prevHash: string,
  eventId: string,
  input: AuditEventInput,
  beforeText: string,
  afterText: string,
): string {
  return [
    prevHash,
    eventId,
    input.actor,
    input.entityType,
    input.entityId,
    input.action,
    beforeText,
    afterText,
  ].join("|");
}

/** jsonb 列改 text 后：PG 原样返回写入串，verify 可字节级复算 */
function storedText(v: unknown): string {
  if (v === null || v === undefined) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}

export function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** 追加一条审计事件：取上一条 hash 为 prev，链式落库（同 Db，同事务语义由调用方保证） */
export async function appendEvent(db: SqlDb, input: AuditEventInput): Promise<AuditEventRow> {
  const last = await db.query<{ hash: string }>(
    `select hash from audit_events order by id desc limit 1`,
  );
  const prevHash = last.rows[0]?.hash ?? GENESIS;
  const eventId = prefixed("evt");
  const beforeText = JSON.stringify(input.before ?? null);
  const afterText = JSON.stringify(input.after ?? null);
  const hash = sha256(canonical(prevHash, eventId, input, beforeText, afterText));
  const r = await db.query<AuditEventRow>(
    `insert into audit_events
       (event_id, prev_hash, hash, actor, entity_type, entity_id, action, before, after)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      eventId,
      prevHash,
      hash,
      input.actor,
      input.entityType,
      input.entityId,
      input.action,
      input.before === undefined ? null : beforeText,
      input.after === undefined ? null : afterText,
    ],
  );
  const row = r.rows[0];
  if (!row) throw new Error("audit_events insert 未返回行");
  return row;
}

/** 写前快照：留 before-image，并裁剪该实体仅保留最近 50 份 */
export async function snapshotBefore(
  db: SqlDb,
  entityType: EntityType,
  entityId: string,
  data: unknown,
): Promise<void> {
  if (data === undefined || data === null) return;
  await db.query(`insert into snapshots (id, entity_type, entity_id, data) values ($1,$2,$3,$4)`, [
    prefixed("snap"),
    entityType,
    entityId,
    JSON.stringify(data),
  ]);
  await db.query(
    `delete from snapshots
      where entity_id = $1
        and id not in (
          select id from snapshots where entity_id = $1
          order by created_at desc, id desc limit 50
        )`,
    [entityId],
  );
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  broken_at: string | null; // 首个坏链 event_id
}

/** 全链重算（可选按日过滤 created_at::date）——返回首坏位置 */
export async function verifyChain(db: SqlDb, day?: string): Promise<VerifyResult> {
  const r = await db.query<AuditEventRow>(
    `select * from audit_events
      where ($1::text is null or created_at::date = $1::date)
      order by id asc`,
    [day ?? null],
  );
  let prev = GENESIS;
  for (const row of r.rows) {
    const input: AuditEventInput = {
      actor: row.actor,
      entityType: row.entity_type as EntityType,
      entityId: row.entity_id,
      action: row.action as AuditAction,
    };
    const expect = sha256(
      canonical(prev, row.event_id, input, storedText(row.before), storedText(row.after)),
    );
    if (expect !== row.hash || row.prev_hash !== prev) {
      return { ok: false, checked: r.rows.length, broken_at: row.event_id };
    }
    prev = row.hash;
  }
  return { ok: true, checked: r.rows.length, broken_at: null };
}
