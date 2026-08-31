/**
 * 管理端点 —— audit-restore 1B-1（Basic 单管理员；双签在 1B-2）。
 *
 * 未配置 AS_ADMIN_USER/AS_ADMIN_PASS_BCRYPT 时整体 fail-soft（404，不泄露存在性）。
 * 策展写路径 PATCH /admin/signals/:id/curate 闭环运营缺口（recommended/stats_tag），
 * 审计事件在路由层落账（actor=admin:<user>；用户写路径的审计在 withAudit 包装层）。
 */
import { appendEvent, verifyChain } from "@agentssignal/audit";
import { AppError, apiError } from "@agentssignal/protocol";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.ts";
import type { Env } from "../env.ts";
import type { IStore } from "../store/store.ts";

/** Basic 凭证校验；未配置 → 404（不泄露存在性），错凭证 → 401 */
async function requireAdmin(
  req: { headers: { authorization?: string | string[] } },
  env: Env,
): Promise<{ actor: string }> {
  if (!env.AS_ADMIN_USER || !env.AS_ADMIN_PASS_BCRYPT) {
    throw new AppError("not_found", "admin not configured");
  }
  const h = req.headers.authorization ?? "";
  const raw = Array.isArray(h) ? (h[0] ?? "") : h;
  const m = /^Basic\s+(.+)$/i.exec(raw.trim());
  if (!m) throw new AppError("unauthorized", "missing admin Basic credentials");
  const [user, password] = Buffer.from(m[1] ?? "", "base64")
    .toString("utf8")
    .split(":");
  const userOk = user === env.AS_ADMIN_USER;
  const passOk = await bcrypt.compare(password ?? "", env.AS_ADMIN_PASS_BCRYPT);
  if (!userOk || !passOk) throw new AppError("unauthorized", "invalid admin credentials");
  return { actor: `admin:${user}` };
}

function errorReply(
  reply: { code: (n: number) => { send: (b: unknown) => unknown } },
  err: unknown,
) {
  const appErr = err as { statusCode?: number; code?: string; message?: string };
  if ((appErr as { code?: string }).code === "not_found" || appErr.statusCode === 404) {
    return reply.code(404).send(apiError("not_found", appErr.message ?? "not found"));
  }
  if (appErr instanceof AppError) {
    return reply.code(appErr.status).send(apiError(appErr.code, appErr.message));
  }
  return reply.code(401).send(apiError("unauthorized", appErr.message ?? "unauthorized"));
}

export function registerAdminRoutes(app: FastifyInstance, store: IStore, db: Db, env: Env): void {
  app.get(
    "/admin/audit/events",
    {
      schema: {
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          day: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          entity_type: z.enum(["signal", "agent", "token"]).optional(),
          actor: z.string().optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        await requireAdmin(req, env);
      } catch (err) {
        return errorReply(reply, err);
      }
      const q = req.query as {
        limit: number;
        day?: string;
        entity_type?: string;
        actor?: string;
      };
      const rows = await db.query(
        `select event_id, prev_hash, hash, actor, entity_type, entity_id, action,
                before, after, created_at
           from audit_events
          where ($1::date is null or created_at::date = $1::date)
            and ($2::text is null or entity_type = $2)
            and ($3::text is null or actor = $3)
          order by id desc
          limit $4`,
        [q.day ?? null, q.entity_type ?? null, q.actor ?? null, q.limit],
      );
      return { events: rows.rows };
    },
  );

  app.get(
    "/admin/audit/verify",
    {
      schema: {
        querystring: z.object({
          day: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        await requireAdmin(req, env);
      } catch (err) {
        return errorReply(reply, err);
      }
      const q = req.query as { day?: string };
      return verifyChain(db, q.day);
    },
  );

  app.patch(
    "/admin/signals/:id/curate",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          recommended: z.boolean().optional(),
          stats_tag: z.array(z.string()).max(8).optional(),
        }),
      },
    },
    async (req, reply) => {
      let actor: string;
      try {
        const admin = await requireAdmin(req, env);
        actor = admin.actor;
      } catch (err) {
        return errorReply(reply, err);
      }
      const { id } = req.params as { id: string };
      const body = req.body as { recommended?: boolean; stats_tag?: string[] };
      const before = await store.findSignal(id);
      if (!before) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      const row = await store.updateCuration(id, body);
      if (!row) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      await appendEvent(db, {
        actor,
        entityType: "signal",
        entityId: id,
        action: "update",
        before: { recommended: before.recommended, stats_tag: before.stats_tag },
        after: { recommended: row.recommended, stats_tag: row.stats_tag },
      });
      return { id, recommended: row.recommended, stats_tag: row.stats_tag };
    },
  );
}
