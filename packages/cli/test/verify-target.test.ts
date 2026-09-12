/**
 * local-capability-plane P5 5.1 单测：verify_target 补实现（{statement, checks[]}）。
 *
 * 三态判定可关联目标：verifySkill 结果带归一后的 verify_target（Agent 判定依据）。
 * 旧 skill.json5 零破坏（null 兼容读）：旧 null / 旧数组（字符串清单）两种历史形态
 * 均可过 schema，引擎层 normalizeVerifyTarget 归一，scanSkills/verifySkill 全链不报错。
 * 夹具 = AGENTSIGNAL_CONFIG 临时目录，不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { SkillFrontmatterSchema } from "../../protocol/src/skill-schema.ts";
import { bumpSkillMetrics } from "../src/skills/lifecycle.ts";
import { loadDetail } from "../src/skills/loader.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { scanSkills } from "../src/skills/store.ts";
import { normalizeVerifyTarget, verifySkill } from "../src/skills/verify.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-vtarget-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  delete process.env.AGENTSIGNAL_CONFIG;
  if (root) await rm(root, { recursive: true, force: true });
});

/** 直接落一个旧形态技能目录（绕过 installSignal，模拟历史存量） */
async function seedLegacySkill(id: string, verifyTarget: unknown): Promise<void> {
  const dir = path.join(root, "skills", id);
  await mkdir(dir, { recursive: true });
  const meta = {
    id,
    name: `技能 ${id}`,
    description: `${id} 的经验`,
    domains: ["common"],
    layers: ["base"],
    triggers: [{ field: "keyword", operator: "contains_any", values: [id] }],
    verify_target: verifyTarget,
  };
  await writeFile(path.join(dir, "skill.json5"), JSON.stringify(meta), "utf8");
  await writeFile(path.join(dir, "SKILL.md"), "## 正文\n", "utf8");
}

test("schema：新对象 {statement, checks[]} 可解析", () => {
  const fm = SkillFrontmatterSchema.parse({
    id: "skill_a",
    name: "a",
    description: "a",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
    verify_target: { statement: "HS256 校验通过", checks: ["签名匹配", "exp 未过期"] },
  });
  const vt = fm.verify_target;
  if (vt === undefined || vt === null || Array.isArray(vt)) {
    throw new Error("新对象形态应解析为 {statement, checks}");
  }
  assert.equal(vt.statement, "HS256 校验通过");
  assert.deepEqual(vt.checks, ["签名匹配", "exp 未过期"]);
});

test("schema：旧 null / 旧数组 / 缺省 三种历史形态零破坏（不抛）", () => {
  const base = {
    id: "skill_a",
    name: "a",
    description: "a",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
  };
  const nulled = SkillFrontmatterSchema.parse({ ...base, verify_target: null });
  assert.equal(nulled.verify_target, null);
  const legacy = SkillFrontmatterSchema.parse({ ...base, verify_target: ["旧目标一", "旧目标二"] });
  assert.deepEqual(legacy.verify_target, ["旧目标一", "旧目标二"]);
  const absent = SkillFrontmatterSchema.parse(base);
  assert.equal(absent.verify_target, undefined);
});

test("normalizeVerifyTarget：新对象原样 · null/缺省 → null · 旧数组归一（statement=首条）· 空数组 → null", () => {
  assert.deepEqual(normalizeVerifyTarget({ statement: "s", checks: ["c1"] }), {
    statement: "s",
    checks: ["c1"],
  });
  assert.equal(normalizeVerifyTarget(null), null);
  assert.equal(normalizeVerifyTarget(undefined), null);
  assert.deepEqual(normalizeVerifyTarget(["旧一", "旧二"]), {
    statement: "旧一",
    checks: ["旧一", "旧二"],
  });
  assert.equal(normalizeVerifyTarget([]), null);
});

test("旧技能全链零破坏：scanSkills 读 null/数组形态不报错", async () => {
  await seedLegacySkill("skill_legacy_null", null);
  await seedLegacySkill("skill_legacy_arr", ["旧目标一"]);
  const { skills, errors } = await scanSkills(resolvePaths(root));
  assert.deepEqual(errors, []);
  assert.ok(skills.some((s) => s.id === "skill_legacy_null"));
  assert.ok(skills.some((s) => s.id === "skill_legacy_arr"));
});

test("verifySkill：三态判定可关联目标——结果带归一 verify_target（新形态）", async () => {
  await seedLegacySkill("skill_vt_new", { statement: "HS256 校验通过", checks: ["签名匹配"] });
  const r = await verifySkill("skill_vt_new", "worked", resolvePaths(root));
  assert.equal(r.verdict, "worked");
  assert.deepEqual(r.verify_target, { statement: "HS256 校验通过", checks: ["签名匹配"] });
});

test("verifySkill：旧数组形态归一后关联；null 形态 target=null 不抛", async () => {
  const r1 = await verifySkill("skill_legacy_arr", "partial", resolvePaths(root));
  assert.deepEqual(r1.verify_target, { statement: "旧目标一", checks: ["旧目标一"] });
  const r2 = await verifySkill("skill_legacy_null", "failed", resolvePaths(root));
  assert.equal(r2.verify_target, null);
});

/* ---------------- P5 5.3 三计数分立 ---------------- */

test("bumpSkillMetrics：retrieved/injected 各 +1（批量多 id 一次写回）", async () => {
  await seedLegacySkill("skill_count_a", null);
  await seedLegacySkill("skill_count_b", null);
  const paths = resolvePaths(root);
  await bumpSkillMetrics(["skill_count_a", "skill_count_b"], "retrieved", paths);
  await bumpSkillMetrics(["skill_count_a"], "injected", paths);
  const { skills } = await scanSkills(paths);
  const a = skills.find((s) => s.id === "skill_count_a");
  const b = skills.find((s) => s.id === "skill_count_b");
  assert.equal(a?.lifecycle.metrics.retrieved, 1);
  assert.equal(a?.lifecycle.metrics.injected, 1);
  assert.equal(b?.lifecycle.metrics.retrieved, 1);
  assert.equal(b?.lifecycle.metrics.injected, 0);
  assert.equal(a?.lifecycle.metrics.use_count, 0, "bump 不动 used（=use_count，仅 verify 加）");
});

test("三路径各 +1（V1）：检索（bump retrieved）→ 注入（loadDetail injected）→ 使用（verify used）", async () => {
  await seedLegacySkill("skill_vt_new", { statement: "HS256 校验通过", checks: ["签名匹配"] });
  const paths = resolvePaths(root);
  // ① 检索命中
  await bumpSkillMetrics(["skill_vt_new"], "retrieved", paths);
  // ② 注入上下文
  const detail = await loadDetail("skill_vt_new", paths);
  assert.ok(detail.ok);
  // ③ 使用回报
  await verifySkill("skill_vt_new", "worked", paths);
  const { skills } = await scanSkills(paths);
  const m = skills.find((s) => s.id === "skill_vt_new")?.lifecycle.metrics;
  assert.equal(m?.retrieved, 1, "检索 +1");
  assert.equal(m?.injected, 1, "注入 +1");
  assert.equal(m?.use_count, 1, "使用 +1（used = use_count 语义）");
});

test("旧记录零破坏：无 retrieved/injected 键的旧库读入 default 0", () => {
  const fm = SkillFrontmatterSchema.parse({
    id: "skill_a",
    name: "a",
    description: "a",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
    lifecycle: { status: "solidified", metrics: { use_count: 3 } },
  });
  assert.equal(fm.lifecycle.metrics.retrieved, 0);
  assert.equal(fm.lifecycle.metrics.injected, 0);
  assert.equal(fm.lifecycle.metrics.use_count, 3);
});
