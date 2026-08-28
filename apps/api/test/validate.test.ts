/**
 * 单测：软校验流水线 + 硬校验限（backend-architecture §十一：validate 关键路径）。
 * bun test 与 node:test 双跑兼容。
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { PublishRequestSchema } from "@agentsignal/protocol";
import { checkDigest, checkSections, validateEnvelope } from "../src/validate/envelope.ts";

const GOOD_DIGEST = "语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested";
const FULL_BODY = [
  "## Why",
  "动机",
  "## What worked",
  "做法",
  "## Evidence",
  "证据",
  "## Caveats",
  "代价",
].join("\n");

describe("checkDigest（三段式软校验）", () => {
  test("三段式判有效且无警告", () => {
    const r = checkDigest(GOOD_DIGEST);
    assert.equal(r.valid, true);
    assert.equal(r.warnings.length, 0);
  });

  test("残缺 digest 给 digest_format 警告", () => {
    const r = checkDigest("随便写一句");
    assert.equal(r.valid, false);
    assert.ok(r.warnings.some((w) => w.code === "digest_format"));
  });

  test("claim 段过短给 info 级提示", () => {
    const r = checkDigest("很短 | scope: x | validation: none");
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.code === "digest_claim_short" && w.level === "info"));
  });
});

describe("checkSections（四节模板）", () => {
  test("四节齐全命中 4/4", () => {
    const r = checkSections(FULL_BODY);
    assert.deepEqual([...r.hits].sort(), ["Caveats", "Evidence", "What worked", "Why"].sort());
    assert.equal(r.rate, 1);
  });

  test("缺节按命中数折算", () => {
    const r = checkSections("## Why\n只有动机");
    assert.equal(r.hits.length, 1);
    assert.equal(r.rate, 0.25);
  });
});

describe("validateEnvelope（软约束聚合）", () => {
  test("全量过关：valid 且零警告", () => {
    const r = validateEnvelope({ digest: GOOD_DIGEST, body: FULL_BODY, tokens_est: 1200 });
    assert.equal(r.valid, true);
    assert.equal(r.digest_valid, true);
    assert.equal(r.warnings.length, 0);
  });

  test("正文过长给 info 提示但不判无效", () => {
    const r = validateEnvelope({
      digest: GOOD_DIGEST,
      body: `${FULL_BODY}\n${"x".repeat(21_000)}`,
    });
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some((w) => w.code === "body_long" && w.level === "info"));
  });

  test("tokens_est 偏高给 info 提示", () => {
    const r = validateEnvelope({ digest: GOOD_DIGEST, tokens_est: 9_000 });
    assert.ok(r.warnings.some((w) => w.code === "tokens_high"));
  });

  test("warn 级警告存在时 valid=false", () => {
    const r = validateEnvelope({ digest: "随便写一句", body: FULL_BODY });
    assert.equal(r.valid, false);
    assert.equal(r.digest_valid, false);
  });
});

describe("硬校验限（signal spec §4，超限 400 由 zod 拦截）", () => {
  const base = { kind: "solution", priority: 30, tokens_est: 0 };

  test("digest 下界：9 拒 / 10 收", () => {
    assert.equal(PublishRequestSchema.safeParse({ ...base, digest: "a".repeat(9) }).success, false);
    assert.equal(PublishRequestSchema.safeParse({ ...base, digest: "a".repeat(10) }).success, true);
  });

  test("digest 上界：220 收 / 221 拒", () => {
    assert.equal(
      PublishRequestSchema.safeParse({ ...base, digest: "a".repeat(220) }).success,
      true,
    );
    assert.equal(
      PublishRequestSchema.safeParse({ ...base, digest: "a".repeat(221) }).success,
      false,
    );
  });

  test("tokens_est 上界 1e5：100000 收 / 100001 拒", () => {
    assert.equal(
      PublishRequestSchema.safeParse({ ...base, digest: GOOD_DIGEST, tokens_est: 100_000 }).success,
      true,
    );
    assert.equal(
      PublishRequestSchema.safeParse({ ...base, digest: GOOD_DIGEST, tokens_est: 100_001 }).success,
      false,
    );
  });

  test("body_md 上界 50k：50000 收 / 50001 拒；空正文拒", () => {
    const withBody = (body: string) => ({
      ...base,
      digest: GOOD_DIGEST,
      experience: { format: "markdown", body },
    });
    assert.equal(PublishRequestSchema.safeParse(withBody("a".repeat(50_000))).success, true);
    assert.equal(PublishRequestSchema.safeParse(withBody("a".repeat(50_001))).success, false);
    assert.equal(PublishRequestSchema.safeParse(withBody("")).success, false);
  });
});
