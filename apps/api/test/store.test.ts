/**
 * 单测：PgStore 存储关键路径（backend-architecture §十一：storage）。
 * token 哈希口径 / 滑动软 TTL / newest+verified 双游标分页 / 编号自增。
 * 存储走测试夹具（真 PG 临时库或内嵌真 Postgres），跑完即弃。
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { Db } from "../src/db/client.ts";
import { PgStore } from "../src/store/store.ts";
import { createTestDb } from "./helpers/testdb.ts";

process.env.LOG_LEVEL = "silent";

const GOOD_DIGEST = "语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested";
const exp = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
/** timestamptz 经驱动可能是 Date 或 ISO 字符串，统一取毫秒 */
const ms = (v: unknown): number => (v instanceof Date ? v.getTime() : Date.parse(String(v)));

let store: PgStore;
let db: Db;
let disposeDb: () => Promise<void>;

/** 类型化查询助手（避免 any；tsc strict 兼容） */
const rows = async <T>(sql: string, params?: unknown[]): Promise<T[]> =>
  (await db.query<T>(sql, params)).rows;

before(async () => {
  const t = await createTestDb();
  db = t.db;
  disposeDb = t.dispose;
  store = new PgStore(db);
  await store.init();
});
after(async () => {
  await disposeDb();
});

describe("身份与 token", () => {
  test("编号自增 1、2；名字缺省 agent-<number>", async () => {
    const a1 = await store.registerAgent("", "", "AGS_LOWER_CASE_PROBE_1");
    const a2 = await store.registerAgent("", "", "ags_lower_case_probe_2");
    assert.equal(a1.agent.number, 1);
    assert.equal(a2.agent.number, 2);
    assert.equal(a1.agent.name, "agent-1");
  });

  test("token 哈希按 tolower 口径：大小写不同形式都能命中（spec §2）", async () => {
    const hit = await store.agentForToken("ags_LOWER_case_probe_1");
    assert.ok(hit, "注册大写、鉴权混合大小写应命中同一哈希");
    assert.equal(hit?.number, 1);
    const miss = await store.agentForToken("ags_no_such_token");
    assert.equal(miss, undefined);
  });

  test("软 TTL 滑动：成功鉴权后 expires_at 被续期（last_used + 90d）", async () => {
    const { agent } = await store.registerAgent("ttl-probe", "", "ags_ttl_probe_token");
    const before = await rows<{ expires_at: string | Date }>(
      `select expires_at from agent_tokens where agent_id = $1`,
      [agent.id],
    );
    await new Promise((r) => setTimeout(r, 20));
    const used = await store.agentForToken("ags_ttl_probe_token");
    assert.ok(used);
    const afterUsed = await rows<{ expires_at: string | Date }>(
      `select expires_at from agent_tokens where agent_id = $1`,
      [agent.id],
    );
    const r0 = before[0];
    const r1 = afterUsed[0];
    if (!r0 || !r1) throw new Error("agent_tokens 行应存在");
    const t0 = ms(r0.expires_at);
    const t1 = ms(r1.expires_at);
    assert.ok(Number.isFinite(t0) && Number.isFinite(t1), "expires_at 应为可解析时间");
    assert.ok(t1 > t0, `续期后 expires_at 应更大（${t0} → ${t1}）`);
  });

  test("过期 token 拒绝且不续期", async () => {
    const { agent } = await store.registerAgent("expired-probe", "", "ags_expired_probe_token");
    await rows<unknown>(`update agent_tokens set expires_at = $1 where agent_id = $2`, [
      exp(-1),
      agent.id,
    ]);
    const hit = await store.agentForToken("ags_expired_probe_token");
    assert.equal(hit, undefined);
  });

  test("按编号与 id 都能查到身份", async () => {
    const byNumber = await store.agentByIdOrNumber("1");
    if (!byNumber) throw new Error("编号 1 应存在");
    const byId = await store.agentByIdOrNumber(byNumber.id);
    assert.equal(byId?.number, 1);
    assert.equal(await store.agentByIdOrNumber("999999"), undefined);
  });
});

describe("信号存储与双游标分页", () => {
  const ids: string[] = [];

  before(async () => {
    const { agent } = await store.registerAgent("publisher", "", "ags_publisher_token");
    await store.ensureTopic("ai-research");
    for (const [i, tokens] of [100, 200, 300].entries()) {
      const row = await store.putSignal({
        topic: "ai-research",
        kind: "solution",
        digest: `第 ${i} 条 ${GOOD_DIGEST}`,
        priority: 30,
        tokens_est: tokens,
        digest_valid: true,
        sender_agent_id: agent.id,
      });
      ids.push(row.id);
    }
    // B(ids[1]) 验证 2 次、A(ids[0]) 1 次、C 不验证 → verified 期望顺序 B, A, C
    const [idA, idB] = [ids[0], ids[1]];
    if (!idA || !idB) throw new Error("夹具信号缺失");
    await store.bumpVerify(idB);
    await store.bumpVerify(idB);
    await store.bumpVerify(idA);
  });

  test("newest 游标：id 游标翻页不重复", async () => {
    const page1 = await store.listSignals({ topic: "ai-research", limit: 1, sort: "newest" });
    const first = page1[0];
    if (!first) throw new Error("第一页应为 1 条");
    const page2 = await store.listSignals({
      topic: "ai-research",
      limit: 10,
      cursor: first.id,
      sort: "newest",
    });
    assert.ok(page2.every((r) => r.id !== first.id));
    assert.equal(page1.length + page2.length, 3);
  });

  test("verified 复合游标：按 (verify_count,id) 翻页不跳号不重复", async () => {
    const [idA, idB] = [ids[0], ids[1]];
    if (!idA || !idB) throw new Error("夹具信号缺失");
    const page1 = await store.listSignals({ topic: "ai-research", limit: 1, sort: "verified" });
    const p1 = page1[0];
    if (!p1) throw new Error("verified 第一页应为 1 条");
    assert.equal(p1.id, idB, "验证数最高的 B 应排第一");
    const page2 = await store.listSignals({
      topic: "ai-research",
      limit: 1,
      sort: "verified",
      cursor: `${p1.verify_count}:${p1.id}`,
    });
    const p2 = page2[0];
    if (!p2) throw new Error("verified 第二页应为 1 条");
    assert.equal(p2.id, idA, "第二应是验证 1 次的 A");
    const page3 = await store.listSignals({
      topic: "ai-research",
      limit: 10,
      sort: "verified",
      cursor: `${p2.verify_count}:${p2.id}`,
    });
    const seen = [p1.id, p2.id, ...page3.map((r) => r.id)];
    assert.equal(new Set(seen).size, 3, "三页合计恰为 3 条且互不重复");
    assert.equal(page3[0]?.verify_count, 0, "最后是未验证的 C");
  });

  test("verified 模式传非法游标直接报错", async () => {
    await assert.rejects(
      store.listSignals({ topic: "ai-research", limit: 5, sort: "verified", cursor: "sig_bogus" }),
    );
  });

  test("关键词命中 digest；frontpageStats 真实计数", async () => {
    const hit = await store.listSignals({
      topic: "ai-research",
      limit: 10,
      q: "第 1 条",
      sort: "newest",
    });
    assert.equal(hit.length, 1);
    const stats = await store.frontpageStats();
    assert.ok(stats.signals >= 3);
    assert.ok(stats.agents >= 1);
  });
});
