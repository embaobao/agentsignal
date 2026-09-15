/**
 * 集成单测：audit-restore 1B-2 —— Restore Signal 两步端点（dry-run → apply）。
 * 红绿蓝：本文件先于实现编写（restore.ts / 路由当时不存在）。
 * 覆盖（tasks.md 2.1/2.3 + 设计 MUST #1/#3）：
 *   全行快照接进写路径（create 后 / update 前）· dry-run unified diff ·
 *   apply 还原 digest/experience + 追加 restore 事件 + 链可验证 ·
 *   同一 to_rev 幂等（二次 apply 无变化）· 链坏禁止还原 · to_event_id 变体。
 * 隔离：createTestDb 注入式测试库（PGlite），零外部依赖。
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";

process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";

const { buildApp } = await import("../src/server.ts");
const { resetEnv } = await import("../src/env.ts");
const { createTestDb } = await import("./helpers/testdb.ts");

import type { Db } from "../src/db/client.ts";

const BCRYPT = bcrypt.hashSync("admin-pass", 10);

function makeApp(extraEnv: Record<string, string> = {}) {
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
          AS_AUDIT_STATE_DIR: "/tmp/dsme-audit",
          ...extraEnv,
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

const get = (app: FastifyInstance, url: string, headers: Record<string, string> = {}) =>
  app.inject({ method: "GET", url, headers });

const basic = () => ({
  authorization: `Basic ${Buffer.from("admin:admin-pass").toString("base64")}`,
});

const DIGEST_V1 = "初版经验 digest | scope: test | validation: self-tested";
const DIGEST_V2 = "被改坏的 digest | scope: test | validation: none";

async function seedSignal(app: FastifyInstance) {
  const reg = await post(app, "/agents/register", { name: "restore-probe" });
  const token = reg.json().token as string;
  const auth = { authorization: `Bearer ${token}` };
  const p = await post(
    app,
    "/topics/r-restore/signals",
    {
      kind: "solution",
      digest: DIGEST_V1,
      tokens_est: 42,
      experience: { format: "markdown", body: "## Why\nv1\n\n## What worked\n1. 原始步骤\n" },
    },
    auth,
  );
  assert.equal(p.statusCode, 201);
  return { token, auth, sig: p.json().id as string };
}

async function patchDigest(
  app: FastifyInstance,
  auth: Record<string, string>,
  sig: string,
  digest: string,
) {
  const r = await app.inject({
    method: "PATCH",
    url: `/signals/${sig}`,
    headers: { "content-type": "application/json", ...auth },
    payload: { digest },
  });
  assert.equal(r.statusCode, 200);
}

describe("audit-restore 1B-2 · Restore Signal 两步端点", () => {
  test("dry-run：unified diff 指向 rev1 内容（2.1/2.3）", async () => {
    const ctx = makeApp({ AS_ADMIN_SINGLE: "y" });
    const { app } = await ctx.ready();
    const seed = await seedSignal(app);
    await patchDigest(app, seed.auth, seed.sig, DIGEST_V2);

    const r = await post(app, `/admin/restore/signal/${seed.sig}/dry-run`, { to_rev: 1 }, basic());
    assert.equal(r.statusCode, 200);
    const body = r.json() as {
      target: { digest: string };
      diff: string;
      diff_lines: number;
      warning?: string;
    };
    assert.equal(body.target.digest, DIGEST_V1);
    assert.match(body.diff, /-.*被改坏的 digest/);
    assert.match(body.diff, /\+.*初版经验 digest/);
    assert.ok(!(body.warning ?? ""), "小 diff 不给 warning");
    await ctx.cleanup();
  });

  test("apply：还原 digest/experience + restore 事件落账 + 链可验证（2.1）", async () => {
    const ctx = makeApp({ AS_ADMIN_SINGLE: "y" });
    const { app, db } = await ctx.ready();
    const seed = await seedSignal(app);
    await patchDigest(app, seed.auth, seed.sig, DIGEST_V2);

    const r = await post(app, `/admin/restore/signal/${seed.sig}/apply`, { to_rev: 1 }, basic());
    assert.equal(r.statusCode, 200);
    assert.equal((r.json() as { changed: boolean }).changed, true);

    const detail = await get(app, `/signals/${seed.sig}?include=experience`);
    assert.equal(detail.json().digest, DIGEST_V1, "digest 应回到 rev1");
    assert.match(detail.json().experience.body, /原始步骤/);

    const evs = await db.query<{ action: string }>(
      `select action from audit_events where entity_id = $1 and action = 'restore'`,
      [seed.sig],
    );
    assert.equal(evs.rows.length, 1, "应恰好追加一条 restore 事件");
    await ctx.cleanup();
  });

  test("幂等：同一 to_rev 二次 apply 无变化、无新事件", async () => {
    const ctx = makeApp({ AS_ADMIN_SINGLE: "y" });
    const { app, db } = await ctx.ready();
    const seed = await seedSignal(app);
    await patchDigest(app, seed.auth, seed.sig, DIGEST_V2); // 先变更，恢复才有意义
    await post(app, `/admin/restore/signal/${seed.sig}/apply`, { to_rev: 1 }, basic());
    const r2 = await post(app, `/admin/restore/signal/${seed.sig}/apply`, { to_rev: 1 }, basic());
    assert.equal(r2.statusCode, 200);
    assert.equal((r2.json() as { changed: boolean }).changed, false);
    const evs = await db.query<{ n: string }>(
      `select count(*)::text as n from audit_events where entity_id = $1 and action = 'restore'`,
      [seed.sig],
    );
    assert.equal(evs.rows[0]?.n, "1");
    await ctx.cleanup();
  });

  test("链坏禁止还原（设计 MUST #1）", async () => {
    const ctx = makeApp({ AS_ADMIN_SINGLE: "y" });
    const { app, db } = await ctx.ready();
    const seed = await seedSignal(app);
    await db.query(
      `update audit_events set hash = 'deadbeef'
        where id in (select id from audit_events where entity_id = $1 order by id asc limit 1)`,
      [seed.sig],
    );
    const r = await post(app, `/admin/restore/signal/${seed.sig}/apply`, { to_rev: 1 }, basic());
    assert.equal(r.statusCode, 409);
    assert.match((r.json() as { error?: { message?: string } }).error?.message ?? "", /链/);
    await ctx.cleanup();
  });

  test("to_event_id 变体：指定 create 事件 → 同 rev1 目标", async () => {
    const ctx = makeApp({ AS_ADMIN_SINGLE: "y" });
    const { app, db } = await ctx.ready();
    const seed = await seedSignal(app);
    await patchDigest(app, seed.auth, seed.sig, DIGEST_V2);
    const ev = await db.query<{ event_id: string; action: string }>(
      `select event_id, action from audit_events where entity_id = $1 and action = 'create' order by id asc limit 1`,
      [seed.sig],
    );
    const r = await post(
      app,
      `/admin/restore/signal/${seed.sig}/dry-run`,
      { to_event_id: ev.rows[0]?.event_id },
      basic(),
    );
    assert.equal(r.statusCode, 200);
    assert.equal((r.json() as { target: { digest: string } }).target.digest, DIGEST_V1);
    await ctx.cleanup();
  });
});

/* ── 2.2 Restore Agent（轻量：name/description；不回 token）───────────────── */

test("Restore Agent：dry-run + apply 还原 name/description；token 表零触碰（2.2）", async () => {
  const ctx = makeApp({ AS_ADMIN_SINGLE: "y" });
  const { app, db } = await ctx.ready();
  const reg = await post(app, "/agents/register", {
    name: "agent-original",
    description: "原始描述",
  });
  const agentId = reg.json().agent_id as string;
  // 模拟漂移：直接改库（当前无 agent 改名路由）
  await db.query(`update agents set name = 'drifted', description = '被改的描述' where id = $1`, [
    agentId,
  ]);
  const tokBefore = await db.query<{ n: string }>(
    `select count(*)::text as n from agent_tokens where agent_id = $1`,
    [agentId],
  );

  const dry = await post(app, `/admin/restore/agent/${agentId}/dry-run`, { to_rev: 1 }, basic());
  assert.equal(dry.statusCode, 200);
  assert.equal((dry.json() as { target: { description: string } }).target.description, "原始描述");

  const r = await post(app, `/admin/restore/agent/${agentId}/apply`, { to_rev: 1 }, basic());
  assert.equal(r.statusCode, 200);
  assert.equal((r.json() as { changed: boolean }).changed, true);

  const row = await db.query<{ name: string; description: string }>(
    `select name, description from agents where id = $1`,
    [agentId],
  );
  assert.equal(row.rows[0]?.name, "agent-original");
  assert.equal(row.rows[0]?.description, "原始描述");
  const tokAfter = await db.query<{ n: string }>(
    `select count(*)::text as n from agent_tokens where agent_id = $1`,
    [agentId],
  );
  assert.equal(tokAfter.rows[0]?.n, tokBefore.rows[0]?.n, "token 表零触碰（铁律 ⑥）");
  await ctx.cleanup();
});

/* ── 2.5 双签：配额逻辑（无豁免 → 202 pending；第二管理员登记后放行）──────── */

test("双签：默认配额 2 → 首次 apply 202 pending；第二管理员登记后放行（2.5）", async () => {
  const auditDir = await mkdtemp(path.join(tmpdir(), "as-dual-"));
  const ctx2 = makeApp({ AS_AUDIT_STATE_DIR: auditDir });
  const { app } = await ctx2.ready();
  const seed = await seedSignal(app);
  await patchDigest(app, seed.auth, seed.sig, DIGEST_V2);

  // 首次 apply（默认配额 2）：登记 1 票 → 202 pending，不执行还原
  const r1 = await post(app, `/admin/restore/signal/${seed.sig}/apply`, { to_rev: 1 }, basic());
  assert.equal(r1.statusCode, 202);
  assert.equal(
    (r1.json() as { pending: boolean; required: number; distinct: number }).pending,
    true,
  );
  assert.equal((r1.json() as { distinct: number }).distinct, 1);

  // digest 未变（pending 不执行）
  const detail = await get(app, `/signals/${seed.sig}?include=experience`);
  assert.equal(detail.json().digest, DIGEST_V2, "pending 期间不得还原");

  // 第二管理员登记（模拟另一 admin 在 approvals.json 落票）
  const opSha = (r1.json() as { op_sha: string }).op_sha;
  const { ApprovalsStore } = await import("@agentssignal/audit");
  const approvals = new ApprovalsStore(path.join(auditDir, "approvals.json"));
  approvals.register(opSha, "admin:second", new Date().toISOString());

  // 再次 apply → 配额满足 → 执行
  const r2 = await post(app, `/admin/restore/signal/${seed.sig}/apply`, { to_rev: 1 }, basic());
  assert.equal(r2.statusCode, 200);
  assert.equal((r2.json() as { changed: boolean }).changed, true);
  await ctx2.cleanup();
});
