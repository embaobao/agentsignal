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
const { verifyChain } = await import("@agentsignal/audit");
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
    assert.equal(v.checked, 4, "register 1 + publish 3 = 4 events");

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
    assert.equal(v2.checked, 5);
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
