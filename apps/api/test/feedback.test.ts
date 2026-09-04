/**
 * 集成单测：verify 反馈 + 超管端点（user-domain-completion Phase 0.2）。
 *
 * 覆盖：
 *   verify：匿名 401 · Bearer+verdict 200+聚合 · admin Basic 代验 · 错密码 Basic 401
 *   DELETE /admin/signals/:id：错密码 403 · 对密码 204 且生效 · 再删 404
 *   PATCH /admin/topics/:id/archive：错密码 403 · 对密码 204 且生效 · 再归档 404
 *
 * 独立 buildApp 实例 + 注入式测试库；node:test 单口径。
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";

process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { buildApp } = await import("../src/server.ts");
const { resetEnv } = await import("../src/env.ts");
const { createTestDb } = await import("./helpers/testdb.ts");

const DIGEST = "feedback 探测专用 digest | scope: test | validation: none";

const BCRYPT = bcrypt.hashSync("admin-pass", 10);

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

const basic = (user: string, pass: string) => ({
  authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
});

describe("feedback Phase 0", () => {
  let app: FastifyInstance;
  let dispose: () => Promise<void>;
  let token: string;
  let sigId: string;
  let topicId: string;

  // 一次性拉起：注册 agent + 发布信号，供 verify 与超管端点共用
  before(async () => {
    resetEnv();
    const t = await createTestDb();
    app = await buildApp({
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
    dispose = t.dispose;

    const reg = await post(app, "/agents/register", { name: "verifier" });
    assert.equal(reg.statusCode, 201);
    token = reg.json().token;

    const pub = await post(
      app,
      "/topics/feedback-test/signals",
      { kind: "solution", digest: DIGEST },
      { authorization: `Bearer ${token}` },
    );
    assert.equal(pub.statusCode, 201);
    sigId = pub.json().id;
    topicId = pub.json().topic_id;
  });

  after(async () => {
    await app?.close();
    await dispose?.();
  });

  test("verify：匿名 401", async () => {
    const r = await post(app, `/signals/${sigId}/verify`, { verdict: "worked" });
    assert.equal(r.statusCode, 401);
  });

  test("verify：错密码 Basic 401（安全洞回归——只对用户名不再放行）", async () => {
    const r = await post(
      app,
      `/signals/${sigId}/verify`,
      { verdict: "worked" },
      basic("admin", "wrong-pass"),
    );
    assert.equal(r.statusCode, 401);
  });

  test("verify：Bearer + verdict 200，聚合正确", async () => {
    const r = await post(
      app,
      `/signals/${sigId}/verify`,
      { verdict: "worked" },
      {
        authorization: `Bearer ${token}`,
      },
    );
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.equal(j.total, 1);
    assert.equal(j.worked, 1);
    assert.equal(j.partial, 0);
    assert.equal(j.failed, 0);

    // 同一 agent 改口 partial：upsert 聚合不重复计数
    const r2 = await post(
      app,
      `/signals/${sigId}/verify`,
      { verdict: "partial" },
      {
        authorization: `Bearer ${token}`,
      },
    );
    assert.equal(r2.statusCode, 200);
    assert.equal(r2.json().total, 1);
    assert.equal(r2.json().partial, 1);
    assert.equal(r2.json().worked, 0);
  });

  test("verify：admin Basic 代验 200", async () => {
    const r = await post(
      app,
      `/signals/${sigId}/verify`,
      { verdict: "failed" },
      basic("admin", "admin-pass"),
    );
    assert.equal(r.statusCode, 200);
    const j = r.json();
    assert.equal(j.total, 2);
    assert.equal(j.failed, 1);
  });

  test("verify：非法 verdict 400", async () => {
    const r = await post(
      app,
      `/signals/${sigId}/verify`,
      { verdict: "nope" },
      {
        authorization: `Bearer ${token}`,
      },
    );
    assert.equal(r.statusCode, 400);
  });

  test("DELETE /admin/signals/:id：错密码 403", async () => {
    const r = await app.inject({
      method: "DELETE",
      url: `/admin/signals/${sigId}`,
      headers: basic("admin", "wrong-pass"),
    });
    assert.equal(r.statusCode, 403);
  });

  test("DELETE /admin/signals/:id：对密码 204 且生效；再删 404", async () => {
    const ok = await app.inject({
      method: "DELETE",
      url: `/admin/signals/${sigId}`,
      headers: basic("admin", "admin-pass"),
    });
    assert.equal(ok.statusCode, 204);

    // 删除后详情不可达
    const gone = await app.inject({ method: "GET", url: `/signals/${sigId}?include=experience` });
    assert.equal(gone.statusCode, 404);

    const again = await app.inject({
      method: "DELETE",
      url: `/admin/signals/${sigId}`,
      headers: basic("admin", "admin-pass"),
    });
    assert.equal(again.statusCode, 404);
  });

  test("PATCH /admin/topics/:id/archive：错密码 403", async () => {
    const r = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${topicId}/archive`,
      headers: basic("admin", "wrong-pass"),
    });
    assert.equal(r.statusCode, 403);
  });

  test("PATCH /admin/topics/:id/archive：对密码 204 且生效；再归档 404", async () => {
    const ok = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${topicId}/archive`,
      headers: basic("admin", "admin-pass"),
    });
    assert.equal(ok.statusCode, 204);

    const again = await app.inject({
      method: "PATCH",
      url: `/admin/topics/${topicId}/archive`,
      headers: basic("admin", "admin-pass"),
    });
    assert.equal(again.statusCode, 404);
  });
});
