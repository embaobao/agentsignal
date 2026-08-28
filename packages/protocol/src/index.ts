/**
 * packages/protocol —— 协议单一真源：类型 + ID 工具 + zod schema + 错误码。
 *
 * 被 apps/api（边界校验）、packages/cli（本地校验）、apps/ui（表单 resolver）共用，
 * 任何一方都不得自行复制一份字段定义（瘦栈方案 §6-S1：全栈同构）。
 *
 * 语义权威源：docs/protocols/message-envelope.md v0.2 · docs/protocols/api.md v0.2
 */

export * from "./errors.ts";
export * from "./schemas.ts";
// 注：网络形态（信封/请求/响应）以 schemas.ts 的 zod 真源为准；
// types.ts 只导出领域类型，不提供客户端构建器（服务端字段一律服务端填充）。
export type {
  Agent,
  Experience,
  Origin,
  Outcome,
  Signal,
  SignalKind,
  Topic,
  ValidationLevel,
} from "./types.ts";
export * from "./ulid.ts";
