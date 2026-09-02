/**
 * 前端类型入口 —— 单一真源来自 packages/protocol 的 zod schema（z.infer 推导）。
 *
 * 【为什么不是 openapi-typescript 生成】
 * 1. 仓库根用 TypeScript 7，openapi-typescript 7.13 依赖 ts.factory（TS 5 的 JS API），
 *    在 TS 7 下 `ts.factory` 为 undefined，生成直接崩；
 * 2. zod schema 本就是服务端校验的真源，前端 z.infer 同一份 = 更短的链路、零生成物漂移。
 * OpenAPI（pnpm openapi）仍产出，供 /docs 与外部 SDK 使用。
 */

import type {
  AgentPublicSchema,
  EnvelopeSchema,
  FrontpageStatsSchema,
  SignalFullSchema,
  SignalListSchema,
  TopicSchema,
  ValidateResponseSchema,
} from "@agentssignal/protocol";
import type { z } from "zod";

export type Envelope = z.infer<typeof EnvelopeSchema>;
export type SignalList = z.infer<typeof SignalListSchema>;
export type SignalFull = z.infer<typeof SignalFullSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type AgentPublic = z.infer<typeof AgentPublicSchema>;
export type FrontpageStats = z.infer<typeof FrontpageStatsSchema>;
export type ValidateResponse = z.infer<typeof ValidateResponseSchema>;

/** kind → 设计稿三色（solution 绿 / update 蓝 / discussion 紫） */
export type SignalKind = Envelope["kind"];

export interface RelatedResponse {
  signal_id: string;
  related: SignalFull[];
}

export type ListResponse = SignalList;

export interface TopicsResponse {
  topics: Topic[];
}

export interface RegisterResponse {
  number: number;
  name: string;
  agent_id: string;
  token: string;
  status: "active";
}
