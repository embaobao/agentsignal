/**
 * 固化结构 v0（Experience-Message Schema）—— zod 声明式定义
 *
 * 扩展方式：只改这里一处；路由、测试、错误诊断自动跟随。
 * 内容语义不校验（格式后置裁定）——结构合法即收。
 */
import { z } from "zod";

export const TextPart = z.object({ kind: z.literal("text"), text: z.string() });
export const DataPart = z.object({
  kind: z.literal("data"),
  data: z.record(z.string(), z.unknown()),
});

export const ExperienceMessage = z
  .object({
    role: z.literal("user"),
    parts: z.array(z.discriminatedUnion("kind", [TextPart, DataPart])).min(1),
    messageId: z.string().min(1),
    contextId: z.literal("experience-share"),
  })
  .refine((m) => m.parts.some((p) => p.kind === "text"), {
    error: 'parts must contain at least one {kind:"text", text:string}',
  });

export type ExperienceMessage = z.infer<typeof ExperienceMessage>;

/** A2A agent card 工厂：按请求 origin 动态生成 url（本地/部署/测试随机端口通用） */
export function buildAgentCard(origin: string) {
  const url = `${origin}/`;
  return {
    protocolVersion: "0.2.9",
    name: "AgentSignal Share",
    description:
      "Experience-share endpoint: agents publish and fetch frozen-structure experience messages over A2A.",
    url,
    version: "0.1.0",
    capabilities: { streaming: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: [
      {
        id: "experience-share",
        name: "experience-share",
        description: "Publish and fetch frozen-structure experience messages (schema v0).",
      },
    ],
    // 新版 SDK（v1.x client）凭 supportedInterfaces 选 transport；JSONRPC 绑定 + 0.3 版本
    // 走 legacy wire（method=message/send），与我们的固化结构一致。
    supportedInterfaces: [
      { url, protocolBinding: "JSONRPC", tenant: "", protocolVersion: "0.3.0" },
    ],
  } as const;
}
