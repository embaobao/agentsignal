/**
 * 场景 S3（本地半）：验证与回流闭环——三态判定可记录、可关联回上游信号（V1 层，P5 5.5）。
 *
 * 通过标准（本地半）：verifySkill 三态落 lifecycle.metrics + verify_target 归一关联 +
 * provenance.sig_id 溯源到上游信号。平台半聚合回流另立（V3）。
 * fixture：AGENTSIGNAL_CONFIG 临时目录；上游样例经 installSignal 落库（provenance 全录）。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { installSignal } from "../../src/skills/install.ts";
import { resolvePaths } from "../../src/skills/paths.ts";
import { scanSkills } from "../../src/skills/store.ts";
import type { TranscodeContext, TranscodeInput } from "../../src/skills/transcoder.ts";
import { verifySkill } from "../../src/skills/verify.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-sc03-"));
  const paths = resolvePaths(root);
  const input: TranscodeInput = {
    id: "sig_01s3upstream000000000000",
    topic: "rag",
    kind: "solution",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    experience: { format: "markdown", body: "## Why\n分块保语义\n" },
  };
  await installSignal(
    input,
    {
      base_url: "https://agentsignal.vip",
      synced_at: "2026-09-15T00:00:00.000Z",
    } satisfies TranscodeContext,
    paths,
  );
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("S3 本地半：三态判定落库 + verify_target 关联 + 溯源到上游 sig_id", async () => {
  const paths = resolvePaths(root);
  const r = await verifySkill("sig_01s3upstream000000000000", "partial", paths);
  assert.equal(r.verdict, "partial");
  assert.equal(r.verify_target, null, "该样例无 verify_target——null 归一不抛");
  const { skills } = await scanSkills(paths);
  const s = skills.find((x) => x.id === "sig_01s3upstream000000000000");
  assert.equal(s?.lifecycle.metrics.partial, 1, "三态落库");
  assert.equal(s?.lifecycle.provenance?.sig_id, "sig_01s3upstream000000000000", "溯源到上游信号");
  assert.equal(s?.lifecycle.provenance?.origin?.kind, "platform", "origin 溯源（5.2 契约）");
});
