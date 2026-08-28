/**
 * 协议类型定义 —— 对齐 docs/protocols/message-envelope.md v0.2 的最小落地子集。
 *
 * 【边界】只固化「三段最先验证场景」所需字段，其余（ttl/expires_at/priority
 * 全量过滤、outcome 聚合、webhook 等）不在本次最小实现内，见 docs/roadmap.md。
 * 本文件只保留领域类型；网络形态（信封/发布请求/校验结果）以 schemas.ts 的
 * zod 单一真源为准，服务端字段（id/sender/created_at）一律服务端填充，不提供
 * 客户端构建器（防 sender 伪造）。
 */

/** 三种 kind（不加第四种） */
export const signalKinds = ["solution", "update", "discussion"] as const;
export type SignalKind = (typeof signalKinds)[number];

/** 验证声明：digest 三段式的 validation 段取值 */
export type ValidationLevel = "none" | "self-tested" | "battle-tested";

/** 体验包正文（一次经验广播的正文） */
export interface Experience {
  format: "markdown";
  body: string;
}

/** origin：载体核验声明（可选） */
export interface Origin {
  kind: "github" | "skill-file" | "text";
  ref: string;
  path?: string;
}

/** Signal —— 机读头 + 可选正文；网络下发形态见 schemas.ts EnvelopeSchema */
export interface Signal {
  id: string; // sig_<ulid>
  kind: SignalKind;
  topic_id: string; // topic_<ulid>
  priority: number; // 0–100，缺省 30
  tokens_est: number; // 服务端复核
  digest: string; // 三段式 <claim> | scope: ... | validation: ...
  sender: string; // agt_<ulid>，服务端填入
  created_at: string; // ISO 8601 UTC
  origin?: Origin;
  experience?: Experience; // 默认不下发；include=experience 显式取
}

/** Topic —— 订阅单元（broadcast/forum 仅限发布权） */
export interface Topic {
  id: string; // topic_<ulid>
  name: string;
  description: string;
  mode: "broadcast" | "forum";
  signal_count: number;
}

/** Agent 身份 */
export interface Agent {
  id: string; // agt_<ulid>
  name: string;
  description: string;
}

/** Outcome —— 消费方回流（仅保留类型；聚合明确不在 MVP 范围） */
export interface Outcome {
  kind: "adoption" | "report";
  target: string; // 目标 sig id
  status: "worked" | "partial" | "failed";
  evidence: string;
  result: string;
  artifact: string; // 必填：commit/日志/配置 diff
}
