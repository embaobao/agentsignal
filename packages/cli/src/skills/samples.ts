/**
 * 示例技能落盘（裁决 10：init 自带 2–3 个，内部形式，用户不可见）。
 * 只写缺省缺失的目录，用户已有同名技能不覆盖。
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SkillFrontmatterSchema } from "@agentssignal/protocol";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";

interface Sample {
  id: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

const CODE_STYLE: Sample = {
  id: "skill_code_style",
  frontmatter: {
    id: "skill_code_style",
    name: "基础代码规范",
    description: "所有项目通用的代码风格、提交约定与错误处理基线",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
    keywords: ["style", "规范"],
  },
  body: `# 基础代码规范

## Why
统一的风格让 Agent 与人类在同一套约定下协作，减少无意义 diff 往返。

## What worked
1. 小步提交：一个提交只做一件事，信息用祈使句。
2. 错误处理在边界做，业务内部不吞异常。
3. 新增依赖前先确认仓库里是否已有等价能力。

## Evidence
适用于任何语言与框架，与具体技术栈无关。

## Caveats
本层始终注入，内容保持精简。
`,
};

const AUTH_JWT: Sample = {
  id: "skill_auth_jwt",
  frontmatter: {
    id: "skill_auth_jwt",
    name: "JWT 登录认证",
    description: "为 Web 应用实现 JWT 认证、登录与 refresh token 轮换",
    domains: ["common"],
    layers: ["task"],
    triggers: [
      {
        field: "task",
        operator: "contains_any",
        values: ["登录", "认证", "auth", "login"],
        weight: 0.5,
      },
      { field: "keyword", operator: "contains_any", values: ["认证", "JWT"], weight: 0.4 },
    ],
    keywords: ["auth", "login", "JWT", "登录", "认证"],
    dependencies: { env: ["JWT_SECRET"], bins: [], packages: [] },
    parameters: {
      token_expiry: { type: "string", default: "1h", required: false },
    },
    verify_target: ["User can login with configured provider", "Session persists across reload"],
  },
  body: `# JWT 登录认证（access token 有效期 {{token_expiry}}）

## Why
会话安全依赖短期 access token + 可轮换的 refresh token，避免长期凭证泄露面过大。

## What worked
1. 用 \`jose\` 或等价库签发 access token，有效期 {{token_expiry}}。
2. refresh token 存 httpOnly + Secure cookie，轮换时做 reuse detection。
3. JWT_SECRET 只从环境变量读取，不进代码与日志。

## Evidence
登录、刷新、登出三条链路均需有测试覆盖。

## Caveats
JWT_SECRET 缺失时先补齐环境变量再执行本方案。
`,
};

const DEPLOY: Sample = {
  id: "skill_deploy",
  frontmatter: {
    id: "skill_deploy",
    name: "部署与发布流程",
    description: "容器化部署、健康检查与回滚的标准动作序列",
    domains: ["common"],
    layers: ["session"],
    triggers: [],
    keywords: ["deploy", "部署", "发布"],
  },
  body: `# 部署与发布流程

## Why
发布是可逆操作：先能回滚，再谈提速。

## What worked
1. 构建镜像 → 起容器 → 健康检查通过再切流量。
2. 保留上一版本镜像，回滚只改 tag。
3. 发布后跑一遍关键路径冒烟。

## Evidence
发布记录（时间、版本、执行人）落到可查的地方。

## Caveats
未完成健康检查前不要摘掉旧实例。
`,
};

const SAMPLES: Sample[] = [CODE_STYLE, AUTH_JWT, DEPLOY];

/** 写入缺失的示例技能；返回写入的 id 列表 */
export async function writeSamples(paths?: AgentSignalPaths): Promise<string[]> {
  const p = paths ?? resolvePaths();
  await mkdir(p.skillsDir, { recursive: true });
  const existing = new Set(await readdir(p.skillsDir));
  const written: string[] = [];
  for (const sample of SAMPLES) {
    if (existing.has(sample.id)) continue;
    const dir = path.join(p.skillsDir, sample.id);
    await mkdir(dir, { recursive: true });
    // 落盘前 self-check：示例本身必须符合 schema 真源
    SkillFrontmatterSchema.parse(sample.frontmatter);
    await writeFile(
      path.join(dir, "skill.json5"),
      JSON5.stringify(sample.frontmatter, null, 2),
      "utf8",
    );
    await writeFile(path.join(dir, "SKILL.md"), sample.body, "utf8");
    written.push(sample.id);
  }
  return written;
}
