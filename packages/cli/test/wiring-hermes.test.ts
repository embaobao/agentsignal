/**
 * host-matrix-alignment 1.1+1.5 单测（node:test 单口径）。
 *
 * Hermes 宿主注册表打底：HostId 加 hermes · HostDef 增 soulPath/hooksYamlPath/hookAllowlistPath
 * · mcpPath 放宽 string|null（D1/D7：Hermes 不写 MCP）。
 * 夹具 = AGENTSIGNAL_HOME + HERMES_HOME 临时目录，不碰真实宿主配置（AGENTS.md 纪律）。
 * 零垃圾断言：wireMcp/unwireMcp 对 hermes 不产生任何文件（1.5 DoD）。
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { hostById, hostDefs } from "../src/skills/wiring/hosts.ts";
import { hostStatus, unwireMcp, wireMcp } from "../src/skills/wiring/snippets.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-hermes-"));
  process.env.AGENTSIGNAL_HOME = root;
  process.env.HERMES_HOME = path.join(root, ".hermes");
});
after(async () => {
  delete process.env.AGENTSIGNAL_HOME;
  delete process.env.HERMES_HOME;
  if (root) await rm(root, { recursive: true, force: true });
});

test("hostDefs：含 hermes，home = HERMES_HOME 优先，detect = 目录存在", () => {
  const defs = hostDefs();
  const hermes = defs.find((d) => d.id === "hermes");
  assert.ok(hermes, "hermes 应在注册表");
  assert.equal(defs.length, 6, "5 既有宿主 + hermes");
  assert.equal(hermes?.detect(), false, "HERMES_HOME 目录不存在时未探测到");
  const soulPath = hermes?.soulPath ?? "";
  assert.ok(soulPath.startsWith(path.join(root, ".hermes")), "soulPath 在 HERMES_HOME 下");
});

test("hermes HostDef：mcpPath=null（D1/D7 不写 MCP）+ 三新字段路径齐", () => {
  const hermes = hostById("hermes");
  assert.equal(hermes.mcpPath, null);
  assert.ok(hermes.soulPath?.endsWith("SOUL.md"));
  assert.ok(hermes.hooksYamlPath?.endsWith("config.yaml"));
  assert.ok(hermes.hookAllowlistPath?.endsWith("shell-hooks-allowlist.json"));
  assert.equal(hermes.hooks, false, "hooks 走 YAML 双写（1.4），宿主级 hooks 旗标仍 false");
  assert.equal(hermes.rulesPath, null);
});

test("wireMcp(hermes)：零文件产生（不写 MCP/不建目录）", async () => {
  const hermes = hostById("hermes");
  const r = await wireMcp(hermes);
  assert.equal(r.mcp, "absent", "无 MCP 语义下接线即 absent");
  let entries: string[] = [];
  try {
    entries = await readdir(path.join(root, ".hermes"));
  } catch {
    /* 目录不存在 = 零垃圾（期望） */
  }
  assert.deepEqual(entries, [], `HERMES_HOME 下不得有任何文件：${JSON.stringify(entries)}`);
});

test("hostStatus(hermes)：absent 且不抛（null mcpPath 守卫）", async () => {
  const st = await hostStatus(hostById("hermes"));
  assert.equal(st.mcp, "absent");
});

test("unwireMcp(hermes)：零文件操作", async () => {
  const r = await unwireMcp(hostById("hermes"));
  assert.equal(r.mcp, "absent");
});

test("既有 5 宿主回归：claude-code 定义不受 mcpPath 类型放宽影响", () => {
  const cc = hostById("claude-code");
  assert.equal(cc.hooks, true);
  assert.ok(cc.mcpPath?.includes(".claude.json"));
  assert.equal(hostById("codex").toml, true);
});
