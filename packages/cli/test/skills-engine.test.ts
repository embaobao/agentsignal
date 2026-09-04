/**
 * 引擎内部模块单测（skill-engine 1.3 · node:test 单口径）。
 *
 * 覆盖：config fail-fast（order 双写 P0）· store 扫描/索引重建 · retriever 中文双路径
 * （Orama 与 trigger）· keywords fallback · layers 四态 + TokenArbitrator 属性测试
 * · loader 参数四来源链 + 依赖预检 · verify 本地 metrics。
 * 全部用临时目录夹具（AGENTSIGNAL_CONFIG root 注入），不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import JSON5 from "json5";
import {
  CONFIG_INVALID,
  ConfigError,
  defaultConfig,
  loadConfig,
  writeConfigAtomic,
} from "../src/skills/config.ts";
import { createEngine } from "../src/skills/engine.ts";
import { arbitrate, buildContext, detectStack, domainFilter } from "../src/skills/layers.ts";
import { loadDetail, resolveParameters } from "../src/skills/loader.ts";
import { resolvePaths, tokensEst } from "../src/skills/paths.ts";
import { searchSkills, tokenizeText } from "../src/skills/retriever.ts";
import { ensureIndex, scanSkills } from "../src/skills/store.ts";
import { verifySkill } from "../src/skills/verify.ts";

let root = "";

const AUTH_BODY = `# JWT 登录认证

## Why
Next.js 项目需要 JWT 登录认证与 refresh token 轮换。

## What worked
1. 安装 jose
2. 签发 access token（15m）
3. refresh token 存 httpOnly cookie

## Evidence
登录认证全链路通过。

## Caveats
JWT_SECRET 必须从环境变量注入。
`;

async function writeSkill(
  rootDir: string,
  id: string,
  frontmatter: Record<string, unknown>,
  body: string,
): Promise<void> {
  const dir = path.join(rootDir, "skills", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "skill.json5"), JSON5.stringify(frontmatter, null, 2), "utf8");
  await writeFile(path.join(dir, "SKILL.md"), body, "utf8");
}

const AUTH_FRONT = {
  id: "skill_auth_jwt",
  name: "JWT 登录认证",
  description: "Next.js 项目实现 JWT 认证、登录与 refresh token 轮换",
  domains: ["common"],
  layers: ["task"],
  triggers: [
    { field: "task", operator: "contains_any", values: ["登录", "auth", "login"], weight: 0.5 },
    { field: "keyword", operator: "contains_any", values: ["认证"], weight: 0.4 },
  ],
  keywords: ["auth", "login", "JWT", "登录"],
  dependencies: { env: ["JWT_SECRET"], bins: [], packages: ["jose"] },
  parameters: {
    token_expiry: { type: "string", default: "1h", required: false },
  },
  verify_target: ["User can login"],
};

const DEPLOY_FRONT = {
  id: "skill_deploy",
  name: "部署指南",
  description: "容器化部署与发布流程",
  domains: ["common"],
  layers: ["session"],
  triggers: [],
  keywords: ["deploy"],
};

const CODESTYLE_FRONT = {
  id: "skill_code_style",
  name: "基础代码规范",
  description: "所有项目通用的代码风格与提交约定",
  domains: ["common"],
  layers: ["base"],
  triggers: [],
};

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-engine-"));
  await writeSkill(root, "skill_auth_jwt", AUTH_FRONT, AUTH_BODY);
  await writeSkill(root, "skill_deploy", DEPLOY_FRONT, "# 部署\n\n## Why\n部署流程。");
  await writeSkill(
    root,
    "skill_code_style",
    CODESTYLE_FRONT,
    "# 基础代码规范\n\n## Why\n统一风格。\n\n## What worked\n小步提交。",
  );
  // 故意放一个坏目录：id 非法
  await writeSkill(root, "BAD ID", { ...AUTH_FRONT, id: "BAD ID" }, "x");
  // 默认 config 落盘
  await writeConfigAtomic(defaultConfig(), resolvePaths(root));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

/* ------------------------------- config ------------------------------- */

test("config：defaultConfig 校验通过且四层齐备", () => {
  const cfg = defaultConfig();
  assert.deepEqual(
    cfg.layers.map((l) => l.id),
    ["base", "domain", "task", "session"],
  );
});

test("config：文件缺失返回 null（调用方决定拉向导）", async () => {
  const paths = resolvePaths(path.join(root, "no-such-root"));
  assert.equal(await loadConfig(paths), null);
});

test("config：json5 语法坏 → CONFIG_INVALID fail-fast", async () => {
  const bad = path.join(root, "bad-config");
  await mkdir(bad, { recursive: true });
  await writeFile(path.join(bad, "config.json5"), "{ layers: [", "utf8");
  await assert.rejects(
    () => loadConfig(resolvePaths(bad)),
    (err: unknown) => err instanceof ConfigError && err.code === CONFIG_INVALID,
  );
});

test("config：layers 双写 order = P0 配置错误 fail-fast", async () => {
  const bad = path.join(root, "order-config");
  await mkdir(bad, { recursive: true });
  await writeFile(
    path.join(bad, "config.json5"),
    JSON5.stringify({ layers: [{ ...defaultConfig().layers[0], order: 0 }] }),
    "utf8",
  );
  await assert.rejects(
    () => loadConfig(resolvePaths(bad)),
    (err: unknown) => err instanceof ConfigError && /order/.test(err.message),
  );
});

/* ------------------------------- store ------------------------------- */

test("store：扫描收集有效技能并把坏目录记入 errors", async () => {
  const { skills, errors } = await scanSkills(resolvePaths(root));
  assert.equal(skills.length, 3);
  assert.deepEqual(skills.map((s) => s.id).sort(), [
    "skill_auth_jwt",
    "skill_code_style",
    "skill_deploy",
  ]);
  assert.equal(errors.length, 1);
  const badDir = errors[0];
  assert.ok(badDir, "坏目录应被记录");
  assert.match(badDir.message, /id/);
});

test("store：索引建立 + 中文 term 命中；version 不符整库重建", async () => {
  const paths = resolvePaths(root);
  const { skills } = await scanSkills(paths);
  const first = await ensureIndex(skills, paths);
  assert.equal(first.rebuilt, true);
  const second = await ensureIndex(skills, paths);
  assert.equal(second.rebuilt, false);
  // 污染版本号 → DEGRADED 整库重建
  await writeFile(paths.indexVersionFile, "stale", "utf8");
  const third = await ensureIndex(skills, paths);
  assert.equal(third.rebuilt, true);
});

/* ------------------------------- retriever：中文双路径 ------------------------------- */

test("retriever：tokenizeText 中文分词（Intl.Segmenter）", () => {
  assert.deepEqual(tokenizeText("登录 认证"), ["登录", "认证"]);
});

test("retriever 路 A：Orama mandarin「登录 认证」命中 auth 技能", async () => {
  const engine = await createEngine(root);
  const hits = await engine.search({ query: "登录 认证" });
  assert.ok(hits.length > 0, "中文查询应有命中");
  const top = hits[0];
  assert.ok(top);
  assert.equal(top.id, "skill_auth_jwt");
  // 触发规则对纯 query 只贡献 0.5/0.4 权重，未过阈 —— 本命中应来自 Orama 路径
  assert.equal(top.source, "orama");
});

test("retriever 路 B：trigger 主路径（task 面加权过阈）命中", async () => {
  const engine = await createEngine(root);
  const hits = await engine.search({ query: "", task: "帮我做用户登录认证" });
  const hit = hits.find((h) => h.id === "skill_auth_jwt");
  assert.ok(hit, "trigger 主路径应命中");
  assert.equal(hit.source, "trigger");
  assert.ok(hit.score >= 0.8);
});

test("retriever fallback：keywords（trigger 缺省）命中 deploy 技能", async () => {
  const engine = await createEngine(root);
  // query 不进 Orama 命中面，task 文本携带 keyword —— 隔离出纯 keywords 路径
  const hits = await engine.search({ query: "常规任务", task: "准备 deploy 发布" });
  const hit = hits.find((h) => h.id === "skill_deploy");
  assert.ok(hit, "keywords fallback 应命中");
  assert.equal(hit.source, "keywords");
});

test("retriever：双路并联取最高分且不重复", async () => {
  const engine = await createEngine(root);
  const { db } = { db: engine.index };
  const { skills } = await scanSkills(engine.paths);
  const hits = await searchSkills(db, skills, { query: "登录 认证", task: "登录" });
  const ids = hits.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length, "并集不得重复");
});

/* ------------------------------- layers ------------------------------- */

test("layers：domainFilter 按 common ∪ current 收口", async () => {
  const engine = await createEngine(root);
  const scoped = domainFilter(engine.skills, {
    ...engine.config,
    domains: { current: "finance", available: ["common", "finance"] },
  });
  assert.deepEqual(scoped.map((s) => s.id).sort(), [
    "skill_auth_jwt",
    "skill_code_style",
    "skill_deploy",
  ]);
});

test("layers：detect_stack 组内全命中才算", async () => {
  const proj = path.join(root, "proj-next");
  await mkdir(proj, { recursive: true });
  await writeFile(
    path.join(proj, "package.json"),
    JSON.stringify({ dependencies: { next: "15" } }),
  );
  await writeFile(path.join(proj, "tsconfig.json"), "{}");
  const engine = await createEngine(root);
  const domain = engine.config.layers.find((l) => l.id === "domain");
  assert.ok(domain);
  assert.deepEqual(await detectStack(domain.stack_rules, proj), ["Next.js + TypeScript"]);
  // 缺 tsconfig → 不命中
  const proj2 = path.join(root, "proj-plain");
  await mkdir(proj2, { recursive: true });
  await writeFile(
    path.join(proj2, "package.json"),
    JSON.stringify({ dependencies: { next: "15" } }),
  );
  assert.deepEqual(await detectStack(domain.stack_rules, proj2), []);
});

test("layers：buildContext 四态装配（true 注入全文 / trigger_match 出简表 / false 跳过）", async () => {
  const engine = await createEngine(root);
  const result = await buildContext({
    paths: engine.paths,
    config: engine.config,
    skills: engine.skills,
    db: engine.index,
    search: { query: "", task: "用户登录认证" },
  });
  const base = result.layers.find((l) => l.id === "base");
  assert.ok(base && base.mode === "true");
  const taskLayer = result.layers.find((l) => l.id === "task");
  assert.ok(taskLayer && taskLayer.mode === "trigger_match");
  const sessionLayer = result.layers.find((l) => l.id === "session");
  assert.ok(sessionLayer && sessionLayer.injected.length === 0);
  // trigger_match 命中 → catalog 有 auth 简表
  assert.ok(result.catalog.some((c) => c.id === "skill_auth_jwt"));
  assert.match(result.context, /<layer id="base"/);
  assert.match(result.context, /<available_skills>/);
  assert.match(result.context, /load_skill_detail/);
});

test("layers：TokenArbitrator 属性测试——注入总量恒 ≤ 预算", () => {
  const layer = { max_tokens: 100 } as Parameters<typeof arbitrate>[0];
  for (let seed = 0; seed < 50; seed++) {
    const items = Array.from({ length: 5 }, (_, i) => {
      const bytes = 40 + ((seed * 37 + i * 91) % 600);
      const body = "x".repeat(bytes);
      return { id: `s${i}`, body, digest: body.slice(0, 40) };
    });
    const { tokens, injected } = arbitrate(layer, items);
    assert.ok(tokens <= layer.max_tokens, `seed=${seed} tokens=${tokens} 超预算`);
    assert.ok(injected.length >= 0);
  }
});

test("layers：超预算时 digest 压缩兜底（bytes/4 口径）", () => {
  const layer = { max_tokens: 30 } as unknown as Parameters<typeof arbitrate>[0];
  const body = "y".repeat(400); // 100 tokens > 30
  const digest = "d".repeat(100); // 25 tokens ≤ 30
  const { tokens, injected } = arbitrate(layer, [{ id: "s", body, digest }]);
  const first = injected[0];
  assert.ok(first, "digest 兜底应注入");
  assert.equal(first.body, digest);
  assert.equal(tokens, tokensEst(digest));
});

/* ------------------------------- loader ------------------------------- */

test("loader：依赖预检——缺 JWT_SECRET 返回结构化清单", async () => {
  const saved = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try {
    const result = await loadDetail("skill_auth_jwt", resolvePaths(root));
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "DEPENDENCIES_MISSING");
      assert.deepEqual(result.missing.env, ["JWT_SECRET"]);
      assert.deepEqual(result.missing.packages, ["jose"]);
    }
  } finally {
    if (saved !== undefined) process.env.JWT_SECRET = saved;
  }
});

test("loader：参数四来源链优先级 project > home > env > default", async () => {
  const paths = resolvePaths(root);
  const proj = path.join(root, "proj-params");
  await mkdir(path.join(proj, ".agentsignal"), { recursive: true });
  await writeFile(
    path.join(proj, ".agentsignal", "params.json5"),
    JSON5.stringify({ token_expiry: "15m" }),
  );
  await writeFile(paths.paramsFile, JSON5.stringify({ token_expiry: "24h" }));

  const findAuth = async () => {
    const skill = (await scanSkills(paths)).skills.find((s) => s.id === "skill_auth_jwt");
    assert.ok(skill, "auth 技能应存在");
    return skill;
  };

  const a = await resolveParameters(await findAuth(), paths, proj);
  assert.equal(a.values.token_expiry, "15m"); // 项目级赢

  const b = await resolveParameters(await findAuth(), paths, path.join(root, "proj-empty"));
  assert.equal(b.values.token_expiry, "24h"); // 退到 home

  await rm(paths.paramsFile, { force: true });
  const saved = process.env.token_expiry;
  process.env.token_expiry = "5m";
  try {
    const c = await resolveParameters(await findAuth(), paths);
    assert.equal(c.values.token_expiry, "5m"); // 退到环境变量
  } finally {
    if (saved === undefined) delete process.env.token_expiry;
    else process.env.token_expiry = saved;
  }

  const d = await resolveParameters(await findAuth(), paths);
  assert.equal(d.values.token_expiry, "1h"); // 退到 default
});

test("loader：依赖齐备 + mustache 渲染全文", async () => {
  const saved = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  try {
    const result = await loadDetail("skill_auth_jwt", resolvePaths(root));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.body, /JWT 登录认证/);
      assert.match(result.body, /refresh token 轮换/);
    }
  } finally {
    if (saved === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = saved;
  }
});

/* ------------------------------- verify ------------------------------- */

test("verify：本地 verdict 落 lifecycle.metrics（worked/partial/failed 计数）", async () => {
  const r1 = await verifySkill("skill_auth_jwt", "worked", resolvePaths(root));
  assert.equal(r1.metrics.worked, 1);
  assert.equal(r1.metrics.use_count, 1);
  const r2 = await verifySkill("skill_auth_jwt", "partial", resolvePaths(root));
  assert.equal(r2.metrics.partial, 1);
  assert.equal(r2.metrics.use_count, 2);
  // 落盘可读回
  const raw = JSON5.parse(
    await readFile(path.join(root, "skills", "skill_auth_jwt", "skill.json5"), "utf8"),
  );
  assert.equal(raw.lifecycle.metrics.use_count, 2);
});
