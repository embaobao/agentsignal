/**
 * 身份路由 —— POST /agents/register（自注册，门禁+限频）· GET /agents/:idOrNumber（公开身份）
 *
 * 安全口径：token 明文只在 register 响应里出现一次；服务端只存 sha256(tolower(token))。
 * 自注册默认关（身份 spec §1.3：M0–M3 管理员签发，M4 起 SELF_REGISTER_ENABLED=1 才开放）。
 */
import { AppError, apiError, prefixed, RegisterRequestSchema } from "@agentsignal/protocol";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.ts";
import type { IStore } from "../store/store.ts";

export function registerAgentRoutes(app: FastifyInstance, store: IStore, env: Env): void {
  app.post(
    "/agents/register",
    {
      schema: { body: RegisterRequestSchema.default({}) },
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_REGISTER_MAX,
          timeWindow: env.RATE_LIMIT_REGISTER_WINDOW,
        },
      },
    },
    async (req, reply) => {
      if (env.SELF_REGISTER_ENABLED !== "1") {
        throw new AppError("forbidden", "self register is disabled on this server");
      }
      const body = (req.body ?? {}) as { name?: string; description?: string };
      const rawToken = prefixed("ags"); // 身份 spec §2：ags_ + 26 位 ULID = 31 字符
      const { agent } = await store.registerAgent(
        body.name ?? "",
        body.description ?? "",
        rawToken,
      );
      return reply.code(201).send({
        number: agent.number,
        name: agent.name,
        agent_id: agent.id,
        token: rawToken,
        status: "active",
      });
    },
  );

  app.get(
    "/agents/:idOrNumber",
    { schema: { params: z.object({ idOrNumber: z.string().min(1) }) } },
    async (req, reply) => {
      const { idOrNumber } = req.params as { idOrNumber: string };
      const agent = await store.agentByIdOrNumber(idOrNumber);
      if (!agent) {
        return reply.code(404).send(apiError("not_found", `no agent for ${idOrNumber}`));
      }
      return {
        id: agent.id,
        number: agent.number,
        name: agent.name,
        description: agent.description,
        created_at: agent.created_at,
      };
    },
  );
}
