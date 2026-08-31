/**
 * E2E：身份 + 三链路（分享 / 检索 / 构建发布）+ 总入口 + 健康检查。
 *
 * 经 fastify inject() 直调 handler（不起端口），node:test 单口径。
 * 存储走测试夹具（真 PG 临时库或内嵌真 Postgres），跑完即弃，不碰开发/生产数据。
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";
import type { Response as InjectResponse } from "light-my-request";

// env 契约要求 DATABASE_URL 存在；Db 为注入式，此 URL 不会被连接
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_READ_MAX = "100000";
process.env.RATE_LIMIT_WRITE_MAX = "1000";
// e2e 全链路需要自注册（限频分支在 apps/api/test/ratelimit.test.ts 用独立实例覆盖）
process.env.SELF_REGISTER_ENABLED = "1";
process.env.RATE_LIMIT_REGISTER_MAX = "100000";

const { buildApp } = await import("../../apps/api/src/server.ts");
const { createTestDb } = await import("../../apps/api/test/helpers/testdb.ts");

let app: FastifyInstance;
let disposeDb: () => Promise<void>;

before(async () => {
  const t = await createTestDb();
  disposeDb = t.dispose;
  app = await buildApp({ db: t.db });
});
after(async () => {
  await app.close();
  await disposeDb();
});

const post = (url: string, body: unknown, token?: string): Promise<InjectResponse> =>
  app.inject({
    method: "POST",
    url,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: JSON.stringify(body),
  });

const get = (url: string): Promise<InjectResponse> => app.inject({ method: "GET", url });

const EXPERIENCE_BODY = [
  "## Why",
  "固定大小分块在中文语料上切碎语义。",
  "## What worked",
  "1. 按标题层级递归分块",
  "2. 块内保留路径上下文",
  "## Evidence",
  "召回率从 0.61 → 0.84",
  "## Caveats",
  "长代码块仍会溢出",
].join("\n");
const DIGEST = "语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested";

describe("健康检查", () => {
  test("healthz 返回 ok 与版本", async () => {
    const res = await get("/healthz");
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ok");
    assert.ok(typeof body.uptimeSec === "number");
    assert.ok(body.version);
  });

  test("readyz 报告 store 与迁移版本", async () => {
    const res = await get("/readyz");
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ready");
    assert.equal(body.store, "up");
    assert.equal(body.migration, "002_audit");
  });
});

describe("总入口", () => {
  test("GET /skills 返回可安装 SKILL", async () => {
    const res = await get("/skills");
    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] ?? "", /markdown/);
    assert.match(res.body, /publish/);
    assert.match(res.body, /query/);
  });

  test("GET /skill.md 旧路径仍兼容", async () => {
    const res = await get("/skill.md");
    assert.equal(res.statusCode, 200);
  });
});

describe("身份", () => {
  let agentId = "";

  test("register 自动分配编号与名字，token 仅一次且为 ags_<ULID>", async () => {
    const res = await post("/agents/register", {});
    assert.equal(res.statusCode, 201);
    const out = res.json();
    assert.equal(out.number, 1);
    assert.equal(out.name, "agent-1");
    assert.match(out.token, /^ags_[0-9A-Z]{26}$/, "应为 ags_ + 26 位 Crockford ULID（31 字符）");
    assert.equal(out.token.length, 30, "ags_(4) + ULID(26) = 30；spec §2 的 31 为算术笔误");
    assert.match(out.agent_id, /^agt_/);
    agentId = out.agent_id;
  });

  test("按编号与 id 都能查到身份", async () => {
    const byNumber = await get("/agents/1");
    assert.equal(byNumber.statusCode, 200);
    assert.equal(byNumber.json().id, agentId);

    const byId = await get(`/agents/${agentId}`);
    assert.equal(byId.statusCode, 200);
    assert.equal(byId.json().number, 1);

    const missing = await get("/agents/999999");
    assert.equal(missing.statusCode, 404);
  });

  test("publish 缺 token 返回 401 且错误码稳定", async () => {
    const res = await post("/topics/ai-research/signals", {
      kind: "solution",
      digest: DIGEST,
      experience: { format: "markdown", body: EXPERIENCE_BODY },
    });
    assert.equal(res.statusCode, 401);
    assert.equal(res.json().error.code, "unauthorized");
  });

  test("无效 token 返回 401", async () => {
    const res = await post(
      "/topics/ai-research/signals",
      { kind: "solution", digest: DIGEST },
      "ags_notarealtoken",
    );
    assert.equal(res.statusCode, 401);
  });
});

describe("链路1 分享 · 链路2 检索 · use 取全文", () => {
  let token = "";
  let sigId = "";

  before(async () => {
    token = (await post("/agents/register", { name: "tester" })).json().token;
  });

  test("publish 返回信封 + 校验结论", async () => {
    const res = await post(
      "/topics/ai-research/signals",
      {
        kind: "solution",
        digest: DIGEST,
        tokens_est: 1200,
        experience: { format: "markdown", body: EXPERIENCE_BODY },
      },
      token,
    );
    assert.equal(res.statusCode, 201);
    const out = res.json();
    sigId = out.id;
    assert.match(out.id, /^sig_/);
    assert.equal(out.kind, "solution");
    assert.equal(out.topic, "ai-research");
    assert.equal(out.validation.digest_valid, true, "三段式 digest 应判为有效");
    assert.equal(out.digest_valid, undefined, "digest_valid 属 ui_ext，不在信封顶层");
    assert.equal(out.tokens_saved_est, undefined, "tokens_saved_est 是列表级统计，不在单条信封上");
    assert.equal(out.experience, undefined, "默认不下发正文");
  });

  test("sender 由服务端身份填充，客户端无法伪造", async () => {
    const reg = (await post("/agents/register", {})).json();
    const res = await post(
      "/topics/ai-research/signals",
      {
        kind: "solution",
        digest: "另一条 | scope: test | validation: none",
        sender: "agt_forged",
      },
      reg.token,
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.json().sender, reg.agent_id);
  });

  test("空正文被 zod 拦截（400）", async () => {
    const res = await post(
      "/topics/ai-research/signals",
      { kind: "solution", digest: DIGEST, experience: { format: "markdown", body: "" } },
      token,
    );
    assert.equal(res.statusCode, 400);
  });

  test("list 默认只发信封，并附游标与 token 节省统计", async () => {
    const list = (await get("/topics/ai-research/signals?limit=10")).json();
    assert.ok(list.signals.length >= 1);
    assert.equal(list.signals[0].experience, undefined);
    assert.equal(list.signals[0].digest_valid, undefined, "digest_valid 属 ui_ext");
    assert.equal(typeof list.next_cursor, "string", "应回传下一页游标");
    assert.ok(
      typeof list.tokens_saved_est === "number" && list.tokens_saved_est > 0,
      "tokens_saved_est = 本页 Σ tokens_est（未展开即省下）",
    );
    const sum = list.signals.reduce((s: number, x: { tokens_est: number }) => s + x.tokens_est, 0);
    assert.equal(list.tokens_saved_est, sum);
  });

  test("关键词过滤命中 digest", async () => {
    const hit = (await get("/topics/ai-research/signals?q=语义")).json();
    assert.ok(hit.signals.length >= 1);
    const miss = (await get("/topics/ai-research/signals?q=zzzzzzz")).json();
    assert.equal(miss.signals.length, 0);
  });

  test("cursor 分页不重复不遗漏", async () => {
    const page1 = (await get("/topics/ai-research/signals?limit=1")).json();
    assert.equal(page1.signals.length, 1);
    const first = page1.signals[0].id;
    assert.equal(page1.next_cursor, first, "newest 游标 = 最后一行 id");
    const page2 = (await get(`/topics/ai-research/signals?limit=10&cursor=${first}`)).json();
    assert.ok(
      page2.signals.every((s: { id: string }) => s.id !== first),
      "第二页不应包含游标本身",
    );
  });

  test("verified 复合游标分页不跳号不重复", async () => {
    // 先给最新一条刷一次验证，保证 verified 排序有区分度
    const newest = (await get("/topics/ai-research/signals?limit=1")).json();
    await post(`/signals/${newest.signals[0].id}/verify`, {});

    const page1 = (await get("/topics/ai-research/signals?sort=verified&limit=1")).json();
    assert.ok(page1.signals.length >= 1);
    const cursor = page1.next_cursor;
    assert.match(cursor, /^\d+:sig_/, "verified 游标应为 <verify_count>:<sig_id> 复合形式");

    const rest = (
      await get(
        `/topics/ai-research/signals?sort=verified&limit=200&cursor=${encodeURIComponent(cursor)}`,
      )
    ).json();
    const seen = [...page1.signals, ...rest.signals].map((s: { id: string }) => s.id);
    assert.equal(new Set(seen).size, seen.length, "翻页结果互不重复");
    assert.ok(
      !rest.signals.some((s: { id: string }) => s.id === page1.signals[0].id),
      "第二页不应包含第一页游标对应的行",
    );
  });

  test("use 取全文（include=experience）", async () => {
    const sig = (await get(`/signals/${sigId}?include=experience`)).json();
    assert.equal(sig.id, sigId);
    assert.equal(sig.experience.format, "markdown");
    assert.match(sig.experience.body, /## What worked/);
  });

  test("include=ui_ext 才下发 UI 扩展字段", async () => {
    const plain = (await get(`/signals/${sigId}`)).json();
    assert.equal(plain._ui_ext, undefined);
    const ext = (await get(`/signals/${sigId}?include=ui_ext`)).json();
    assert.ok(ext._ui_ext, "include=ui_ext 应下发扩展字段");
    assert.equal(typeof ext._ui_ext.verify_count, "number");
    assert.equal(typeof ext._ui_ext.digest_valid, "boolean", "digest_valid 在 _ui_ext 中下发");
  });

  test("非法 sig id 返回 404", async () => {
    const res = await get("/signals/not-a-signal");
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, "not_found");
  });
});

describe("Related 与 Verify", () => {
  test("related 返回同分区的其他信号且不含自身", async () => {
    const list = (await get("/topics/ai-research/signals?limit=1")).json();
    const id = list.signals[0].id;
    const rel = (await get(`/signals/${id}/related?limit=8`)).json();
    assert.ok(Array.isArray(rel.related));
    assert.ok(
      rel.related.every((s: { id: string }) => s.id !== id),
      "不应包含自身",
    );
  });

  test("verify 计数递增且持久化", async () => {
    const list = (await get("/topics/ai-research/signals?limit=1")).json();
    const id = list.signals[0].id;
    const before = (await get(`/signals/${id}?include=ui_ext`)).json()._ui_ext.verify_count;
    const after = (await post(`/signals/${id}/verify`, {})).json().verify_count;
    assert.equal(after, before + 1);
    const again = (await get(`/signals/${id}?include=ui_ext`)).json()._ui_ext.verify_count;
    assert.equal(again, before + 1, "应已落库");
  });
});

describe("链路3 构建校验", () => {
  test("validate/envelope 对三段式 digest 判有效", async () => {
    const res = await post("/validate/envelope", {
      digest: DIGEST,
      body: EXPERIENCE_BODY,
      tokens_est: 1200,
    });
    assert.equal(res.statusCode, 200);
    const out = res.json();
    assert.equal(out.digest_valid, true);
    assert.equal(out.section_rate, 1, "四节齐全应为 1");
    assert.equal(out.warnings.length, 0);
  });

  test("validate/envelope 对残缺 digest 与稀疏小节给出警告", async () => {
    const res = await post("/validate/envelope", {
      digest: "随便写一句",
      body: "## Why\n只有动机",
    });
    const out = res.json();
    assert.equal(out.digest_valid, false);
    assert.equal(out.valid, false);
    assert.ok(out.warnings.some((w: { code: string }) => w.code === "digest_format"));
    assert.ok(out.warnings.some((w: { code: string }) => w.code === "sections_sparse"));
  });
});

describe("分区与统计", () => {
  test("topics 列表带真实 signal_count", async () => {
    const out = (await get("/topics")).json();
    const t = out.topics.find((x: { slug: string }) => x.slug === "ai-research");
    assert.ok(t, "ai-research 应存在");
    assert.ok(t.signal_count >= 1);
  });

  test("stats/frontpage 全为真实值", async () => {
    const s = (await get("/stats/frontpage")).json();
    assert.ok(s.signals >= 1);
    assert.ok(s.agents >= 1);
    assert.ok(s.topics >= 1);
    assert.equal(typeof s.installs, "number");
  });
});
