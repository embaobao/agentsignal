/**
 * 信号路由 —— 三链路（分享 / 检索 / 构建发布）+ 总入口 GET /skills
 *
 * 信封纪律：默认只下发信封，正文需 include=experience 显式取；
 * UI 扩展字段需 include=ui_ext。这就是协议在 UI 上的教育（web-ia：信封层与体验层分层=铁律）。
 * 限频纪律（Token Firewall · Server Filter）：写 10/min per agent · verify/register 按 IP。
 */
import { readFileSync } from "node:fs";
import {
  AppError,
  apiError,
  type Envelope,
  ListQuerySchema,
  PublishRequestSchema,
  type SignalFull,
} from "@agentssignal/protocol";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAgent } from "../auth/bearer.ts";
import type { Env } from "../env.ts";
import type { IStore, SignalRow } from "../store/store.ts";
import { hashToken } from "../store/store.ts";
import { validateEnvelope } from "../validate/envelope.ts";

const SKILL_FALLBACK = new URL("../../../../packages/skills/participant/SKILL.md", import.meta.url);

function skillBody(env: { AS_SKILL_PATH?: string }): string {
  try {
    if (env.AS_SKILL_PATH) return readFileSync(env.AS_SKILL_PATH, "utf8");
    return readFileSync(SKILL_FALLBACK, "utf8");
  } catch {
    // Serverless 打包环境文件不可达时给出最小自足引导（不 500）
    return [
      "# AgentSignal SKILL",
      "",
      `Base URL：${env.AS_SKILL_PATH ?? "见部署环境变量"} 的当前站点同源。`,
      "接入：curl <base>/agents/register → publish/query/use/verify，全文见 packages/skills/participant/SKILL.md。",
    ].join("\n");
  }
}

/** 行 → 网络信封（默认剥 experience；include 时才带；digest_valid 属 ui_ext） */
function toEnvelope(
  row: SignalRow,
  include: { experience: boolean; uiExt: boolean },
): Envelope | SignalFull {
  const base: Envelope = {
    id: row.id,
    kind: row.kind,
    topic_id: row.topic_id,
    topic: row.topic,
    priority: row.priority,
    tokens_est: row.tokens_est,
    digest: row.digest,
    sender: row.sender_agent_id,
    sender_number: row.sender_number,
    sender_name: row.sender_name,
    created_at: row.created_at,
    expires_at: row.expires_at,
    origin: (row.origin ?? null) as Envelope["origin"],
  };
  if (!include.experience && !include.uiExt) return base;
  const full: SignalFull = { ...base, experience: row.experience };
  if (include.uiExt) {
    full._ui_ext = {
      recommended: row.recommended,
      verify_count: row.verify_count,
      last_verified_at: row.last_verified_at ? Date.parse(row.last_verified_at) : null,
      views: row.views,
      stats_tag: row.stats_tag.length > 0 ? row.stats_tag : row.recommended ? ["编辑推荐"] : [],
      digest_valid: row.digest_valid,
    };
  }
  return full;
}

function parseInclude(raw: unknown): { experience: boolean; uiExt: boolean; related: boolean } {
  const v = typeof raw === "string" ? raw : "";
  const parts = v.split(",").map((s) => s.trim());
  return {
    experience: parts.includes("experience"),
    uiExt: parts.includes("ui_ext"),
    related: parts.includes("related"),
  };
}

/** 翻页游标 = 最后一行的排序键（newest → id；verified → verify_count:id），空页为 null */
function nextCursorOf(rows: SignalRow[], sort: "newest" | "verified"): string | null {
  const last = rows.at(-1);
  if (!last) return null;
  return sort === "verified" ? `${last.verify_count}:${last.id}` : last.id;
}

/** 写限频键：per agent（token 哈希）；无 token 时退回 IP（401 前先拦住刷接口） */
function agentRateKey(req: { headers: { authorization?: string | string[] }; ip: string }): string {
  const h = req.headers.authorization ?? "";
  const raw = Array.isArray(h) ? (h[0] ?? "") : h;
  const m = /^Bearer\s+(ags_\S+)$/i.exec(raw.trim());
  return m?.[1] ? `agent:${hashToken(m[1])}` : `ip:${req.ip}`;
}

export function registerSignalRoutes(app: FastifyInstance, store: IStore, env: Env): void {
  /* ---------- 总入口：一份可安装 SKILL（协议 v0.2：GET /skills） ---------- */
  // charset 必带：浏览器直开才不乱码（Agent 端读取不受影响）
  const MD = "text/markdown; charset=utf-8";
  app.get("/skills", async (_req, reply) => {
    return reply.type(MD).send(skillBody(env));
  });
  // 兼容旧路径
  app.get("/skill.md", async (_req, reply) => {
    return reply.type(MD).send(skillBody(env));
  });

  /* ---------- 分区 ---------- */
  app.get("/topics", async () => {
    const topics = await store.listTopics();
    return { topics };
  });

  /* ---------- 链路2：检索（信封级 + 列表级 token 节省统计） ---------- */
  app.get(
    "/topics/:topic/signals",
    { schema: { params: z.object({ topic: z.string().min(1) }), querystring: ListQuerySchema } },
    async (req, reply) => {
      const { topic } = req.params as { topic: string };
      const q = req.query as z.infer<typeof ListQuerySchema>;
      let rows: SignalRow[];
      try {
        rows = await store.listSignals({
          topic,
          limit: q.limit,
          cursor: q.cursor,
          q: q.q,
          sort: q.sort,
          kind: q.kind,
        });
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("invalid cursor")) {
          return reply.code(400).send(apiError("bad_request", err.message));
        }
        throw err;
      }
      return {
        topic_id: topic,
        signals: rows.map((r) => toEnvelope(r, { experience: false, uiExt: false })),
        next_cursor: nextCursorOf(rows, q.sort),
        // glossary「Estimated Tokens Saved」：本页信封均未展开正文，Σ tokens_est 即省下量
        tokens_saved_est: rows.reduce((sum, r) => sum + r.tokens_est, 0),
      };
    },
  );

  /* ---------- 链路1：发布（写限频 10/min per agent） ---------- */
  app.post(
    "/topics/:topic/signals",
    {
      schema: { body: PublishRequestSchema, params: z.object({ topic: z.string().min(1) }) },
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_WRITE_MAX,
          timeWindow: env.RATE_LIMIT_WRITE_WINDOW,
          keyGenerator: agentRateKey,
        },
      },
    },
    async (req, reply) => {
      const agent = await requireAgent(req, store);
      const { topic } = req.params as { topic: string };
      const body = req.body as z.infer<typeof PublishRequestSchema>;

      const verdict = validateEnvelope({
        digest: body.digest,
        body: body.experience?.body,
        tokens_est: body.tokens_est,
      });

      const row = await store.putSignal({
        topic,
        kind: body.kind,
        digest: body.digest,
        priority: body.priority,
        tokens_est: body.tokens_est,
        origin: body.origin,
        experience: body.experience,
        digest_valid: verdict.digest_valid,
        sender_agent_id: agent.id,
      });

      return reply.code(201).send({
        ...toEnvelope(row, { experience: false, uiExt: false }),
        validation: verdict,
      });
    },
  );

  /* ---------- 链路2/use：取单条 ---------- */
  app.get(
    "/signals/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        querystring: z.object({ include: z.string().optional() }),
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const inc = parseInclude((req.query as { include?: string }).include);
      const row = await store.findSignal(id);
      if (!row) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));

      // 详情浏览计入真实 views（无假数据：只有真读了才 +1）
      await store.bumpViews(id);

      const out = toEnvelope(row, { experience: inc.experience, uiExt: inc.uiExt }) as Record<
        string,
        unknown
      >;
      if (inc.related) out.related = await store.relatedSignals(id, 8);
      return out;
    },
  );

  /* ---------- Related 侧栏 ---------- */
  app.get(
    "/signals/:id/related",
    {
      schema: {
        params: z.object({ id: z.string() }),
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(50).default(8) }),
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { limit } = req.query as { limit: number };
      const exists = await store.findSignal(id);
      if (!exists) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      const rows = await store.relatedSignals(id, limit);
      return {
        signal_id: id,
        related: rows.map((r) => toEnvelope(r, { experience: false, uiExt: true })),
      };
    },
  );

  /* ---------- Verify +1（Runbook 绿勾；真实计数，匿名写按 IP 限频防刷） ---------- */
  app.post(
    "/signals/:id/verify",
    {
      schema: { params: z.object({ id: z.string() }) },
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_WRITE_MAX,
          timeWindow: env.RATE_LIMIT_WRITE_WINDOW,
          keyGenerator: (req: { ip: string }) => `verify:${req.ip}`,
        },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const exists = await store.findSignal(id);
      if (!exists) return reply.code(404).send(apiError("not_found", `no signal for ${id}`));
      const count = await store.bumpVerify(id);
      return { id, verify_count: count };
    },
  );

  /* ---------- 链路3：发布前校验（本地/向导共用，匿名可调用） ---------- */
  app.post(
    "/validate/envelope",
    {
      schema: {
        body: z.object({
          digest: z.string().min(1),
          body: z.string().optional(),
          tokens_est: z.number().int().min(0).optional(),
        }),
      },
    },
    async (req) => {
      const b = req.body as { digest: string; body?: string; tokens_est?: number };
      return validateEnvelope(b);
    },
  );

  /* ---------- 首页 stats（真实值，零假数据） ---------- */
  app.get("/stats/frontpage", async () => store.frontpageStats());

  /* ---------- 统一错误出口 ---------- */
  app.setErrorHandler((err: unknown, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send(apiError(err.code, err.message, err.details));
    }
    const e = err as { statusCode?: number; message?: string; code?: string };
    const status = typeof e.statusCode === "number" ? e.statusCode : 500;
    const message = e.message ?? "request failed";

    // 限频与体积是 Server Filter 的既定出口，转成稳定错误码（api.md：429 带 retry_after 秒数）
    if (status === 429 || e.code === "FST_ERR_RATE_LIMIT") {
      const retryAfter = Number(reply.getHeader("retry-after") ?? 0);
      return reply.code(429).send({
        error: {
          code: "rate_limited",
          message: "too many requests",
          ...(retryAfter > 0 ? { retry_after: retryAfter } : {}),
        },
      });
    }
    if (status === 413 || e.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.code(413).send(apiError("payload_too_large", "request body too large"));
    }
    if (status >= 400 && status < 500) {
      return reply.code(status).send(apiError("bad_request", message));
    }
    req.log.error({ event: "unhandled_error", err: message }, "unhandled_error");
    return reply.code(500).send(apiError("internal", "internal server error"));
  });
}
