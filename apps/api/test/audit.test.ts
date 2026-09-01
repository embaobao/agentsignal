/**
 * 集成单测：audit-restore 1B-1 —— 账本链 / 快照 LRU / 审计包装 / admin 端点 / 策展写路径。
 * 独立 buildApp 实例 + 注入式测试库；node:test 单口径。
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";

process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { buildApp } = await import("../src/server.ts");
const { resetEnv } = await import("../src/env.ts");
const { verifyChain } = await import("@agentssignal/audit");
const { createTestDb } = await import("./helpers/testdb.ts");

import type { Db } from "../src/db/client.ts";

const DIGEST = "审计探测专用 digest | scope: test | validation: none";

const BCRYPT = bcrypt.hashSync("admin-pass", 10);

function makeApp() {
  const state: {
    app?: FastifyInstance;
    db?: Db;
    dispose?: () => Promise<void>;
    error?: unknown;
  } = {};
  const ready = (async () => {
    try {
      resetEnv();
      const t = await createTestDb();
      state.app = await buildApp({
        db: t.db,
        env: {
          RATE_LIMIT_READ_MAX: "100000",
          RATE_LIMIT_WRITE_MAX: "100000",
          RATE_LIMIT_REGISTER_MAX: "100000",
          SELF_REGISTER_ENABLED: "1",
          AS_ADMIN_USER: "admin",
          AS_ADMIN_PASS_BCRYPT: BCRYPT,
        },
      });
      state.db = t.db;
      state.dispose = t.dispose;
    } catch (err) {
      state.error = err;
    }
  })();
  return {
    ready: async () => {
      await ready;
      if (state.error) throw state.error;
      if (!state.app || !state.db || !state.dispose) throw new Error("app 未就绪");
      return { app: state.app, db: state.db, dispose: state.dispose };
    },
    cleanup: async () => {
      if (!state.app || !state.dispose) return;
      await state.app.close();
      await state.dispose();
    },
  };
}

const post = (
  app: FastifyInstance,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  app.inject({
    method: "POST",
    url,
    headers: { "content-type": "application/json", ...headers },
    payload: JSON.stringify(body),
  });

const basic = (extra = "") => ({
  authorization: `Basic ${Buffer.from(`admin:admin-pass`).toString("base64")}${extra}`,
});

describe("audit-restore 1B-1", () => {
  const ctx = makeApp();

  test("用户写路径落账本且链可验证；策展写路径留痕；篡改可检出", async () => {
    const { app, db } = await ctx.ready();

    // register（1 event）+ publish×3（3 events）
    const reg = await post(app, "/agents/register", { name: "auditor" });
    assert.equal(reg.statusCode, 201);
    const token = reg.json().token;
    for (let i = 0; i < 3; i++) {
      const p = await post(
        app,
        "/topics/audit/signals",
        { kind: "solution", digest: `${DIGEST} #${i}` },
        { authorization: `Bearer ${token}` },
      );
      assert.equal(p.statusCode, 201);
    }

    // 未配置前不可见性：这里已配置 → 校验事件数与链
    const v = await verifyChain(db);
    assert.equal(v.ok, true, "链应完整");
    assert.ok(v.checked >= 4, `至少 4 events（got ${v.checked}）`);

    // admin 事件列表（Basic）
    const list = await app.inject({
      method: "GET",
      url: "/admin/audit/events?limit=10",
      headers: basic(),
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().events.length, 4);

    // 错凭证 401
    const bad = await app.inject({
      method: "GET",
      url: "/admin/audit/events",
      headers: { authorization: `Basic ${Buffer.from("admin:wrong").toString("base64")}` },
    });
    assert.equal(bad.statusCode, 401);

    // 策展写路径：recommended + stats_tag，落 after 账本
    const list2 = (
      await app.inject({ method: "GET", url: "/admin/audit/events?limit=1", headers: basic() })
    ).json();
    const sigId = list2.events.find(
      (e: { entity_type: string }) => e.entity_type === "signal",
    ).entity_id;
    const cur = await app.inject({
      method: "PATCH",
      url: `/admin/signals/${sigId}/curate`,
      headers: { "content-type": "application/json", ...basic() },
      payload: JSON.stringify({ recommended: true, stats_tag: ["编辑推荐"] }),
    });
    assert.equal(cur.statusCode, 200);
    assert.equal(cur.json().recommended, true);

    // ui_ext 可见策展结果
    const detail = (
      await app.inject({ method: "GET", url: `/signals/${sigId}?include=ui_ext` })
    ).json();
    assert.equal(detail._ui_ext.recommended, true);
    assert.deepEqual(detail._ui_ext.stats_tag, ["编辑推荐"]);

    // 策展已落账（第 5 条事件，actor=admin:*）
    const v2 = await verifyChain(db);
    assert.ok(v2.checked >= 5);
    const list3 = (
      await app.inject({ method: "GET", url: "/admin/audit/events?limit=1", headers: basic() })
    ).json();
    assert.match(list3.events[0].actor, /^admin:/);

    // 篡改检测：直改一行 hash → verify 坏链定位
    await db.query(`update audit_events set hash = repeat('0', 64) where id = 2`);
    const v3 = await verifyChain(db);
    assert.equal(v3.ok, false, "篡改后应判坏链");
    assert.ok(v3.broken_at, "应给出首坏 event_id");

    await ctx.cleanup();
  });

  test("admin 未配置时 404 fail-soft", async () => {
    resetEnv();
    const t = await createTestDb();
    const app = await buildApp({ db: t.db, env: { RATE_LIMIT_READ_MAX: "100000" } });
    const res = await app.inject({ method: "GET", url: "/admin/audit/events", headers: basic() });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error.code, "not_found");
    await app.close();
    await t.dispose();
  });
});

describe("topic 治理端点（reuse-boundary D3）", () => {
  const ctx = makeApp();

  test("改名/slug 唯一校验/下架软删/撤销 —— 全程落账本", async () => {
    const { app, db } = await ctx.ready();

    // 造一个 topic：publish 一条即 ensureTopic 建出 audit（复用前一 describe 的库，slug 取新名）
    const reg = await post(app, "/agents/register", { name: "topic-owner" });
    const token = reg.json().token;
    const pub = await post(
      app,
      "/topics/gov-demo/signals",
      { kind: "update", digest: `${DIGEST} gov` },
      { authorization: `Bearer ${token}` },
    );
    assert.equal(pub.statusCode, 201);

    // 列表可见
    const list = await app.inject({ method: "GET", url: "/admin/topics", headers: basic() });
    assert.equal(list.statusCode, 200);
    const gov = list.json().topics.find((t: { slug: string }) => t.slug === "gov-demo");
    assert.ok(gov, "治理列表应含新建 topic");
    assert.equal(gov.archived_at, null);

    // 改名 + slug 迁移 + mode（一次 patch 全带，slug 冲突单独测）
    const ren = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${gov.id}`,
      headers: { "content-type": "application/json", ...basic() },
      payload: JSON.stringify({
        name: "Governance Demo",
        description: "renamed",
        mode: "forum",
        slug: "gov-renamed",
      }),
    });
    assert.equal(ren.statusCode, 200);
    assert.equal(ren.json().name, "Governance Demo");
    assert.equal(ren.json().mode, "forum");
    assert.equal(ren.json().slug, "gov-renamed");

    // slug 冲突 → 409：建第二个 topic 作为占位方
    const pub2 = await post(
      app,
      "/topics/gov-other/signals",
      { kind: "update", digest: `${DIGEST} gov2` },
      { authorization: `Bearer ${token}` },
    );
    assert.equal(pub2.statusCode, 201);
    const clash = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${gov.id}`,
      headers: { "content-type": "application/json", ...basic() },
      payload: JSON.stringify({ slug: "gov-other" }),
    });
    assert.equal(clash.statusCode, 409);
    assert.equal(clash.json().error.code, "conflict");

    // 自身 slug 不变 → 不算冲突
    const selfSlug = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${gov.id}`,
      headers: { "content-type": "application/json", ...basic() },
      payload: JSON.stringify({ slug: "gov-renamed" }),
    });
    assert.equal(selfSlug.statusCode, 200);

    // 空 patch → 400
    const empty = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${gov.id}`,
      headers: { "content-type": "application/json", ...basic() },
      payload: JSON.stringify({}),
    });
    assert.equal(empty.statusCode, 400);

    // 下架 = 软删标记；默认列表隐藏，include_archived 可见
    const del = await app.inject({
      method: "DELETE",
      url: `/admin/topics/${gov.id}`,
      headers: basic(),
    });
    assert.equal(del.statusCode, 200);
    assert.notEqual(del.json().archived_at, null);
    const listAfter = (
      await app.inject({ method: "GET", url: "/admin/topics", headers: basic() })
    ).json();
    assert.ok(
      !listAfter.topics.some((t: { id: string }) => t.id === gov.id),
      "默认列表应隐藏已下架",
    );
    const withArch = (
      await app.inject({
        method: "GET",
        url: "/admin/topics?include_archived=1",
        headers: basic(),
      })
    ).json();
    assert.ok(withArch.topics.some((t: { id: string }) => t.id === gov.id));

    // 撤销下架
    const undo = await app.inject({
      method: "DELETE",
      url: `/admin/topics/${gov.id}?restore=1`,
      headers: basic(),
    });
    assert.equal(undo.statusCode, 200);
    assert.equal(undo.json().archived_at, null);

    // 行未删除：signals 引用完好（slug 已迁移到新名）
    const detail = await app.inject({ method: "GET", url: "/topics/gov-renamed" });
    assert.equal(detail.statusCode, 200);

    // 全部治理动作落账：entity_type=topic 事件 ≥3（rename/archive/restore），actor=admin:*，链完整
    const events = (
      await app.inject({
        method: "GET",
        url: "/admin/audit/events?entity_type=topic&limit=50",
        headers: basic(),
      })
    ).json();
    assert.ok(events.events.length >= 3);
    for (const e of events.events) assert.match(e.actor, /^admin:/);
    const v = await verifyChain(db);
    assert.equal(v.ok, true, "topic 治理后链仍完整");

    // 错凭证 401 / 未知 topic 404
    const un = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${gov.id}`,
      headers: { "content-type": "application/json", authorization: "Basic YWRtaW46d3Jvbmc=" },
      payload: JSON.stringify({ name: "x" }),
    });
    assert.equal(un.statusCode, 401);
    const nf = await app.inject({
      method: "PATCH",
      url: "/admin/topics/topic_nonexistent",
      headers: { "content-type": "application/json", ...basic() },
      payload: JSON.stringify({ name: "x" }),
    });
    assert.equal(nf.statusCode, 404);

    await ctx.cleanup();
  });
});
