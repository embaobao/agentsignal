/**
 * 用户域路由 —— session（cookie）鉴权的人类侧端点（user-domain-completion Phase 1.3/1.8）。
 *
 *   GET    /agents/me/session   双层身份视图（user + 名下 agents；1.2 桥接）
 *   POST   /agents              用户域创建 agent（session 鉴权·出生即绑定·≤AGENTS_PER_USER_MAX）
 *   POST   /agents/claim        认领已有 agent（粘 ags_ token → bindGithub，裁决 3）
 *   DELETE /agents/claim        解绑（agent.github_id 必须等于当前用户 github id）
 *
 * 与匿名自注册 POST /agents/register（Q2 口径）并行，互不影响。
 * 审计 actor 口径：user:<user_id>（对照 admin:<user>）。
 */
import { appendEvent } from "@agentssignal/audit";
import { AppError, apiError, prefixed } from "@agentssignal/protocol";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSessionContext } from "../auth/bridge.ts";
import type { Auth } from "../auth/better-auth.ts";
import type { Db } from "../db/client.ts";
import type { Env } from "../env.ts";
import type { IStore } from "../store/store.ts";

async function requireSession(
  req: { headers: Record<string, unknown>; url?: string },
  auth: Auth,
  store: IStore,
) {
  const ctx = await getSessionContext(req, auth, store);
  if (!ctx) throw new AppError("unauthorized", "no active session (login via /auth first)");
  return ctx;
}

export function registerUserAgentRoutes(
  app: FastifyInstance,
  auth: Auth,
  store: IStore,
  db: Db,
  env: Env,
): void {
  /** 1.2 桥接视图：双层身份（登录人类 + 名下 agents） */
  app.get("/agents/me/session", async (req, reply) => {
    const ctx = await getSessionContext(req, auth, store);
    if (!ctx) return reply.code(401).send(apiError("unauthorized", "no active session"));
    return {
      user: ctx.user,
      github_id: ctx.githubId,
      agents: ctx.agents.map((a) => ({
        id: a.id,
        number: a.number,
        name: a.name,
        description: a.description,
        created_at: a.created_at,
      })),
    };
  });

  /** 1.8 用户域创建 agent：出生即绑定，≤5（Q5），自注册路径不变 */
  app.post(
    "/agents",
    { schema: { body: z.object({ name: z.string().min(1).max(40).optional(), description: z.string().max(200).optional() }) } },
    async (req, reply) => {
      let ctx;
      try {
        ctx = await requireSession(req, auth, store);
      } catch (err) {
        return reply.code(401).send(apiError("unauthorized", (err as Error).message));
      }
      if (!ctx.githubId) {
        return reply.code(409).send(apiError("conflict", "session has no linked GitHub account"));
      }
      const count = await store.countAgentsByGithub(ctx.githubId);
      if (count >= env.AGENTS_PER_USER_MAX) {
        return reply
          .code(403)
          .send(apiError("forbidden", `agent limit reached (${env.AGENTS_PER_USER_MAX} per user)`));
      }
      const body = (req.body ?? {}) as { name?: string; description?: string };
      const rawToken = prefixed("ags");
      const { agent } = await store.registerAgent(body.name ?? "", body.description ?? "", rawToken);
      await store.bindGithub(agent.id, ctx.githubId);
      await appendEvent(db, {
        actor: `user:${ctx.user.id}`,
        entityType: "agent",
        entityId: agent.id,
        action: "create",
        after: { number: agent.number, name: agent.name, bound: true },
      });
      return reply.code(201).send({
        number: agent.number,
        name: agent.name,
        agent_id: agent.id,
        token: rawToken,
        bound: true,
      });
    },
  );

  /** 1.3 认领（claim）：粘已有 ags_ token → 绑定当前 GitHub 身份 */
  app.post(
    "/agents/claim",
    { schema: { body: z.object({ token: z.string().regex(/^ags_\S+$/, "须为 ags_ token") }) } },
    async (req, reply) => {
      let ctx;
      try {
        ctx = await requireSession(req, auth, store);
      } catch (err) {
        return reply.code(401).send(apiError("unauthorized", (err as Error).message));
      }
      if (!ctx.githubId) {
        return reply.code(409).send(apiError("conflict", "session has no linked GitHub account"));
      }
      const { token } = req.body as { token: string };
      const agent = await store.agentForToken(token);
      if (!agent) return reply.code(404).send(apiError("not_found", "invalid or expired token"));
      if (agent.github_id && agent.github_id !== ctx.githubId) {
        return reply.code(409).send(apiError("conflict", "agent already bound to another GitHub identity"));
      }
      await store.bindGithub(agent.id, ctx.githubId);
      await appendEvent(db, {
        actor: `user:${ctx.user.id}`,
        entityType: "agent",
        entityId: agent.id,
        action: "update",
        after: { bound: true, github_id: ctx.githubId },
      });
      return {
        agent_id: agent.id,
        number: agent.number,
        name: agent.name,
        bound: true,
      };
    },
  );

  /** 解绑：仅能解自己名下的 agent（换绑 = 先解再 claim） */
  app.delete(
    "/agents/claim",
    { schema: { body: z.object({ agent_id: z.string().min(1) }) } },
    async (req, reply) => {
      let ctx;
      try {
        ctx = await requireSession(req, auth, store);
      } catch (err) {
        return reply.code(401).send(apiError("unauthorized", (err as Error).message));
      }
      if (!ctx.githubId) {
        return reply.code(409).send(apiError("conflict", "session has no linked GitHub account"));
      }
      const { agent_id } = req.body as { agent_id: string };
      const ok = await store.unbindGithub(agent_id, ctx.githubId);
      if (!ok) return reply.code(404).send(apiError("not_found", "no such bound agent"));
      await appendEvent(db, {
        actor: `user:${ctx.user.id}`,
        entityType: "agent",
        entityId: agent_id,
        action: "update",
        after: { bound: false },
      });
      return reply.code(204).send();
    },
  );
}
