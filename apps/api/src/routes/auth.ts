/**
 * 认证路由 —— better-auth 处理 OAuth 全流程。
 * GET /api/auth/* → better-auth handler（social sign-in / callback / session）
 * GET /auth/github → 302 快捷入口
 */
import type { FastifyInstance } from "fastify";
import type { Auth } from "../auth/better-auth.ts";
import type { Env } from "../env.ts";

export function registerAuthRoutes(app: FastifyInstance, auth: Auth, env: Env): void {
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

  app.get("/auth/github", async (_req, reply) => {
    if (!env.GITHUB_CLIENT_ID) return reply.code(404).send({ message: "OAuth not configured" });
    return reply.redirect(`${env.AGENTSIGNAL_BASE_URL}/api/auth/signin/social`, 302);
  });
}
