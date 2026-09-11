/**
 * P0.2 产物 frontmatter 单测（local-capability-plane · node:test 单口径）。
 *
 * 产物 = 落到宿主技能目录的 SKILL.md，零工具可读（APM/skills-manager 等外部工具直接消费）：
 *   - 标准字段仅 name / description，均必填；name 须等于落装目录名；
 *   - 私有层字段（layers/triggers/domains 等检索/分层元数据）不进产物 schema——
 *     只存内部形式 skill.json5，产物侧出现时静默剥离（零泄漏语义，S10 对齐）。
 * schema 断言直接引 protocol 真源 TS。零外部依赖、零文件系统触碰。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ArtifactFrontmatterSchema,
  parseArtifactFrontmatter,
} from "../../protocol/src/skill-schema.ts";

test("产物 frontmatter：name/description 均必填", () => {
  assert.throws(() => ArtifactFrontmatterSchema.parse({ description: "JWT 鉴权方案" }));
  assert.throws(() => ArtifactFrontmatterSchema.parse({ name: "skill_auth_jwt" }));
  assert.throws(() => ArtifactFrontmatterSchema.parse({ name: "", description: "x" }));
  const ok = ArtifactFrontmatterSchema.parse({
    name: "skill_auth_jwt",
    description: "JWT 鉴权方案",
  });
  assert.equal(ok.name, "skill_auth_jwt");
  assert.equal(ok.description, "JWT 鉴权方案");
});

test("产物 frontmatter：私有层字段零泄漏（layers/triggers/domains 不进产物）", () => {
  const raw = {
    name: "skill_auth_jwt",
    description: "JWT 鉴权方案",
    // 内部形式字段：产物侧必须被剥离
    id: "skill_auth_jwt",
    domains: ["auth"],
    layers: ["base"],
    triggers: [{ field: "task", operator: "contains_any", values: ["jwt"] }],
    keywords: ["jwt", "token"],
    verify_target: ["HS256 校验通过"],
    lifecycle: { status: "solidified" },
  };
  const out = ArtifactFrontmatterSchema.parse(raw);
  assert.deepEqual(Object.keys(out).sort(), ["description", "name"]);
});

test("parseArtifactFrontmatter：name 与目录名一致时通过", () => {
  const out = parseArtifactFrontmatter(
    { name: "skill_auth_jwt", description: "JWT 鉴权方案" },
    "skill_auth_jwt",
  );
  assert.equal(out.name, "skill_auth_jwt");
});

test("parseArtifactFrontmatter：name ≠ 目录名即报错（错误含目录名）", () => {
  assert.throws(
    () => parseArtifactFrontmatter({ name: "other_name", description: "x" }, "skill_auth_jwt"),
    (err: unknown) => err instanceof Error && err.message.includes("skill_auth_jwt"),
  );
});

test("parseArtifactFrontmatter：缺目录名参数只做 schema 校验", () => {
  const out = parseArtifactFrontmatter({ name: "any", description: "x" });
  assert.equal(out.name, "any");
});
