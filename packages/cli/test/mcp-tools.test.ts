/**
 * MCP 集成测试（skill-engine 1.6 · SDK InMemoryTransport，不起进程不占端口）。
 *
 *   · tools list 恰好 9 个（5 平台 + 3 技能 + 1 管理，含 open_setup）
 *   · search_skills 中文命中（Orama 与 trigger 双路径）
 *   · load_skill_detail 缺依赖返回结构化清单 → 补 env 后得到 mustache 渲染全文
 *   · verify_skill 落本地 metrics
 *   · 参数校验失败 → isError + USAGE_INVALID 结构化 JSON
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import JSON5 from "json5";
import { createMcpServer, type McpRuntime } from "../src/mcp/server.ts";
import { defaultConfig, writeConfigAtomic } from "../src/skills/config.ts";
import { createEngine } from "../src/skills/engine.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { writeSamples } from "../src/skills/samples.ts";
import { createTrace } from "../src/skills/session.ts";

let root = "";
const saved: Record<string, string | undefined> = {};

const AUTH_FRONT = {
  id: "skill_auth_jwt",
  name: "JWT 登录认证",
  description: "实现 JWT 认证、登录与 refresh token 轮换",
  domains: ["common"],
  layers: ["task"],
  triggers: [
    { field: "task", operator: "contains_any", values: ["登录", "auth"], weight: 0.5 },
    { field: "keyword", operator: "contains_any", values: ["认证"], weight: 0.4 },
  ],
  keywords: ["auth", "login", "JWT", "登录"],
  dependencies: { env: ["JWT_SECRET"], bins: [], packages: [] },
  parameters: { token_expiry: { type: "string", default: "1h" } },
};

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-mcp-"));
  saved.AGENTSIGNAL_CONFIG = process.env.AGENTSIGNAL_CONFIG;
  process.env.AGENTSIGNAL_CONFIG = root;
  const paths = resolvePaths(root);
  await writeConfigAtomic(defaultConfig(), paths);
  await writeSamples(paths);
  const dir = path.join(paths.skillsDir, "skill_auth_jwt");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "skill.json5"), JSON5.stringify(AUTH_FRONT, null, 2), "utf8");
  await writeFile(
    path.join(dir, "SKILL.md"),
    "# JWT 登录认证（有效期 {{token_expiry}}）\n\n## What worked\n签发 access token。\n",
    "utf8",
  );
});

after(async () => {
  if (saved.AGENTSIGNAL_CONFIG === undefined) delete process.env.AGENTSIGNAL_CONFIG;
  else process.env.AGENTSIGNAL_CONFIG = saved.AGENTSIGNAL_CONFIG;
  await rm(root, { recursive: true, force: true });
});

async function connect(): Promise<Client> {
  const runtime: McpRuntime = {
    state: "READY",
    engine: await createEngine(root),
    trace: createTrace(resolvePaths(root)),
  };
  const server = await createMcpServer(runtime);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const textOf = (result: unknown): string => {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content.map((c) => c.text).join("\n");
};

test("tools list 恰好 9 个（含 open_setup）", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.equal(tools.length, 9);
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "list_spaces",
    "load_skill_detail",
    "open_setup",
    "publish_signal",
    "query_signals",
    "report_outcome",
    "search_skills",
    "use_signal",
    "verify_skill",
  ]);
  await client.close();
});

test("search_skills：中文查询命中（Orama 路径）", async () => {
  const client = await connect();
  const out = textOf(
    await client.callTool({ name: "search_skills", arguments: { query: "登录 认证" } }),
  );
  const parsed = JSON.parse(out) as { hits: { id: string }[] };
  assert.ok(
    parsed.hits.some((h) => h.id === "skill_auth_jwt"),
    `未命中：${out}`,
  );
  await client.close();
});

test("search_skills：trigger 主路径（task 面）命中", async () => {
  const client = await connect();
  const out = textOf(
    await client.callTool({
      name: "search_skills",
      arguments: { query: "", task: "帮我做用户登录认证" },
    }),
  );
  const parsed = JSON.parse(out) as { hits: { id: string }[] };
  assert.ok(parsed.hits.some((h) => h.id === "skill_auth_jwt"));
  await client.close();
});

test("load_skill_detail：缺 JWT_SECRET → 结构化清单；补齐后得到渲染全文", async () => {
  const savedSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const client = await connect();
  const blocked = await client.callTool({
    name: "load_skill_detail",
    arguments: { skill_id: "skill_auth_jwt" },
  });
  const blockedJson = JSON.parse(textOf(blocked)) as {
    ok: boolean;
    code: string;
    missing: { env: string[] };
  };
  assert.equal(blockedJson.ok, false);
  assert.equal(blockedJson.code, "DEPENDENCIES_MISSING");
  assert.deepEqual(blockedJson.missing.env, ["JWT_SECRET"]);

  process.env.JWT_SECRET = "test-secret";
  const ok = textOf(
    await client.callTool({ name: "load_skill_detail", arguments: { skill_id: "skill_auth_jwt" } }),
  );
  assert.match(ok, /JWT 登录认证/);
  assert.match(ok, /有效期 1h/, "mustache 参数应渲染为默认值");
  await client.close();
  if (savedSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedSecret;
});

test("verify_skill：verdict 落本地 lifecycle.metrics", async () => {
  const client = await connect();
  const out = textOf(
    await client.callTool({
      name: "verify_skill",
      arguments: { skill_id: "skill_auth_jwt", verdict: "worked" },
    }),
  );
  const parsed = JSON.parse(out) as { ok: boolean; metrics: { worked: number; use_count: number } };
  assert.equal(parsed.ok, true);
  assert.equal(parsed.metrics.worked, 1);
  assert.equal(parsed.metrics.use_count, 1);
  await client.close();
});

test("参数校验失败 → isError + 结构化错误（不抛协议异常，模型可读可重试）", async () => {
  const client = await connect();
  const result = (await client.callTool({
    name: "verify_skill",
    arguments: { skill_id: "x", verdict: "maybe" },
  })) as { isError?: boolean; content: { text: string }[] };
  assert.equal(result.isError, true, "非法参数必须以 isError 返回，不得让调用方崩溃");
  const raw = result.content[0]?.text ?? "";
  assert.match(raw, /verdict|invalid|Invalid|error/i);
  await client.close();
});

test("业务失败 → isError + 结构化错误码（模型可读可重试）", async () => {
  const client = await connect();
  const result = (await client.callTool({
    name: "load_skill_detail",
    arguments: { skill_id: "skill_not_exist" },
  })) as { isError?: boolean; content: { text: string }[] };
  assert.equal(result.isError, true);
  const body = JSON.parse(result.content[0]?.text ?? "{}") as {
    error: { code: string; message: string };
  };
  assert.equal(body.error.code, "SKILL_NOT_FOUND");
  assert.match(body.error.message, /skill_not_exist/);
  await client.close();
});
