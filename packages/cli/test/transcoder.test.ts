/**
 * P0.3 transcoder 单测（dynamic-skill-management · node:test 单口径）。
 *
 * 纯函数信封(solution) → 技能二元组（skill.json5 frontmatter + SKILL.md），
 * 零 IO 零网络。覆盖（tasks.md 0.3）：中文 digest/正文快照 · validation 三档 ·
 * kind≠solution 拒转 · update 锚定提取 · digest 缺段回退 · 转出物过 schema 校验。
 * 决议口径：docs/decisions/2026-09-08-dynamic-skill-management.md 裁决 2。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { SkillFrontmatterSchema } from "../../protocol/src/skill-schema.ts";
import {
  extractAnchorSigId,
  TranscodeError,
  type TranscodeInput,
  transcodeSignal,
} from "../src/skills/transcoder.ts";

const CTX = { base_url: "https://agentsignal.vip", synced_at: "2026-09-08T17:00:00.000Z" };

function solution(overrides: Partial<TranscodeInput> = {}): TranscodeInput {
  return {
    id: "sig_01m1b90pz1z1bwfnfawd4rp4gd",
    topic: "ai-research",
    kind: "solution",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    created_at: "2026-09-01T10:00:00.000Z",
    experience: {
      format: "markdown",
      body: "## Why\n固定分块切断语义\n\n## What worked\n1. 按标题分块\n2. 512 token 上限\n\n## Evidence\n本地 RAG 命中率 +18%\n\n## Caveats\n纯代码文件不适用\n",
    },
    ...overrides,
  };
}

test("中文 digest/正文：全量快照（golden）——六字段必收齐 + provenance 全录 + 正文逐字保留", () => {
  const { frontmatter, body } = transcodeSignal(solution(), CTX);
  assert.equal(frontmatter.id, "sig_01m1b90pz1z1bwfnfawd4rp4gd");
  assert.equal(frontmatter.name, "语义分块 beats 固定分块");
  assert.equal(frontmatter.description, "语义分块 beats 固定分块");
  assert.deepEqual(frontmatter.domains, ["中文RAG"]);
  assert.deepEqual(frontmatter.layers, ["base"]);
  assert.deepEqual(frontmatter.triggers, [
    { field: "keyword", operator: "contains_any", values: ["ai-research", "中文RAG"], weight: 1 },
  ]);
  assert.deepEqual(frontmatter.lifecycle.provenance, {
    sig_id: "sig_01m1b90pz1z1bwfnfawd4rp4gd",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    base_url: "https://agentsignal.vip",
    topic: "ai-research",
    validation: "self-tested",
    published_at: "2026-09-01T10:00:00.000Z",
    synced_at: "2026-09-08T17:00:00.000Z",
  });
  assert.equal(frontmatter.content.tokens_est, 41); // Buffer.byteLength(body)=163 ÷ 4（bytes÷4 口径）
  assert.ok(body.startsWith("## Why\n固定分块切断语义"));
  assert.ok(body.endsWith("纯代码文件不适用\n"));
});

test("validation 三档全映射：none / self-tested / battle-tested", () => {
  for (const v of ["none", "self-tested", "battle-tested"] as const) {
    const sig = solution({ digest: `主张 X | scope: web | validation: ${v}` });
    const { frontmatter } = transcodeSignal(sig, CTX);
    assert.equal(frontmatter.lifecycle.provenance?.validation, v);
  }
});

test("digest 缺段回退：无 scope → domains [common]；无 validation → none；description 取整段", () => {
  const { frontmatter } = transcodeSignal(solution({ digest: "只有一句主张" }), CTX);
  assert.deepEqual(frontmatter.domains, ["common"]);
  assert.equal(frontmatter.lifecycle.provenance?.validation, "none");
  assert.equal(frontmatter.description, "只有一句主张");
});

test("scope 多域按 / 切分进 domains", () => {
  const { frontmatter } = transcodeSignal(
    solution({ digest: "主张 | scope: 中文RAG/向量库 | validation: none" }),
    CTX,
  );
  assert.deepEqual(frontmatter.domains, ["中文RAG", "向量库"]);
});

test("kind≠solution 拒转：update / discussion 均结构化报错", () => {
  for (const kind of ["update", "discussion"] as const) {
    assert.throws(
      () => transcodeSignal(solution({ kind }), CTX),
      (err: unknown) => err instanceof TranscodeError && err.code === "KIND_NOT_SOLUTION",
    );
  }
});

test("update 锚定提取：anchor: sig_x 从 digest 中取出源 id（更新链 P3 的输入）", () => {
  assert.equal(
    extractAnchorSigId("[adoption] 复现成功（anchor: sig_01m1b90pz1z1bwfnfawd4rp4gd）"),
    "sig_01m1b90pz1z1bwfnfawd4rp4gd",
  );
  assert.equal(extractAnchorSigId("no anchor here"), null);
  assert.equal(extractAnchorSigId("anchor: not-a-sig"), null);
});

test("无正文 / 非 markdown：拒转", () => {
  assert.throws(
    () => transcodeSignal(solution({ experience: undefined }), CTX),
    (err: unknown) => err instanceof TranscodeError && err.code === "NO_BODY",
  );
  assert.throws(
    () => transcodeSignal(solution({ experience: { format: "text", body: "x" } }), CTX),
    (err: unknown) => err instanceof TranscodeError && err.code === "FORMAT_UNSUPPORTED",
  );
});

test("转出物必过 SkillFrontmatterSchema（转出即合法技能信封）", () => {
  const { frontmatter } = transcodeSignal(solution(), CTX);
  const parsed = SkillFrontmatterSchema.parse(frontmatter);
  assert.equal(parsed.id, frontmatter.id);
});
