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
const saved: Record<string, string | undefined> = {};

function runCli(
  args: string[],
  env: Record<string, string>,
): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
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
  // 本地库保留
  assert.ok((await readdir(path.join(root, "skills"))).length >= 2);
});
