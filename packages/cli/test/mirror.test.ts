/**
 * P1.2 verify 回流镜像单测（dynamic-skill-management · node:test 单口径）。
 *
 * 覆盖（tasks.md 1.2）：mirror off 断言零网络请求（fake fetch 零调用）·
 * on 断言调用一次带 verdict + Bearer · 无 token 只提示不阻塞 · 平台失败不抛（本地裁决不受影响）·
 * mirrorContextForSkill：无 provenance → null；有 provenance → sigId/baseUrl/开关读自 config.sync。
 * 决议口径：docs/decisions/2026-09-08-dynamic-skill-management.md 裁决 4（默认 false，手动优先）。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { installSignal } from "../src/skills/install.ts";
import { mirrorContextForSkill, mirrorPlatformVerify } from "../src/skills/mirror.ts";
import type { TranscodeInput } from "../src/skills/transcoder.ts";

const SIG = "sig_01m1b90pz1z1bwfnfawd4rp4gd";
const CTX = { base_url: "https://agentsignal.vip", synced_at: "2026-09-08T19:00:00.000Z" };

function solution(): TranscodeInput {
  return {
    id: SIG,
    topic: "ai-research",
    kind: "solution",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    created_at: "2026-09-01T10:00:00.000Z",
    experience: {
      format: "markdown",
      body: "## Why\nx\n\n## What worked\n1. y\n\n## Evidence\nz\n\n## Caveats\nw\n",
    },
  };
}

/** fake fetch 记录调用并返回固定响应（零真实网络） */
function fakeFetch(status: number, calls: { path: string; body?: string; auth?: string }[] = []) {
  return (async (input: string | URL, init?: RequestInit) => {
    calls.push({
      path: String(input).replace(/^https?:\/\/[^/]+/, ""),
      body: typeof init?.body === "string" ? init.body : undefined,
      auth: (init?.headers as Record<string, string>)?.authorization,
    });
    return new Response(JSON.stringify({ id: SIG, total: 1, worked: 1, partial: 0, failed: 0 }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-mirror-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("mirror off：零网络请求，只给手动回传提示", async () => {
  const calls: { path: string }[] = [];
  const out = await mirrorPlatformVerify({
    sigId: SIG,
    verdict: "worked",
    baseUrl: CTX.base_url,
    token: "ags_tok",
    mirrorEnabled: false,
    fetchImpl: fakeFetch(200, calls),
  });
  assert.equal(out.mirrored, false);
  assert.ok(out.hint?.includes(`agentsignal verify ${SIG}`));
  assert.deepEqual(calls, [], "off 时不得发起任何网络请求");
});

test("mirror on：调用一次带 verdict 与 Bearer", async () => {
  const calls: { path: string; body?: string; auth?: string }[] = [];
  const out = await mirrorPlatformVerify({
    sigId: SIG,
    verdict: "partial",
    baseUrl: CTX.base_url,
    token: "ags_tok",
    mirrorEnabled: true,
    fetchImpl: fakeFetch(200, calls),
  });
  assert.equal(out.mirrored, true);
  assert.equal(out.platform_status, 200);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call, "应恰好一次调用");
  assert.equal(call.path, `/signals/${SIG}/verify`);
  assert.deepEqual(JSON.parse(call.body ?? "{}"), { verdict: "partial" });
  assert.equal(call.auth, "Bearer ags_tok");
  assert.equal(out.hint, undefined);
});

test("mirror on 但无 token：零调用，提示先 register", async () => {
  const calls: { path: string }[] = [];
  const out = await mirrorPlatformVerify({
    sigId: SIG,
    verdict: "worked",
    baseUrl: CTX.base_url,
    token: undefined,
    mirrorEnabled: true,
    fetchImpl: fakeFetch(200, calls),
  });
  assert.equal(out.mirrored, false);
  assert.ok(out.hint?.includes("register"));
  assert.deepEqual(calls, []);
});

test("平台失败（5xx）：不抛异常，本地裁决不受影响", async () => {
  const calls: { path: string }[] = [];
  const out = await mirrorPlatformVerify({
    sigId: SIG,
    verdict: "failed",
    baseUrl: CTX.base_url,
    token: "ags_tok",
    mirrorEnabled: true,
    fetchImpl: fakeFetch(500, calls),
  });
  assert.equal(out.mirrored, false);
  assert.equal(out.platform_status, 500);
  assert.ok(out.hint?.includes("本地裁决不受影响"));
});

test("mirrorContextForSkill：无 provenance 技能 → null；平台技能 → 开关读自 config.sync", async () => {
  const { writeConfigAtomic, defaultConfig } = await import("../src/skills/config.ts");
  const { resolvePaths } = await import("../src/skills/paths.ts");
  const paths = resolvePaths();
  // 引擎 config 先落盘（默认 mirror_verify=false），再装一条平台技能
  await writeConfigAtomic(defaultConfig());
  await installSignal(solution(), CTX);

  const none = await mirrorContextForSkill("sig_not_installed", paths);
  assert.equal(none, null, "未安装/无 provenance 的技能无镜像上下文");

  const ctx = await mirrorContextForSkill(SIG, paths);
  assert.ok(ctx, "带 provenance 的技能应有镜像上下文");
  assert.equal(ctx.sigId, SIG);
  assert.equal(ctx.baseUrl, CTX.base_url);
  assert.equal(ctx.mirrorEnabled, false, "默认 mirror_verify=false");

  // 开关打开 → mirrorEnabled true
  const cfg2 = defaultConfig();
  cfg2.sync.mirror_verify = true;
  await writeConfigAtomic(cfg2);
  const ctx2 = await mirrorContextForSkill(SIG, paths);
  assert.equal(ctx2?.mirrorEnabled, true);
});
