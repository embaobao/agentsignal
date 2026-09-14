/**
 * 场景 S2：使用留痕——检索/注入/使用三计数分立（V1 层，P5 5.5）。
 *
 * 通过标准：被检索 / 被注入 / 被使用**分别计数**（S2 缺口已在 P5 5.3 修复——
 * 原状 use_count 只在 verify 时 +1）。V1 = 临时夹具内全链（公开 API：bump 埋点
 * / loadDetail / verifySkill），断言三计数互不串扰。
 * fixture：AGENTSIGNAL_CONFIG 临时目录，不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { bumpSkillMetrics } from "../../src/skills/lifecycle.ts";
import { loadDetail } from "../../src/skills/loader.ts";
import { resolvePaths } from "../../src/skills/paths.ts";
import { scanSkills } from "../../src/skills/store.ts";
import { verifySkill } from "../../src/skills/verify.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-sc02-"));
  process.env.AGENTSIGNAL_CONFIG = root;
  const dir = path.join(root, "skills", "skill_s2_demo");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "skill.json5"),
    JSON.stringify({
      id: "skill_s2_demo",
      name: "S2 演示",
      description: "三计数场景",
      domains: ["common"],
      layers: ["base"],
      triggers: [],
    }),
    "utf8",
  );
  await writeFile(path.join(dir, "SKILL.md"), "## 正文\n", "utf8");
});
after(async () => {
  delete process.env.AGENTSIGNAL_CONFIG;
  if (root) await rm(root, { recursive: true, force: true });
});

test("S2：检索 +2、注入 +1、使用 +1——三路径分别计数互不串扰", async () => {
  const paths = resolvePaths(root);
  await bumpSkillMetrics(["skill_s2_demo"], "retrieved", paths);
  await bumpSkillMetrics(["skill_s2_demo"], "retrieved", paths);
  await loadDetail("skill_s2_demo", paths);
  await verifySkill("skill_s2_demo", "worked", paths);
  const { skills } = await scanSkills(paths);
  const m = skills.find((s) => s.id === "skill_s2_demo")?.lifecycle.metrics;
  assert.equal(m?.retrieved, 2, "检索计数独立");
  assert.equal(m?.injected, 1, "注入计数独立");
  assert.equal(m?.use_count, 1, "使用计数独立（used 语义）");
});
