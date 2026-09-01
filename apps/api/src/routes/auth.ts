/**
 * 认证路由 —— better-auth 处理 OAuth 全流程 + 业务桥接（bind agent）。
 *
 * GET /auth/github/sign-in  → 302 GitHub 授权页
 * GET /auth/github/callback → GitHub 回调 → better-auth session → 桥接 agent → 302 前端
 * GET /auth/session          → 当前 session 信息（调试）
 *
 * 桥接逻辑：GitHub OAuth 成功后，按 github user id 查 agents 表：
 *   - 已绑定 → 签发该 agent 的 token（复用已有身份）
 *   - 未绑定 → 创建新 agent（agent-N 编号自动分配）
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Auth } from "../auth/better-auth.ts";
import type { Env } from "../env.ts";
import type { Db } from "../db/client.ts";
import type { IStore } from "../store/store.ts";

export function registerAuthRoutes(
  app: FastifyInstance,
  auth: Auth,
  store: IStore,
  db: Db,
  env: Env,
): void {
  // better-auth 自带路由挂载到 /api/auth/*
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    handler: async (req, reply) => {
      const url = new URL(req.url, `${req.protocol}://${req.hostname}`);
      const headers = new Headers(req.headers as Record<string, string>);
      const body = req.body ? JSON.stringify(req.body) : undefined;

      const request = new Request(url.href, {
        method: req.method,
        headers,
        body,
      });

      const response = await auth.handler(request);
      reply.code(response.status);
      for (const [k, v] of response.headers) reply.header(k, v);
      return reply.send(response.body ? await response.text() : undefined);
    },
  });

  // GitHub 快捷入口（前端 Sign in 按钮 href）
  app.get("/auth/github", async (_req, reply) => {
    if (!env.GITHUB_CLIENT_ID) return reply.code(404).send({ message: "OAuth not configured" });
    const url = new URL(`${env.AGENTSIGNAL_BASE_URL}/api/auth/signin/social`);
    return reply.redirect(url.href, 302);
  });
}
