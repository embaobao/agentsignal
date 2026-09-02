/**
 * 护栏测试 G1+G2 —— participant SKILL 与 CLI 命令面同步一致性（node:test）。
 *
 *   G1 版本 lockstep：SKILL frontmatter metadata.version === @agentssignal/cli 版本
 *      （metadata.cli 的版本锚点同步核对）
 *   G2 命令面双向一致：
 *      ① CLI src 的全部 case 命令必须在 SKILL 正文以 `agentsignal <cmd>` 出现（防漏文档）
 *      ② SKILL 正文中出现的每个 `agentsignal <cmd>` 必须存在于 CLI 命令集（防幽灵命令，
 *        onboarding.md 曾漂移出 join/topics/pull/connect）
 *
 * 设计说明：docs/design/participant-skill-redesign.md §5.2 / openspec changes/participant-skill-cli-sync。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const here = new URL(".", import.meta.url);
const SKILL = readFileSync(new URL("../../../packages/skills/participant/SKILL.md", here), "utf8");
const CLI_SRC = readFileSync(new URL("../src/index.ts", here), "utf8");
const CLI_PKG = JSON.parse(readFileSync(new URL("../package.json", here), "utf8")) as {
  version: string;
};

/** CLI 命令集 = src/index.ts switch 的全部 case 分支（真源，不手抄） */
const COMMANDS = [...CLI_SRC.matchAll(/case "([a-z][a-z-]*)":/g)].map((m) => m[1] as string);

/** SKILL frontmatter（首尾 --- 之间） */
const FRONTMATTER = /^---\n([\s\S]*?)\n---/.exec(SKILL)?.[1] ?? "";

test("G1: SKILL metadata.version 与 @agentssignal/cli 版本 lockstep", () => {
  const version = /^ {2}version:\s*(\S+)$/m.exec(FRONTMATTER)?.[1];
  assert.ok(version, "SKILL frontmatter 缺 metadata.version");
  assert.equal(version, CLI_PKG.version, "SKILL metadata.version 必须等于 packages/cli 版本");

  const cliAnchor = /cli:\s*"@agentssignal\/cli@([^"]+)"/.exec(FRONTMATTER)?.[1];
  assert.ok(cliAnchor, "SKILL frontmatter 缺 metadata.cli 版本锚点");
  assert.equal(cliAnchor, CLI_PKG.version, "metadata.cli 锚点必须等于 packages/cli 版本");
});

test("G2①: CLI 每个命令都在 SKILL 正文以 agentsignal <cmd> 出现（防漏文档）", () => {
  assert.ok(COMMANDS.length >= 5, `命令集提取异常：${COMMANDS.join(",")}`);
  const missing = COMMANDS.filter((cmd) => !new RegExp(`agentsignal ${cmd}\\b`).test(SKILL));
  assert.deepEqual(missing, [], "以下 CLI 命令未在 SKILL.md 文档化");
});

test("G2②: SKILL 中的 agentsignal <cmd> 全部存在于 CLI 命令集（防幽灵命令）", () => {
  const mentioned = new Set(
    [...SKILL.matchAll(/agentsignal ([a-z][a-z-]*)/g)].map((m) => m[1] as string),
  );
  const ghosts = [...mentioned].filter((cmd) => !COMMANDS.includes(cmd));
  assert.deepEqual(ghosts, [], "SKILL 出现了 CLI 不存在的命令（幽灵命令）");
});

/* G4 —— skills.sh（npx skills）分发镜像同步。
 *
 * 顶层 skills/agentsignal-participant/SKILL.md 是 skills.sh 索引器唯一默认扫描的
 * skills/ 前缀位置（packages/skills/… 需 --full-depth 才可见）。它必须与 canonical
 * （packages/skills/participant/SKILL.md）逐字节一致，防止双源漂移。
 */
test("G4: 顶层 skills/ 镜像与 canonical SKILL 逐字节一致（skills.sh 分发）", () => {
  const MIRROR = readFileSync(
    new URL("../../../skills/agentsignal-participant/SKILL.md", here),
    "utf8",
  );
  assert.equal(
    MIRROR,
    SKILL,
    "skills/agentsignal-participant/SKILL.md 必须与 packages/skills/participant/SKILL.md 完全一致——只改 canonical 再复制",
  );
  for (const line of ["name:", "description:"]) {
    assert.ok(MIRROR.includes(line), `镜像 frontmatter 缺 ${line}（skills.sh 索引必需）`);
  }
});
