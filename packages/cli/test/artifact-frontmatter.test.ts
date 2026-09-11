/**
 * P0.2 产物 frontmatter 单测（local-capability-plane · node:test 单口径）。
 *
 * 产物 = 落到宿主技能目录的 SKILL.md，零工具可读（APM/skills-manager 等外部工具直接消费）：
 *   - 标准字段仅 name / description，均必填；name 须等于落装目录名；
 *   - 私有层字段（layers/triggers/domains 等检索/分层元数据）不进产物 schema——
 *     只存内部形式 skill.json5，产物侧出现时静默剥离（零泄漏语义，S10 对齐）。
 * schema 断言直接引 protocol 真源 TS。P0.3 落库生成/校验（renderArtifactSkillMd + installSignal
 * 集成）同文件覆盖；夹具 = AGENTSIGNAL_CONFIG 临时目录，不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import {
  ArtifactFrontmatterSchema,
  parseArtifactFrontmatter,
} from "../../protocol/src/skill-schema.ts";
import { installSignal } from "../src/skills/install.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import type { TranscodeContext, TranscodeInput } from "../src/skills/transcoder.ts";
import { renderArtifactSkillMd, stripArtifactFrontmatter } from "../src/skills/transcoder.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-artifact-"));
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

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

/* ---------------- P0.3 落库生成/校验 ---------------- */

const BODY = [
  "## 前提",
  "",
  "- HS256 + 固定密钥轮换",
  "",
  "## 步骤",
  "",
  "1. 用 `jwt.verify` 校验签名",
  "2. 校验 `exp` 与 `iss`",
  "",
  "正文含 YAML 特殊字符：name: x | scope: a/b | validation: self-tested",
].join("\n");

test("renderArtifactSkillMd：首部产物 frontmatter + 正文逐字保留 + 私有键零出现", () => {
  const md = renderArtifactSkillMd("skill_auth_jwt", "JWT 鉴权方案", BODY);
  assert.ok(md.startsWith(`---\nname: "skill_auth_jwt"\ndescription: "JWT 鉴权方案"\n---\n\n`));
  assert.ok(md.endsWith(BODY), "正文须逐字保留在首部之后");
  for (const priv of ["layers", "triggers", "domains", "keywords", "verify_target", "lifecycle"]) {
    assert.ok(!md.includes(priv), `私有键 ${priv} 不得出现在产物`);
  }
});

test("renderArtifactSkillMd：description 含引号/换行时序列化安全（YAML 1.2 JSON 超集）", () => {
  const desc = '含 "引号" 与\n换行';
  const md = renderArtifactSkillMd("skill_x", desc, "b");
  assert.ok(md.includes('name: "skill_x"'));
  // JSON.stringify 序列化的值在 YAML 1.2 下原样可读
  assert.ok(md.includes(JSON.stringify(desc)));
});

test("renderArtifactSkillMd：空 description 拒绝（写前即校验）", () => {
  assert.throws(() => renderArtifactSkillMd("skill_x", "", "b"));
});

test("installSignal：落库后 SKILL.md 首部合规（name=目录名）且 skill.json5 保留私有增强", async () => {
  const paths = resolvePaths(root);
  const input: TranscodeInput = {
    id: "sig_01JARTIFACT",
    topic: "auth",
    kind: "solution",
    digest: "JWT 鉴权方案 | scope: auth | validation: self-tested",
    experience: { format: "markdown", body: BODY },
  };
  const ctx: TranscodeContext = {
    base_url: "http://localhost:3000",
    synced_at: "2026-09-12T00:00:00.000Z",
  };
  const { dir } = await installSignal(input, ctx, paths);
  const dirName = path.basename(dir);
  assert.equal(dirName, "sig_01jartifact");

  const md = await readFile(path.join(dir, "SKILL.md"), "utf8");
  assert.ok(md.startsWith(`---\nname: "${dirName}"\ndescription: `), "产物首部 name 须等于目录名");
  assert.ok(md.includes("jwt.verify"), "正文须保留");

  const meta = await readFile(path.join(dir, "skill.json5"), "utf8");
  for (const priv of ["layers", "triggers", "domains"]) {
    assert.ok(meta.includes(priv), `私有键 ${priv} 须保留在内部形式 skill.json5`);
  }
});

test("stripArtifactFrontmatter：render 输出剥离后还原纯正文（往返无损）", () => {
  assert.equal(stripArtifactFrontmatter(renderArtifactSkillMd("skill_x", "描述", BODY)), BODY);
});

test("stripArtifactFrontmatter：无首部正文原样（旧技能零破坏）", () => {
  assert.equal(stripArtifactFrontmatter(BODY), BODY);
});

test("stripArtifactFrontmatter：以 --- 开头的普通 markdown（水平线）不误剥", () => {
  const hr = "---\n\n## 正文\n";
  assert.equal(stripArtifactFrontmatter(hr), hr);
});
