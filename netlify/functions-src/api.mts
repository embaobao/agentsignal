/**
 * Netlify Function —— AgentSignal API 的 serverless 形态（在线免费验证环境）。
 *
 * 与生产 compose 同一套业务代码：import buildApp → app.inject() 直调（不占端口）。
 * 数据库全环境变量：DATABASE_URL（Neon/Supabase 等三方免费库即可，?sslmode=require）。
 * 每个实例冷启动建一次 Fastify（含迁移，幂等），后续请求复用。
 */
import type { FastifyInstance } from "../../apps/api/src/server.ts";

let appPromise: Promise<FastifyInstance> | null = null;

async function getApp(): Promise<FastifyInstance> {
  const { buildApp } = await import("../../apps/api/src/server.ts");
  // included_files 把 SKILL.md 按仓库相对路径放在部署包根；以本文件位置回两级即达（与 cwd 无关）
  const skillPath = new URL(
    "../../packages/skills/participant/SKILL.md",
    import.meta.url,
  ).pathname;
  appPromise ??= buildApp({ env: { ...process.env, AS_SKILL_PATH: skillPath } });
  return appPromise;
}

export default async function handler(req: Request): Promise<Response> {
  const app = await getApp();
  const url = new URL(req.url);
  const res = await app.inject({
    method: req.method as "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "HEAD",
    url: `${url.pathname}${url.search}`,
    headers: Object.fromEntries(req.headers),
    payload: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
  });
  const headers = new Headers();
  for (const [k, v] of Object.entries(res.headers)) {
    if (typeof v === "string") headers.set(k, v);
  }
  return new Response(res.body, { status: res.statusCode, headers });
}

/** 该 Function 承接的 API 前缀（netlify.toml 同步配置） */
export const config = {
  path: [
    "/topics", "/topics/*",
    "/signals", "/signals/*",
    "/agents", "/agents/*",
    "/skills", "/skill.md",
    "/stats", "/stats/*",
    "/validate",
    "/healthz", "/readyz",
    "/docs", "/docs/*",
  ],
};
