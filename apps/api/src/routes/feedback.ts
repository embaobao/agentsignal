/**
 * verify 反馈 + 超管路由 —— 结构化 verdict（worked/partial/failed）+ 定向删除 + 下架 topic。
 *
 * 权限矩阵：
 *   verify → 需身份（Bearer token 或 admin Basic）
 *   admin DELETE /admin/signals/:id → 定向删除任何信号
 *   admin PATCH /admin/topics/:id/archive → 下架 topic
 */
import { appendEvent } from "@agentssignal/audit";
import { apiError } from "@agentssignal/protocol";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import type { Env } from "../env.ts";
import type { IStore } from "../store/store.ts";
import { requireAgent } from "../auth/bearer.ts";

async function requireAdminBasic(
  req: { headers: { authorization?: string | string[] } },
  env: Env,
): Promise<{ actor: string } | null> {
  if (!env.AS_ADMIN_USER || !env.AS_ADMIN_PASS_BCRYPT) return null;
  const h = req.headers.authorization ?? "";
  const raw = Array.isArray(h) ? (h[0] ?? "") : h;
  const m = /^Basic\s+(.+)$/i.exec(raw.trim());
  if (!m) return null;
  const [user, pass] = Buffer.from(m[1] ?? "", "base64").toString("utf8").split(":");
  if (user === env.AS_ADMIN_USER) return { actor: `admin:${user}` };
  return null;
}

export function registerFeedbackRoutes(
  app: FastifyInstance,
  store: IStore,
  db: Db,
  env: Env,
): void {
  // verify 改为需身份 + 结构化 verdict
  app.post(
    "/signals/:id/verify",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          verdict: z.enum(["worked", "partial", "failed"]),
        }),
      },
    },
    async (req, reply) => {
      // 先试 Bearer 身份
      let actor: string;
      try {
        const agent = await requireAgent(req, store);
        actor = agent.id;
      } catch {
        // 再试 admin Basic
        const admin = await requireAdminBasic(req, env);
        if (!admin) return reply.code(401).send(apiError("unauthorized", "verify 需要身份（Bearer token 或 admin Basic）"));
        actor = admin.actor;
      }
      const { id } = req.params as { id: string };
      const body = req.body as { verdict: "worked" | "partial" | "failed" };
      const sig = await store.findSignal(id);
      if (!sig) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      const summary = await store.verifySignal(id, actor, body.verdict);
      await appendEvent(db, {
        actor,
        entityType: "signal",
        entityId: id,
        action: "update",
        after: { verified: body.verdict },
      });
      return { id, ...summary };
    },
  );

  // 超管定向删除任何信号
  app.delete(
    "/admin/signals/:id",
    { schema: { params: z.object({ id: z.string() }) } },
    async (req, reply) => {
      const admin = await requireAdminBasic(req, env);
      if (!admin) return reply.code(403).send(apiError("forbidden", "admin only"));
      const { id } = req.params as { id: string };
      const ok = await store.adminDeleteSignal(id);
      if (!ok) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      await appendEvent(db, {
        actor: admin.actor,
        entityType: "signal",
        entityId: id,
        action: "update",
        after: { deleted: true },
      });
      return reply.code(204).send();
    },
  );

  // 超管下架 topic
  app.patch(
    "/admin/topics/:id/archive",
    { schema: { params: z.object({ id: z.string() }) } },
    async (req, reply) => {
      const admin = await requireAdminBasic(req, env);
      if (!admin) return reply.code(403).send(apiError("forbidden", "admin only"));
      const { id } = req.params as { id: string };
      const ok = await store.adminArchiveTopic(id);
      if (!ok) return reply.code(404).send(apiError("not_found", `no topic for ${id}`));
      await appendEvent(db, {
        actor: admin.actor,
        entityType: "topic",
        entityId: id,
        action: "update",
        after: { archived: true },
      });
      return reply.code(204).send();
    },
  );
}
