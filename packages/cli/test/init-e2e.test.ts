/**
 * init 全链路 e2e（skill-engine 1.5/1.7 · node:test 夹具版）。
 *
 * 真实子进程跑 `agentsignal init --yes`（无浏览器 → --yes 缺省直通），在全新临时
 * AGENTSIGNAL_CONFIG / AGENTSIGNAL_HOME 上验证：示例经验落盘 → config 生成 →
 * 宿主接线（Cursor）→ status 体检 → uninstall 摘除不残留。不碰真实宿主配置。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import JSON5 from "json5";
import { resolvePaths } from "../src/skills/paths.ts";

const CLI = path.resolve(import.meta.dirname, "../src/index.ts");
let root = "";
let home = "";
let work = ""; // use --install 物化目录（防写进仓库根）
const saved: Record<string, string | undefined> = {};

function runCli(
  args: string[],
  env: Record<string, string>,
  cwd = work,
): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      out += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, out }));
  });
}

const env = () => ({
  AGENTSIGNAL_CONFIG: root,
  AGENTSIGNAL_HOME: home,
  AGENTSIGNAL_BASE: "http://localhost:9", // 无后端依赖，隔离 e2e
  CI: "1",
});

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-init-"));
  home = await mkdtemp(path.join(tmpdir(), "as-init-home-"));
  work = await mkdtemp(path.join(tmpdir(), "as-init-work-"));
  saved.AGENTSIGNAL_CONFIG = process.env.AGENTSIGNAL_CONFIG;
  saved.AGENTSIGNAL_HOME = process.env.AGENTSIGNAL_HOME;
  await mkdir(path.join(home, ".cursor"), { recursive: true });
  await writeFile(path.join(home, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: {} }));
  await mkdir(path.join(home, ".claude"), { recursive: true });
  await writeFile(path.join(home, ".claude.json"), JSON.stringify({ mcpServers: {} }));
  await writeFile(
    path.join(home, ".claude", "settings.json"),
    JSON.stringify({
      hooks: {
        UserPromptSubmit: [
          { id: "agentsignal-context", type: "command", command: "agentsignal context" },
        ],
      },
    }),
  );
});

after(async () => {
  if (saved.AGENTSIGNAL_CONFIG === undefined) delete process.env.AGENTSIGNAL_CONFIG;
  else process.env.AGENTSIGNAL_CONFIG = saved.AGENTSIGNAL_CONFIG;
  if (saved.AGENTSIGNAL_HOME === undefined) delete process.env.AGENTSIGNAL_HOME;
  else process.env.AGENTSIGNAL_HOME = saved.AGENTSIGNAL_HOME;
  await rm(root, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
  await rm(work, { recursive: true, force: true });
});

test("一条命令全链路：init --yes → 示例技能 + config + 宿主接线", async () => {
  const { code, out } = await runCli(["init", "--yes", "--no-open"], env());
  assert.equal(code, 0, out);
  const paths = resolvePaths(root);

  // 示例技能 2-3 个落盘
  const skills = await readdir(paths.skillsDir);
  assert.ok(skills.length >= 2, `示例经验应落盘：${skills}`);
  assert.ok(skills.includes("skill_code_style"));
  assert.ok(skills.includes("skill_auth_jwt"));

  // config 生成
  const cfg = JSON5.parse(await readFile(paths.configFile, "utf8"));
  assert.deepEqual(
    cfg.layers.map((l: { id: string }) => l.id),
    ["base", "domain", "task", "session"],
  );

  // 宿主接线：cursor（json）wired；claude-code 同样写入 agentsignal mcp
  const cursor = JSON.parse(await readFile(path.join(home, ".cursor", "mcp.json"), "utf8"));
  assert.deepEqual(cursor.mcpServers.agentsignal, { command: "agentsignal", args: ["mcp"] });
  const claude = JSON.parse(await readFile(path.join(home, ".claude.json"), "utf8"));
  assert.deepEqual(claude.mcpServers.agentsignal, { command: "agentsignal", args: ["mcp"] });
  const settings = JSON.parse(await readFile(path.join(home, ".claude", "settings.json"), "utf8"));
  assert.match(JSON.stringify(settings.hooks ?? {}), /agentsignal-context/, "推接线段落应写入");
});

test("status 体检：双指标与接线状态口径正确", async () => {
  const { code, out } = await runCli(["status"], env());
  assert.equal(code, 0, out);
  assert.match(out, /配置：✓/);
  assert.match(out, /已接线/);
  assert.match(out, /吞吐节省|残留占用/);
  assert.match(out, /bytes ÷ 4/);
  assert.match(out, /Intl\.Segmenter ✓/);
});

/* ── P1.3 use --install 全链（dynamic-skill-management）──────────────────────
 * 回环 http 服务扮演平台（零外部依赖）：子进程 `use <sig> --install` 取全文落库 →
 * search_skills 命中（吞吐节省非零）→ verify_skill 落裁决 + mirror off 只提示零网络 →
 * uninstall 后本地库保留（含装入库的技能，见下方 uninstall 测试加强断言）。
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { skillTools } from "../src/mcp/skillTools.ts";
import { createEngine } from "../src/skills/engine.ts";

const SIG_E2E = "sig_01e2einstalltest00000000000000";
const E2E_BODY =
  "## Why\n固定分块切断语义\n\n## What worked\n1. 按标题分块\n\n## Evidence\n命中率 +18%\n\n## Caveats\n纯代码不适用\n";

test("use --install 全链：子进程取回环平台信号落库 → 检索命中 → 物化文件落 cwd", async () => {
  const server = createServer((req, res) => {
    if (req.url?.startsWith(`/signals/${SIG_E2E}`)) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: SIG_E2E,
          kind: "solution",
          topic: "ai-research",
          topic_id: "tp_e2e",
          digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
          created_at: "2026-09-01T10:00:00.000Z",
          experience: { format: "markdown", body: E2E_BODY },
        }),
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const { code, out } = await runCli(["use", SIG_E2E, "--install"], {
      ...env(),
      AGENTSIGNAL_BASE: base,
    });
    assert.equal(code, 0, out);
    assert.match(out, /已装入本机经验库/, out);
    // 物化文件落在 cwd 且为 as-<sig_id>.md（--out 缺省修复的回归断言）
    const materialized = await readFile(path.join(work, `as-${SIG_E2E}.md`), "utf8");
    assert.ok(materialized.includes("## What worked"));
  } finally {
    server.close();
  }

  // 检索命中（search_skills 同款引擎路径）
  const engine = await createEngine(root);
  const tools = Object.fromEntries(skillTools().map((t) => [t.name, t]));
  const searchTool = tools.search_skills;
  assert.ok(searchTool, "search_skills 工具应存在");
  const searchOut = JSON.parse(await searchTool.run({ query: "语义分块" }, engine)) as {
    hits: { id: string }[];
  };
  assert.ok(
    searchOut.hits.some((h) => h.id === SIG_E2E),
    `检索应命中装入库的技能：${JSON.stringify(searchOut)}`,
  );
});

test("verify_skill：本地裁决落库 + mirror off 只提示零网络；status 双指标非零", async () => {
  const engine = await createEngine(root);
  const tools = Object.fromEntries(skillTools().map((t) => [t.name, t]));
  const verifyTool = tools.verify_skill;
  assert.ok(verifyTool, "verify_skill 工具应存在");
  const out = JSON.parse(
    await verifyTool.run({ skill_id: SIG_E2E, verdict: "worked" }, engine),
  ) as { ok: boolean; metrics: { worked: number }; mirror?: { mirrored: boolean; hint?: string } };
  assert.equal(out.ok, true);
  assert.equal(out.metrics.worked, 1);
  assert.equal(out.mirror?.mirrored, false, "默认 mirror_verify=false 不回传");
  assert.match(out.mirror?.hint ?? "", new RegExp(`agentsignal verify ${SIG_E2E}`));

  const { code, out: statusOut } = await runCli(["status"], env());
  assert.equal(code, 0, statusOut);
  assert.doesNotMatch(statusOut, /吞吐节省 0 tokens/, "search 命中后吞吐节省应非零");
});

test("uninstall：全量摘除不残留（MCP 条目 + hooks），本地库保留", async () => {
  const { code, out } = await runCli(["uninstall"], env());
  assert.equal(code, 0, out);
  assert.match(out, /本地库保留在/);
  const cursor = JSON.parse(await readFile(path.join(home, ".cursor", "mcp.json"), "utf8"));
  assert.equal(cursor.mcpServers?.agentsignal, undefined, "摘除后不得残留");
  const claude = JSON.parse(await readFile(path.join(home, ".claude.json"), "utf8"));
  assert.equal(claude.mcpServers?.agentsignal, undefined);
  const settings = JSON.parse(await readFile(path.join(home, ".claude", "settings.json"), "utf8"));
  assert.equal(
    JSON.stringify(settings.hooks ?? {}).includes("agentsignal-context"),
    false,
    "hook 片段应摘除",
  );
  // 本地库保留（含 use --install 装入库的平台技能）
  const kept = await readdir(path.join(root, "skills"));
  assert.ok(kept.length >= 2);
  assert.ok(kept.includes(SIG_E2E), "卸载后装入库的平台技能应保留");
});
