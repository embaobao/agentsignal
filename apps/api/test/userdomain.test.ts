/**
 * 集成单测：用户域 creds（user-domain-completion Phase 1）。
 *
 * 覆盖：
 *   token 管理：list / rotate（旧 token 立即 401 · 新 token 可用）/ revoke / 越权 404
 *   POST /agents（用户域创建）：session 401 · 出生即绑定 · ≤AGENTS_PER_USER_MAX 上限 403
 *   POST /agents/claim：无效 token 404 · 他人已绑 409 · 绑定成功 · 重复绑幂等
 *   DELETE /agents/claim：解绑自己名下 204 · 未绑 404
 *   GET /agents/me/session：桥接视图（user + agents）
 *   篡改 cookie 签名 → 401（better-auth HMAC 防伪）
 *
 * 独立 buildApp 实例 + 注入式测试库；node:test 单口径。
 * session 侧：直接插 better-auth 四表行 + 按 better-call 签名方案合成 cookie
 * （value = encodeURIComponent(token + "." + base64(HMAC-SHA256(token, secret)))）。
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import type { FastifyInstance } from "fastify";

process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.BETTER_AUTH_SECRET = "userdomain-test-secret";

const { buildApp } = await import("../src/server.ts");
const { resetEnv } = await import("../src/env.ts");
const { createTestDb } = await import("./helpers/testdb.ts");
const { migrateToLatest } = await import("../src/db/migrations.ts");

const SECRET = "userdomain-test-secret";

/** 按 better-call crypto.mjs 同款方案合成 better-auth session cookie */
async function sessionCookie(token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `better-auth.session_token=${encodeURIComponent(`${token}.${b64}`)}`;
}

/** 测试内直插一个「GitHub 登录人类」：user + account + session 三行 */
async function seedUser(
  db: import("../src/db/client.ts").Db,
  opts: { userId: string; githubId: string; sessionToken: string },
): Promise<void> {
  const now = new Date().toISOString();
  await db.query(
    `insert into "user" (id, name, email, "email_verified", created_at, updated_at)
     values ($1,$2,$3,true,$4,$4)`,
    [opts.userId, `human-${opts.githubId}`, `${opts.githubId}@example.com`, now],
  );
  await db.query(
    `insert into "account" (id, account_id, provider_id, user_id, created_at, updated_at)
     values ($1,$2,'github',$3,$4,$4)`,
    [`acc_${opts.githubId}`, opts.githubId, opts.userId, now],
  );
  await db.query(
    `insert into "session" (id, expires_at, token, created_at, updated_at, user_id)
     values ($1,$2,$3,$4,$4,$5)`,
    [
      `ses_${opts.sessionToken}`,
      new Date(Date.now() + 86_400_000).toISOString(),
      opts.sessionToken,
      now,
      opts.userId,
    ],
  );
}

describe("user-domain Phase 1", () => {
  let app: FastifyInstance;
  let dispose: () => Promise<void>;
  let db: import("../src/db/client.ts").Db;

  const inject = (
    method: "GET" | "POST" | "DELETE",
    url: string,
    opts: { body?: unknown; token?: string; cookie?: string } = {},
  ) =>
    app.inject({
      method,
      url,
      headers: {
        "content-type": "application/json",
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
      payload: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

  before(async () => {
    resetEnv();
    const t = await createTestDb();
    db = t.db;
    dispose = t.dispose;
    app = await buildApp({
      db: t.db,
      env: {
        RATE_LIMIT_READ_MAX: "100000",
        RATE_LIMIT_WRITE_MAX: "100000",
        RATE_LIMIT_REGISTER_MAX: "100000",
        AGENTS_PER_USER_MAX: "2",
      },
    });
  });

  after(async () => {
    await app.close();
    await dispose();
  });

  test("迁移已推进到 007_auth（better-auth 四表就位）", async () => {
    const v = await migrateToLatest(db);
    assert.equal(v, "007_auth");
    for (const tbl of ["user", "session", "account", "verification"]) {
      const r = await db.query(`select 1 from information_schema.tables where table_name = $1`, [
        tbl,
      ]);
      assert.ok(r.rows.length > 0, `缺表 ${tbl}`);
    }
  });

  /* ---------- token 管理（Phase 1.4） ---------- */

  test("rotate：旧 token 立即失效、新 token 可用、id 不变", async () => {
    const reg = await inject("POST", "/agents/register", { body: { name: "rotator" } });
    assert.equal(reg.statusCode, 201);
    const oldToken = reg.json().token as string;

    const list1 = await inject("GET", "/agents/me/tokens", { token: oldToken });
    assert.equal(list1.statusCode, 200);
    assert.equal(list1.json().tokens.length, 1);
    const tokId = list1.json().tokens[0].id as string;

    const rot = await inject("POST", `/agents/me/tokens/${tokId}/rotate`, { token: oldToken });
    assert.equal(rot.statusCode, 200);
    const newToken = rot.json().token as string;
    assert.notEqual(newToken, oldToken);
    assert.match(newToken, /^ags_/);

    const oldMe = await inject("GET", "/agents/me", { token: oldToken });
    assert.equal(oldMe.statusCode, 401, "rotate 后旧 token 必须 401");
    const newMe = await inject("GET", "/agents/me", { token: newToken });
    assert.equal(newMe.statusCode, 200);

    const list2 = await inject("GET", "/agents/me/tokens", { token: newToken });
    assert.equal(list2.json().tokens.length, 1, "rotate 原行换 hash，不新增行");
    assert.equal(list2.json().tokens[0].id, tokId);
  });

  test("revoke：撤销后 401；再撤 404；无 token 匿名 401", async () => {
    const reg = await inject("POST", "/agents/register", { body: { name: "revoker" } });
    const token = reg.json().token as string;
    const list = await inject("GET", "/agents/me/tokens", { token });
    const tokId = list.json().tokens[0].id as string;

    const anon = await inject("GET", "/agents/me/tokens");
    assert.equal(anon.statusCode, 401);

    const rev = await inject("POST", `/agents/me/tokens/${tokId}/revoke`, { token });
    assert.equal(rev.statusCode, 204);
    const after1 = await inject("GET", "/agents/me", { token });
    assert.equal(after1.statusCode, 401);

    const rev2 = await inject("POST", `/agents/me/tokens/${tokId}/revoke`, { token });
    assert.equal(rev2.statusCode, 401, "token 已失效，撤第二次走 401 而非 404");
  });

  test("越权：不能操作别人的 token", async () => {
    const a = await inject("POST", "/agents/register", { body: { name: "alice-t" } });
    const b = await inject("POST", "/agents/register", { body: { name: "bob-t" } });
    const tokA = a.json().token as string;
    const tokB = b.json().token as string;
    const listB = await inject("GET", "/agents/me/tokens", { token: tokB });
    const tokIdB = listB.json().tokens[0].id as string;

    const cross = await inject("POST", `/agents/me/tokens/${tokIdB}/rotate`, { token: tokA });
    assert.equal(cross.statusCode, 404, "rotate 他人 token 必须 404");
  });

  /* ---------- 用户域创建 agent（Phase 1.8） ---------- */

  test("POST /agents：无 session 401；有 session 出生即绑定；超上限 403", async () => {
    await seedUser(db, { userId: "u1", githubId: "1001", sessionToken: "st-u1" });
    const cookie = await sessionCookie("st-u1");

    const noSess = await inject("POST", "/agents", { body: { name: "x" } });
    assert.equal(noSess.statusCode, 401);

    const r1 = await inject("POST", "/agents", { body: { name: "my-agent" }, cookie });
    assert.equal(r1.statusCode, 201);
    assert.equal(r1.json().bound, true);
    assert.match(r1.json().token, /^ags_/);
    const agt1 = r1.json().agent_id as string;

    const view = await inject("GET", "/agents/me/session", { cookie });
    assert.equal(view.statusCode, 200);
    assert.equal(view.json().user.id, "u1");
    assert.equal(view.json().github_id, "1001");
    assert.equal(view.json().agents.length, 1);
    assert.equal(view.json().agents[0].id, agt1);

    await inject("POST", "/agents", { body: { name: "my-agent-2" }, cookie });
    const r3 = await inject("POST", "/agents", { body: { name: "my-agent-3" }, cookie });
    assert.equal(r3.statusCode, 403, "超过 AGENTS_PER_USER_MAX=2 必须 403");

    // 匿名自注册路径不受影响（Q2 口径）
    const selfReg = await inject("POST", "/agents/register", { body: { name: "wild" } });
    assert.equal(selfReg.statusCode, 201);
  });

  test("伪造 cookie（签名不对）→ 401", async () => {
    const forged = `better-auth.session_token=${encodeURIComponent("st-u1.deadbeef")}`;
    const r = await inject("GET", "/agents/me/session", { cookie: forged });
    assert.equal(r.statusCode, 401);
  });

  /* ---------- claim（Phase 1.3） ---------- */

  test("claim 全链：无效 404 → 绑定成功 → 幂等 → 他人 409 → 解绑", async () => {
    await seedUser(db, { userId: "u2", githubId: "2002", sessionToken: "st-u2" });
    await seedUser(db, { userId: "u3", githubId: "3003", sessionToken: "st-u3" });
    const ck2 = await sessionCookie("st-u2");
    const ck3 = await sessionCookie("st-u3");

    // 自注册一个未绑定 agent
    const reg = await inject("POST", "/agents/register", { body: { name: "orphan" } });
    const orphanToken = reg.json().token as string;
    const orphanId = reg.json().agent_id as string;

    const bad = await inject("POST", "/agents/claim", {
      body: { token: "ags_00000000000000000000000000" },
      cookie: ck2,
    });
    assert.equal(bad.statusCode, 404, "无效 token 404");

    const ok = await inject("POST", "/agents/claim", { body: { token: orphanToken }, cookie: ck2 });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().agent_id, orphanId);
    assert.equal(ok.json().bound, true);

    const again = await inject("POST", "/agents/claim", {
      body: { token: orphanToken },
      cookie: ck2,
    });
    assert.equal(again.statusCode, 200, "同一身份重复 claim 幂等");

    const other = await inject("POST", "/agents/claim", {
      body: { token: orphanToken },
      cookie: ck3,
    });
    assert.equal(other.statusCode, 409, "他人 claim 已绑 agent 409");

    const unbindOther = await inject("DELETE", "/agents/claim", {
      body: { agent_id: orphanId },
      cookie: ck3,
    });
    assert.equal(unbindOther.statusCode, 404, "解绑他人名下 404");

    const unbind = await inject("DELETE", "/agents/claim", {
      body: { agent_id: orphanId },
      cookie: ck2,
    });
    assert.equal(unbind.statusCode, 204);

    const view = await inject("GET", "/agents/me/session", { cookie: ck2 });
    assert.equal(view.json().agents.length, 0, "解绑后名下为空");
  });
});
