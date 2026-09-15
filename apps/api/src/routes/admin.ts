/**
 * 管理端点 —— audit-restore 1B-1（Basic 单管理员；双签在 1B-2）。
 *
 * 未配置 AS_ADMIN_USER/AS_ADMIN_PASS_BCRYPT 时整体 fail-soft（404，不泄露存在性）。
 * 策展写路径 PATCH /admin/signals/:id/curate 闭环运营缺口（recommended/stats_tag），
 * 审计事件在路由层落账（actor=admin:<user>；用户写路径的审计在 withAudit 包装层）。
 */
import {
  appendEvent,
  resolveTarget,
  snapshotBefore,
  unifiedDiff,
  verifyChain,
} from "@agentssignal/audit";
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
          entity_type: z.enum(["signal", "agent", "token", "topic"]).optional(),
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

  // ── Topic 治理（决议 reuse-boundary D3）：改名带 slug 唯一校验；下架 = 软删标记 ──

  app.get(
    "/admin/topics",
    {
      schema: {
        querystring: z.object({
          include_archived: z
            .enum(["1", "true"])
            .optional()
            .transform((v) => v !== undefined),
        }),
      },
    },
    async (req, reply) => {
      try {
        await requireAdmin(req, env);
      } catch (err) {
        return errorReply(reply, err);
      }
      const q = req.query as { include_archived?: boolean };
      const topics = await store.listTopics({ includeArchived: q.include_archived });
      return { topics };
    },
  );

  app.patch(
    "/admin/topics/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        body: z.object({
          name: z.string().min(1).max(120).optional(),
          description: z.string().max(500).optional(),
          mode: z.enum(["broadcast", "forum"]).optional(),
          slug: z
            .string()
            .regex(/^[a-z0-9][a-z0-9-]{1,63}$/)
            .optional(),
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
      const body = req.body as {
        name?: string;
        description?: string;
        mode?: "broadcast" | "forum";
        slug?: string;
      };
      if (
        body.name === undefined &&
        body.description === undefined &&
        body.mode === undefined &&
        body.slug === undefined
      ) {
        return reply.code(400).send(apiError("bad_request", "empty patch"));
      }
      const before = await store.topicById(id);
      if (!before) return reply.code(404).send(apiError("not_found", `no topic for ${id}`));
      if (body.slug && body.slug !== before.slug) {
        const clash = await store.topicBySlug(body.slug);
        if (clash) {
          return reply.code(409).send(apiError("conflict", `slug already taken: ${body.slug}`));
        }
      }
      const row = await store.updateTopic(id, body);
      if (!row) return reply.code(404).send(apiError("not_found", `no topic for ${id}`));
      await appendEvent(db, {
        actor,
        entityType: "topic",
        entityId: id,
        action: "update",
        before: {
          slug: before.slug,
          name: before.name,
          mode: before.mode,
          description: before.description,
        },
        after: { slug: row.slug, name: row.name, mode: row.mode, description: row.description },
      });
      return row;
    },
  );

  /** 下架 = 软删标记（?restore=1 撤销），绝不删行 */
  app.delete(
    "/admin/topics/:id",
    {
      schema: {
        querystring: z.object({ restore: z.enum(["1", "true"]).optional() }),
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
      const q = req.query as { restore?: string };
      const restore = q.restore !== undefined;
      const before = await store.topicById(id);
      if (!before) return reply.code(404).send(apiError("not_found", `no topic for ${id}`));
      const row = await store.setTopicArchived(id, !restore);
      if (!row) return reply.code(404).send(apiError("not_found", `no topic for ${id}`));
      await appendEvent(db, {
        actor,
        entityType: "topic",
        entityId: id,
        action: "update",
        before: { archived_at: before.archived_at },
        after: { archived_at: row.archived_at },
      });
      return row;
    },
  );

  /* ── audit-restore 1B-2：Restore Signal 两步端点（dry-run → apply）────────
   * 修订史 = snapshots 全行快照（audit-wrap 接线）；还原 = 覆盖可变字段（digest/experience）
   * + 追加 restore 事件。设计 MUST #1：链坏禁止一切还原。双签在 2.5（本段 admin Basic 即权）。 */
  const restoreSelector = z.object({
    to_rev: z.number().int().min(1).optional(),
    to_event_id: z.string().min(1).optional(),
  });
  app.post("/admin/restore/signal/:id/dry-run", async (req, reply) => {
    try {
      await requireAdmin(req, env);
      const { id } = req.params as { id: string };
      const sel = restoreSelector.parse(req.body);
      const target = await resolveTarget(db, "signal", id, sel);
      if (!target) return reply.code(404).send(apiError("not_found", `no revision for ${id}`));
      const current = await store.findSignal(id, true);
      if (!current) return reply.code(404).send(apiError("not_found", `signal gone: ${id}`));
      const currentView = { digest: current.digest, experience: current.experience };
      const targetView = {
        digest: target.data.digest as string,
        experience: target.data.experience,
      };
      const { diff, diff_lines } = unifiedDiff(
        JSON.stringify(currentView, null, 2),
        JSON.stringify(targetView, null, 2),
      );
      return {
        id,
        to_rev: target.rev,
        to_event_id: target.id,
        created_at: target.created_at,
        target: targetView,
        current: currentView,
        diff,
        diff_lines,
        ...(diff_lines > 1024 ? { warning: "diff 过大（>1024 行），请确认后再 apply" } : {}),
      };
    } catch (err) {
      console.error("RESTORE-DRY-ERR:", err);
      return errorReply(reply, err);
    }
  });

  app.post("/admin/restore/agent/:id/dry-run", async (req, reply) => {
    try {
      await requireAdmin(req, env);
      const { id } = req.params as { id: string };
      const sel = restoreSelector.parse(req.body);
      const target = await resolveTarget(db, "agent", id, sel);
      if (!target) return reply.code(404).send(apiError("not_found", `no revision for ${id}`));
      const current = await store.agentByIdOrNumber(id);
      if (!current) return reply.code(404).send(apiError("not_found", `agent gone: ${id}`));
      console.error(
        "AGENT-DRY-DBG:",
        JSON.stringify({ target: target.data, current: { name: current.name } }),
      );
      const currentView = { name: current.name, description: current.description };
      const targetView = {
        name: target.data.name as string,
        description: target.data.description as string,
      };
      const { diff, diff_lines } = unifiedDiff(
        JSON.stringify(currentView, null, 2),
        JSON.stringify(targetView, null, 2),
      );
      return {
        id,
        to_rev: target.rev,
        target: targetView,
        current: currentView,
        diff,
        diff_lines,
        ...(diff_lines > 1024 ? { warning: "diff 过大（>1024 行）" } : {}),
      };
    } catch (err) {
      return errorReply(reply, err);
    }
  });

  app.post("/admin/restore/agent/:id/apply", async (req, reply) => {
    try {
      const admin = await requireAdmin(req, env);
      const { id } = req.params as { id: string };
      const sel = restoreSelector.parse(req.body);
      const chain = await verifyChain(db);
      if (!chain.ok) {
        return reply
          .code(409)
          .send(apiError("conflict", `账本链已损坏（broken_at ${chain.broken_at}），禁止还原`));
      }
      const target = await resolveTarget(db, "agent", id, sel);
      if (!target) return reply.code(404).send(apiError("not_found", `no revision for ${id}`));
      const current = await store.agentByIdOrNumber(id);
      if (!current) return reply.code(404).send(apiError("not_found", `agent gone: ${id}`));
      const targetName = target.data.name as string | undefined;
      const targetDesc = target.data.description as string | undefined;
      const unchanged = current.name === targetName && current.description === (targetDesc ?? "");
      if (unchanged) return { id, changed: false, to_rev: target.rev };
      await snapshotBefore(db, "agent", id, current);
      const restored = await store.updateAgentIdentity(id, {
        name: targetName,
        description: targetDesc,
      });
      if (!restored) return reply.code(404).send(apiError("not_found", `agent gone: ${id}`));
      await appendEvent(db, {
        actor: admin.actor,
        entityType: "agent",
        entityId: id,
        action: "restore",
        before: { name: current.name, description: current.description },
        after: { name: restored.name, description: restored.description },
      });
      return { id, changed: true, to_rev: target.rev, name: restored.name };
    } catch (err) {
      return errorReply(reply, err);
    }
  });

  app.post("/admin/restore/signal/:id/apply", async (req, reply) => {
    try {
      const admin = await requireAdmin(req, env);
      const { id } = req.params as { id: string };
      const sel = restoreSelector.parse(req.body);
      // MUST #1：链坏禁止一切还原
      const chain = await verifyChain(db);
      if (!chain.ok) {
        return reply
          .code(409)
          .send(apiError("conflict", `账本链已损坏（broken_at ${chain.broken_at}），禁止还原`));
      }
      const target = await resolveTarget(db, "signal", id, sel);
      if (!target) return reply.code(404).send(apiError("not_found", `no revision for ${id}`));
      const current = await store.findSignal(id, true);
      if (!current) return reply.code(404).send(apiError("not_found", `signal gone: ${id}`));
      const targetDigest = target.data.digest as string | undefined;
      const targetExp = target.data.experience as
        | { format: "markdown"; body: string }
        | null
        | undefined;
      const unchanged =
        current.digest === targetDigest &&
        JSON.stringify(current.experience) === JSON.stringify(targetExp ?? null);
      if (unchanged) {
        return { id, changed: false, to_rev: target.rev };
      }
      // 还原前先快照当前态（修订史继续追加，不删旧 rev）
      const { snapshotBefore } = await import("@agentssignal/audit");
      await snapshotBefore(db, "signal", id, current);
      const restored = await store.updateSignal(id, current.sender_agent_id, {
        ...(targetDigest !== undefined ? { digest: targetDigest } : {}),
        ...(targetExp ? { experience: targetExp } : {}),
      });
      if (!restored) return reply.code(404).send(apiError("not_found", `signal gone: ${id}`));
      await appendEvent(db, {
        actor: admin.actor,
        entityType: "signal",
        entityId: id,
        action: "restore",
        before: { digest: current.digest, experience: current.experience },
        after: { digest: restored.digest, experience: restored.experience },
      });
      return {
        id,
        changed: true,
        to_rev: target.rev,
        digest: restored.digest,
        verify: await verifyChain(db),
      };
    } catch (err) {
      return errorReply(reply, err);
    }
  });
}
