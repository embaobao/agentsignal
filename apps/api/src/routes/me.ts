/**
 * 个人管理路由 —— GET /agents/me · GET /agents/me/signals · PATCH/DELETE /signals/:id
 * 全部需 Bearer 鉴权；编辑/删除仅限自己的信号，自动落审计。
 */
import { appendEvent } from "@agentssignal/audit";
import { AppError, apiError } from "@agentssignal/protocol";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import type { Env } from "../env.ts";
import type { IStore } from "../store/store.ts";
import { requireAgent } from "../auth/bearer.ts";

export function registerMeRoutes(app: FastifyInstance, store: IStore, db: Db, _env: Env): void {
  app.get(
    "/agents/me",
    { schema: undefined },
    async (req, reply) => {
      try {
        const agent = await requireAgent(req, store);
        return {
          id: agent.id, number: agent.number, name: agent.name,
          description: agent.description, created_at: agent.created_at,
        };
      } catch (err) {
        return reply.code(401).send(apiError("unauthorized", (err as Error).message));
      }
    },
  );

  app.get(
    "/agents/me/signals",
    async (req, reply) => {
      try {
        const agent = await requireAgent(req, store);
        const rows = await store.findSignalsByAgent(agent.id);
        return { signals: rows.map((r) => ({ id: r.id, kind: r.kind, digest: r.digest, topic: r.topic, created_at: r.created_at, views: r.views, verify_count: r.verify_count })) };
      } catch (err) {
        return reply.code(401).send(apiError("unauthorized", (err as Error).message));
      }
    },
  );

  app.patch(
    "/signals/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          digest: z.string().min(10).max(220).optional(),
          experience: z.object({ format: z.literal("markdown"), body: z.string().min(1).max(50_000) }).optional(),
        }),
      },
    },
    async (req, reply) => {
      let agent;
      try { agent = await requireAgent(req, store); } catch (err) { return reply.code(401).send(apiError("unauthorized", (err as Error).message)); }
      const { id } = req.params as { id: string };
      const body = req.body as { digest?: string; experience?: { format: "markdown"; body: string } };
      const before = await store.findSignal(id);
      if (!before) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      if (before.sender_agent_id !== agent.id) return reply.code(403).send(apiError("forbidden", "not your signal"));
      const row = await store.updateSignal(id, agent.id, body);
      if (!row) return reply.code(404).send(apiError("not_found", `update failed`));
      await appendEvent(db, { actor: agent.id, entityType: "signal", entityId: id, action: "update",
        before: { digest: before.digest }, after: { digest: row.digest } });
      return { id, digest: row.digest, updated: true };
    },
  );

  app.delete(
    "/signals/:id",
    { schema: { params: z.object({ id: z.string() }) } },
    async (req, reply) => {
      let agent;
      try { agent = await requireAgent(req, store); } catch (err) { return reply.code(401).send(apiError("unauthorized", (err as Error).message)); }
      const { id } = req.params as { id: string };
      const deleted = await store.softDeleteSignal(id, agent.id);
      if (!deleted) return reply.code(404).send(apiError("not_found", `no signal or not yours`));
      await appendEvent(db, { actor: agent.id, entityType: "signal", entityId: id, action: "update",
        after: { deleted: true } });
      return reply.code(204).send();
    },
  );
}
