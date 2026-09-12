/**
 * P0.4 快照测试（local-capability-plane · node:test 单口径）。
 *
 * 正/旧两版样例，锁定产物契约：
 *   - 正样例：installSignal 落库的 SKILL.md 字节级快照（首部产物 frontmatter + 正文）；
 *   - 旧样例：升级前历史库（SKILL.md 无首部 · verify_target:null）经新代码全链
 *     （scanSkills → loadDetail → verifySkill）零破坏——正文逐字、零错误。
 * 夹具 = AGENTSIGNAL_CONFIG 临时目录，不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { installSignal } from "../src/skills/install.ts";
import { loadDetail } from "../src/skills/loader.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { scanSkills } from "../src/skills/store.ts";
import type { TranscodeContext, TranscodeInput } from "../src/skills/transcoder.ts";
import { verifySkill } from "../src/skills/verify.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-snapshot-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  delete process.env.AGENTSIGNAL_CONFIG;
  if (root) await rm(root, { recursive: true, force: true });
});

const CTX: TranscodeContext = {
  base_url: "http://localhost:3000",
  synced_at: "2026-09-13T00:00:00.000Z",
};

function solution(overrides: Partial<TranscodeInput> = {}): TranscodeInput {
  return {
    id: "sig_01snapshot000000000000000",
    topic: "rag",
    kind: "solution",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    experience: {
      format: "markdown",
      body: "## Why\n固定分块切断语义\n\n## What worked\n按标题分块\n",
    },
    ...overrides,
  };
}

/** 旧样例（升级前历史库形态）：SKILL.md 无首部 · skill.json5 verify_target:null · 无 provenance.origin */
async function seedLegacyLibrary(): Promise<void> {
  const dir = path.join(root, "skills", "skill_legacy_old");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "skill.json5"),
    JSON.stringify({
      id: "skill_legacy_old",
      name: "旧版技能",
      description: "升级前落库的技能",
      domains: ["common"],
      layers: ["base"],
      triggers: [{ field: "keyword", operator: "contains_any", values: ["legacy"] }],
      verify_target: null,
      lifecycle: { status: "solidified" },
    }),
    "utf8",
  );
  await writeFile(path.join(dir, "SKILL.md"), "## 旧正文\n\n无首部的历史格式。\n", "utf8");
}

test("正样例快照：installSignal 产物 SKILL.md 字节级快照（首部+正文）", async () => {
  const { dir } = await installSignal(solution(), CTX, resolvePaths(root));
  const md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  assert.equal(
    md,
    `---\nname: "sig_01snapshot000000000000000"\ndescription: "语义分块 beats 固定分块"\n---\n\n## Why\n固定分块切断语义\n\n## What worked\n按标题分块\n`,
  );
});

test("正样例快照：skill.json5 含 origin 且产物 SKILL.md 不含私有键", async () => {
  const { dir } = await installSignal(solution(), CTX, resolvePaths(root));
  const meta = await readFile(path.join(dir, "skill.json5"), "utf8");
  assert.ok(/\borigin\b/.test(meta), "新落库必有 origin（5.2）");
  assert.ok(/\btriggers\b/.test(meta), "私有增强在内部形式");
  const md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  for (const priv of ["triggers", "layers", "domains", "verify_target"]) {
    assert.ok(!md.includes(priv), `私有键 ${priv} 不得泄漏进产物`);
  }
});

test("旧样例升级路径：历史库经新代码全链零破坏（scan 零错误 · loadDetail 正文逐字 · verify 归一）", async () => {
  await seedLegacyLibrary();
  const paths = resolvePaths(root);
  const { skills, errors } = await scanSkills(paths);
  assert.deepEqual(errors, [], "旧库扫描零错误");
  const legacy = skills.find((s) => s.id === "skill_legacy_old");
  assert.ok(legacy, "旧技能可见");

  const detail = await loadDetail("skill_legacy_old", paths);
  assert.ok(detail.ok);
  assert.equal(
    detail.body,
    "## 旧正文\n\n无首部的历史格式。\n",
    "无首部旧正文逐字（strip 不误剥）",
  );

  const v = await verifySkill("skill_legacy_old", "worked", paths);
  assert.equal(v.verify_target, null, "旧 null verify_target 归一为 null");
});
