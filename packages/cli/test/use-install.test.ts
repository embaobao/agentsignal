/**
 * P1.1 use --install 单条装载单测（dynamic-skill-management · node:test 单口径）。
 *
 * 覆盖：落库 skills/<sig_id>/（skill.json5 + SKILL.md）· provenance 全录 ·
 * 索引落盘后经 ensureIndex 加载即可检索命中（save/load 全链）· 同 id 重复装载幂等 ·
 * kind≠solution 拒转不落库 · 正文逐字保留。
 * 零网络零外部依赖：临时目录夹具（AGENTSIGNAL_CONFIG），网络发生在 index.ts use 分支。
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import JSON5 from "json5";
import { installSignal } from "../src/skills/install.ts";
import { ensureIndex, oramaSearch, scanSkills } from "../src/skills/store.ts";
import { TranscodeError, type TranscodeInput } from "../src/skills/transcoder.ts";

const CTX = { base_url: "https://agentsignal.vip", synced_at: "2026-09-08T18:00:00.000Z" };
const SIG_ID = "sig_01m1b90pz1z1bwfnfawd4rp4gd";
const BODY =
  "## Why\n固定分块切断语义\n\n## What worked\n1. 按标题分块\n2. 512 token 上限\n\n## Evidence\n本地 RAG 命中率 +18%\n\n## Caveats\n纯代码文件不适用\n";

function solution(overrides: Partial<TranscodeInput> = {}): TranscodeInput {
  return {
    id: SIG_ID,
    topic: "ai-research",
    kind: "solution",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    created_at: "2026-09-01T10:00:00.000Z",
    experience: { format: "markdown", body: BODY },
    ...overrides,
  };
}

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-use-install-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

test("installSignal：落库两件套 + provenance 全录 + 正文逐字", async () => {
  const { dir } = await installSignal(solution(), CTX);
  assert.ok(dir.includes(SIG_ID), `目录名含 sig id：${dir}`);
  const meta = JSON5.parse(await readFile(path.join(dir, "skill.json5"), "utf8")) as {
    lifecycle: { provenance?: Record<string, string> };
  };
  assert.equal(meta.lifecycle.provenance?.sig_id, SIG_ID);
  assert.equal(meta.lifecycle.provenance?.topic, "ai-research");
  assert.equal(meta.lifecycle.provenance?.validation, "self-tested");
  assert.equal(meta.lifecycle.provenance?.base_url, CTX.base_url);
  // P0.3 产物格式：首部产物 frontmatter（name=目录名）+ 正文逐字
  const md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  assert.ok(md.startsWith(`---\nname: "${SIG_ID}"\ndescription: `), "产物首部 name=目录名");
  assert.ok(md.endsWith(BODY), "正文逐字保留在首部之后");
});

test("索引：落库后 ensureIndex 加载即可检索命中（save/load 全链）", async () => {
  const { skills } = await scanSkills();
  assert.equal(skills.length, 1);
  const { db } = await ensureIndex(skills);
  const hits = await oramaSearch(db, "语义分块");
  assert.ok(
    hits.some((h) => h.id === SIG_ID),
    `检索应命中 ${SIG_ID}：${JSON.stringify(hits)}`,
  );
});

test("同 id 重复装载幂等：仍一条、零错误", async () => {
  await installSignal(solution(), CTX);
  const { skills, errors } = await scanSkills();
  assert.equal(skills.length, 1);
  assert.deepEqual(errors, []);
  assert.equal((await readdir(path.join(root, "skills"))).length, 1);
});

test("kind=update 拒转不落库", async () => {
  await assert.rejects(
    () => installSignal(solution({ kind: "update", id: "sig_01update" }), CTX),
    (err: unknown) => err instanceof TranscodeError && err.code === "KIND_NOT_SOLUTION",
  );
  assert.equal((await readdir(path.join(root, "skills"))).length, 1, "不新增目录");
});
