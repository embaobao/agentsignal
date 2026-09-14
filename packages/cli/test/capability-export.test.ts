/**
 * P4 4.1 导出器单测（local-capability-plane · node:test 单口径）。
 *
 * 本地技能 → apm.yml + .apm/skills/<id>/SKILL.md（对齐 APM 语义，零工具可读）。
 * DoD：布局快照一致（两次导出字节级确定性）；S10 私有元数据零泄漏进产物。
 * 夹具 = installSignal 落库（provenance 全录，验证导出不泄漏溯源）。
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { exportApm } from "../src/capability/export.ts";
import { installSignal } from "../src/skills/install.ts";
import { resolvePaths } from "../src/skills/paths.ts";
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
  assert.equal(files.length, 3, "2 SKILL.md + 1 apm.yml");
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
  assert.equal(r.length, 2, "1 SKILL.md + 1 apm.yml（未知 id 跳过）");
  const y = await readFile(path.join(out3, "apm.yml"), "utf8");
  assert.ok(y.includes("sig_01exporta0000000000000"));
  assert.ok(!y.includes("sig_unknown"));
});

test("空 id 列表：空包结构（apm.yml 空 skills 段）不炸", async () => {
  const out4 = path.join(root, "export-out4");
  const r = await exportApm([], out4, resolvePaths(root));
  assert.equal(r.length, 1, "仅 apm.yml");
  const y = await readFile(path.join(out4, "apm.yml"), "utf8");
  assert.ok(y.includes("skills: []") || y.includes("skills:[]"));
});
