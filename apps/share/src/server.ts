/**
 * Fastify 应用工厂 —— A2A 经验内容端点
 *
 * 路由面（v0）：
 *   GET  /.well-known/agent-card.json   身份卡
 *   POST /                              JSON-RPC message/send（发布）
 *   GET  /messages?limit=               列表（最新在前）
 *   GET  /messages/:id                  单条（按 seq id 或 messageId）
 *
 * JSON-RPC 说明：仅 message/send 一个方法，分发保持极简；未来需要
 * task 生命周期 / streaming 时，切换 @a2a-js/sdk 的 jsonRpcHandler()
 * —— wire 格式不变，零迁移成本（包已在依赖中）。
 */

import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import Fastify from "fastify";
import { z } from "zod";
import { buildAgentCard, ExperienceMessage } from "./schema.ts";
import { ensureBoot, findEntry, newestEntries, readFileById, store } from "./store.ts";

/** JSON-RPC 信封（wire 层；message 体单独经 ExperienceMessage 校验） */
const RpcEnvelope = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  params: z.unknown().optional(),
});

const rpcError = (id: unknown, code: number, message: string, data?: unknown) => ({
  jsonrpc: "2.0" as const,
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

export function buildApp() {
  const app = Fastify({ logger: process.env.LOG === "1" }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // A2A 身份卡（静态）
  app.get("/.well-known/agent-card.json", async (req) =>
    buildAgentCard(`${req.protocol}://${req.headers.host}`),
  );

  // 发布：JSON-RPC message/send
  app.post(
    "/",
    {
      schema: {
        body: RpcEnvelope,
        response: { 200: z.unknown() }, // 响应体动态（result 或 error），不做序列化裁剪
      },
    },
    async (req, reply) => {
      const body = req.body as z.infer<typeof RpcEnvelope>;
      // 双 wire 互认：v0.3 的 "message/send" 与 SDK v1.0 的 "SendMessage"（PascalCase）
      if (body.method !== "message/send" && body.method !== "SendMessage")
        return rpcError(
          body.id ?? null,
          -32601,
          'Method not found (only "message/send" / "SendMessage" is supported)',
        );

      const params = body.params as { message?: unknown } | undefined;
      if (process.env.DEBUG_WIRE) console.log("WIRE msg:", JSON.stringify(params?.message).slice(0, 300));
      const parsed = ExperienceMessage.safeParse(params?.message);
      if (!parsed.success)
        return rpcError(body.id ?? null, -32602, "Invalid params", z.treeifyError(parsed.error));

      const stored = await store(parsed.data);
      return {
        jsonrpc: "2.0",
        id: body.id ?? null,
        result: {
          seq: stored._meta.seq,
          id: stored._meta.id,
          messageId: stored.message.messageId,
          message: stored.message,
        },
      };
    },
  );

  // 列表：最新在前，limit 1–200（默认 50）
  app.get(
    "/messages",
    {
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
      },
    },
    async (req) => {
      await ensureBoot();
      const { limit } = req.query as { limit: number };
      const messages = [];
      for (const e of newestEntries(limit)) messages.push((await readFileById(e.id)).message);
      return { count: messages.length, messages };
    },
  );

  // 单条：seq id（00001）或 messageId 皆可
  app.get("/messages/:id", async (req, reply) => {
    await ensureBoot();
    const { id } = req.params as { id: string };
    const entry = findEntry(id);
    if (!entry)
      return reply
        .code(404)
        .send({ error: { code: "not_found", message: `no message for id ${id}` } });
    return (await readFileById(entry.id)).message;
  });

  return app;
}
