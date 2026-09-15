/**
 * P4 4.1 导出器单测（local-capability-plane · node:test 单口径）。
 *
 * 本地技能 → apm.yml + .apm/skills/<id>/SKILL.md（对齐 APM 语义，零工具可读）。
 * DoD：布局快照一致（两次导出字节级确定性）；S10 私有元数据零泄漏进产物。
 * 夹具 = installSignal 落库（provenance 全录，验证导出不泄漏溯源）。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import JSON5 from "json5";
import { exportApm, importApm } from "../src/capability/export.ts";
import { installSignal } from "../src/skills/install.ts";
import { loadDetail } from "../src/skills/loader.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { scanSkills } from "../src/skills/store.ts";
import type { TranscodeContext, TranscodeInput } from "../src/skills/transcoder.ts";

let root = "";
let outDir = "";
const CTX: TranscodeContext = {
  base_url: "https://agentsignal.vip",
  synced_at: "2026-09-15T00:00:00.000Z",
};

async function seed(sig: string, claim: string): Promise<void> {
  const input: TranscodeInput = {
    id: sig,
    topic: "rag",
    kind: "solution",
    digest: `${claim} | scope: 中文RAG | validation: self-tested`,
    experience: { format: "markdown", body: `## Why\n${claim}\n` },
  };
  await installSignal(input, CTX, resolvePaths(root));
}

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-export-"));
  await seed("sig_01exporta0000000000000", "经验 A");
  await seed("sig_01exportb0000000000000", "经验 B");
  await seed("sig_01ext43pure00000000000", "4.3 专属纯净样例"); // 4.3 专用（4.2 导入会覆写共享样例）
  outDir = path.join(root, "export-out");
});

after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("导出布局：apm.yml + .apm/skills/<id>/SKILL.md 各就位（DoD 布局快照）", async () => {
  const files = await exportApm(
    ["sig_01exporta0000000000000", "sig_01exportb0000000000000"],
    outDir,
    resolvePaths(root),
  );
  assert.equal(files.length, 4, "2 SKILL.md + 1 extensions.json5 + 1 apm.yml");
  for (const f of files) await stat(f);
  const top = await readdir(outDir);
  assert.deepEqual(top.sort(), [".apm", "apm.yml"]);
  const md = await readFile(
    path.join(outDir, ".apm", "skills", "sig_01exporta0000000000000", "SKILL.md"),
    "utf8",
  );
  assert.ok(
    md.startsWith(`---\nname: "sig_01exporta0000000000000"\ndescription: `),
    "产物首部合规",
  );
});

test("apm.yml 确定性：两次导出字节级一致 + 私有键零泄漏（S10）", async () => {
  const out2 = path.join(root, "export-out2");
  await exportApm(
    ["sig_01exporta0000000000000", "sig_01exportb0000000000000"],
    out2,
    resolvePaths(root),
  );
  const y1 = await readFile(path.join(outDir, "apm.yml"), "utf8");
  const y2 = await readFile(path.join(out2, "apm.yml"), "utf8");
  assert.equal(y1, y2, "布局快照一致（确定性）");
  for (const priv of [
    "triggers",
    "layers",
    "domains",
    "keywords",
    "provenance",
    "agentsignal.vip",
  ]) {
    assert.ok(!y1.includes(priv), `apm.yml 不得含私有键/溯源：${priv}`);
  }
  const md = await readFile(
    path.join(outDir, ".apm", "skills", "sig_01exportb0000000000000", "SKILL.md"),
    "utf8",
  );
  assert.ok(!md.includes("provenance") && !md.includes("layers"), "产物 SKILL.md 零泄漏");
});

test("未知 id：结构化跳过（skipped 带原因），其余照常导出", async () => {
  const out3 = path.join(root, "export-out3");
  const r = await exportApm(
    ["sig_01exporta0000000000000", "sig_unknown"],
    out3,
    resolvePaths(root),
  );
  assert.equal(r.length, 3, "1 SKILL.md + 1 extensions.json5 + 1 apm.yml（未知 id 跳过）");
  const y = await readFile(path.join(out3, "apm.yml"), "utf8");
  assert.ok(y.includes("sig_01exporta0000000000000"));
  assert.ok(!y.includes("sig_unknown"));
});

test("空 id 列表：空包结构（apm.yml 空 skills 段）不炸", async () => {
  const out4 = path.join(root, "export-out4");
  const r = await exportApm([], out4, resolvePaths(root));
  assert.equal(r.length, 2, "extensions.json5 + apm.yml");
  const y = await readFile(path.join(out4, "apm.yml"), "utf8");
  assert.ok(y.includes("skills: []") || y.includes("skills:[]"));
});

/* ---------------- P4 4.2 导入器（origin=apm-import） ---------------- */

test("导入：4.1 导出物 → 本地库（scan 可见 · origin=apm-import 溯源）", async () => {
  const paths = resolvePaths(root);
  const r = await importApm(outDir, paths);
  assert.equal(r.imported.length, 2, "两条技能导入");
  const { skills } = await scanSkills(paths);
  const a = skills.find((s) => s.id === "sig_01exporta0000000000000");
  assert.ok(a, "导入后本地库可见");
  assert.equal(a?.lifecycle.provenance?.origin?.kind, "apm-import", "溯源 origin=apm-import");
  assert.equal(a?.lifecycle.provenance?.origin?.ref, "agentsignal-export", "ref=yml 包名");
});

test("S10 往返：标准部分无损——导入后正文与导出产物一致（私有元数据不回转）", async () => {
  const paths = resolvePaths(root);
  const md = await readFile(
    path.join(outDir, ".apm", "skills", "sig_01exporta0000000000000", "SKILL.md"),
    "utf8",
  );
  const detail = await loadDetail("sig_01exporta0000000000000", paths);
  assert.ok(detail.ok);
  assert.equal(
    detail.body,
    md.replace(/^---\n[\s\S]*?\n---\n\n/, ""),
    "正文逐字往返（首部剥离后）",
  );
  const { skills } = await scanSkills(paths);
  const a = skills.find((s) => s.id === "sig_01exporta0000000000000");
  // 4.3 升级：私有 triggers 从扩展文件恢复原始值（往返无损升级——不再是安全默认）
  assert.deepEqual(a?.triggers, [
    {
      field: "keyword",
      operator: "contains_any",
      values: ["rag", "中文RAG"],
      weight: 1,
    },
  ]);
});

test("4.2 坏条目结构化跳过：产物首部缺失 → skipped 带原因、不阻塞其余", async () => {
  const badDir = path.join(root, "bad-apm");
  await mkdir(path.join(badDir, ".apm", "skills", "skill_good"), { recursive: true });
  await mkdir(path.join(badDir, ".apm", "skills", "skill_bad"), { recursive: true });
  await writeFile(
    path.join(badDir, "apm.yml"),
    "name: bad-pkg\nversion: 0.1.0\nskills:\n  - name: skill_good\n    path: .apm/skills/skill_good/SKILL.md\n  - name: skill_bad\n    path: .apm/skills/skill_bad/SKILL.md\n",
    "utf8",
  );
  await writeFile(
    path.join(badDir, ".apm", "skills", "skill_good", "SKILL.md"),
    '---\nname: "skill_good"\ndescription: "ok"\n---\n\n正文\n',
    "utf8",
  );
  // skill_bad 的 SKILL.md 缺产物首部（坏条目）
  await writeFile(
    path.join(badDir, ".apm", "skills", "skill_bad", "SKILL.md"),
    "无首部正文\n",
    "utf8",
  );
  const paths = resolvePaths(root);
  const r = await importApm(badDir, paths);
  assert.deepEqual(r.imported, ["skill_good"], "好条目照常导入");
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0]?.id, "skill_bad");
  assert.ok(r.skipped[0]?.reason.includes("首部"), "坏条目带原因（首部缺失）");
});

/* ---------------- P4 4.3 扩展 JSON（私有增强独立文件） ---------------- */

test("4.3 导出：私有增强写独立 extensions.json5（apm.yml/SKILL.md 仍零泄漏）", async () => {
  const out5 = path.join(root, "export-out5");
  await exportApm(["sig_01ext43pure00000000000"], out5, resolvePaths(root));
  const extPath = path.join(out5, ".apm", "extensions.json5");
  await stat(extPath);
  const ext = JSON5.parse(await readFile(extPath, "utf8")) as {
    skills: Record<string, { domains: string[]; layers: string[]; triggers: unknown[] }>;
  };
  const priv = ext.skills.sig_01ext43pure00000000000;
  assert.ok(priv, "该技能的私有增强在扩展文件");
  assert.deepEqual(priv.domains, ["中文RAG"], "原始 domains 保真（非导出默认）");
  assert.ok(priv.triggers.length > 0, "原始 triggers 保真");
  const y = await readFile(path.join(out5, "apm.yml"), "utf8");
  assert.ok(!y.includes("triggers"), "标准清单仍零泄漏");
});

test("4.3 导入：带 extensions 的包恢复原始私有字段（往返无损升级）", async () => {
  const out6 = path.join(root, "export-out6");
  await exportApm(["sig_01ext43pure00000000000"], out6, resolvePaths(root));
  const paths = resolvePaths(root);
  const r = await importApm(out6, paths);
  assert.equal(r.imported.length, 1);
  const { skills } = await scanSkills(paths);
  const a = skills.find((s) => s.id === "sig_01ext43pure00000000000");
  assert.deepEqual(a?.domains, ["中文RAG"], "私有 domains 从扩展文件恢复（不再是安全默认 common）");
  assert.deepEqual(a?.lifecycle.provenance?.origin?.kind, "apm-import", "导入溯源仍记 apm-import");
});

test("4.3 兼容：无 extensions 文件的包导入仍走安全默认（4.2 行为不变）", async () => {
  const paths = resolvePaths(root);
  const r = await importApm(outDir, paths); // outDir 是 4.1 早期导出（无 extensions.json5）
  assert.ok(r.imported.length > 0);
  const { skills } = await scanSkills(paths);
  const a = skills.find((s) => s.id === "sig_01exporta0000000000000");
  assert.ok(a, "导入不炸");
});
