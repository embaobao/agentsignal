/**
 * 集成单测：Token Firewall · Server Filter —— 写限频 429 / register 门禁与限频 / verify 防刷。
 *
 * 独立 buildApp 实例 + 低限频 env 注入（与 e2e 隔离）；node:test 单口径。
 * 注意：同进程跑时 loadEnv 有缓存，构建前必须 resetEnv()；Db 走注入式夹具。
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FastifyInstance } from "fastify";

process.env.LOG_LEVEL = "silent";
// env 契约要求 DATABASE_URL 存在；Db 为注入式，此 URL 不会被连接
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { buildApp } = await import("../src/server.ts");
const { resetEnv } = await import("../src/env.ts");
const { createTestDb } = await import("./helpers/testdb.ts");

const post = (app: FastifyInstance, url: string, body: unknown, token?: string) =>
  app.inject({
    method: "POST",
    url,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: JSON.stringify(body),
  });

const DIGEST = "限频探测专用 digest | scope: test | validation: none";

describe("Token Firewall · Server Filter", () => {
  test("写限频：第 3 次 publish → 429（retry_after）· verify 防刷 · register 1/IP 门禁", async () => {
    resetEnv();
    const t1 = await createTestDb();
    const app = await buildApp({
      db: t1.db,
      env: {
        RATE_LIMIT_READ_MAX: "100000",
        RATE_LIMIT_WRITE_MAX: "2",
        RATE_LIMIT_WRITE_WINDOW: "1m",
        RATE_LIMIT_REGISTER_MAX: "1",
        RATE_LIMIT_REGISTER_WINDOW: "1m",
        SELF_REGISTER_ENABLED: "1",
      },
    });

    const reg = await post(app, "/agents/register", {});
    assert.equal(reg.statusCode, 201);
    const { token, agent_id } = reg.json();
    assert.match(token, /^ags_[0-9A-Z]{26}$/, "token 应为 ags_ + 26 位 ULID（31 字符）");

    const p1 = await post(app, "/topics/rl/signals", { kind: "update", digest: DIGEST }, token);
    const p2 = await post(app, "/topics/rl/signals", { kind: "update", digest: DIGEST }, token);
    assert.equal(p1.statusCode, 201);
    assert.equal(p2.statusCode, 201);
    assert.equal(p1.json().sender, agent_id, "sender 由服务端填充");

    const p3 = await post(app, "/topics/rl/signals", { kind: "update", digest: DIGEST }, token);
    assert.equal(p3.statusCode, 429, "连续第 3 次 publish 应触发写限频");
    const errBody = p3.json().error;
    assert.equal(errBody.code, "rate_limited");
    assert.ok(typeof errBody.retry_after === "number", "429 应带 retry_after 秒数");

    // verify 需身份（匿名 401）
    const vAnon = await post(app, `/signals/${p1.json().id}/verify`, { verdict: "worked" });
    assert.equal(vAnon.statusCode, 401, "匿名 verify 应 401");
    const v1 = await post(app, `/signals/${p1.json().id}/verify`, { verdict: "worked" }, token);
    assert.equal(v1.statusCode, 200, "有身份 verify 应 200");

    // register 1/IP/min
    const reg2 = await post(app, "/agents/register", { name: "second" });
    assert.equal(reg2.statusCode, 429, "同 IP 第 2 次自注册应 429");

    await app.close();
    await t1.dispose();

    // 门禁关（默认）：自注册 403
    resetEnv();
    const t2 = await createTestDb();
    const appOff = await buildApp({
      db: t2.db,
      env: { RATE_LIMIT_READ_MAX: "100000" },
    });
    const denied = await post(appOff, "/agents/register", {});
    assert.equal(denied.statusCode, 403, "SELF_REGISTER_ENABLED 缺省时自注册应 403");
    assert.equal(denied.json().error.code, "forbidden");
    await appOff.close();
    await t2.dispose();
  });
});
