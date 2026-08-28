/**
 * zod 单一真源 —— 全栈共用（Fastify 边界校验 / CLI 本地校验 / 前端表单 resolver）。
 *
 * 纪律：任何字段增删先改这里，再改 docs/protocols/*，最后才是消费方。
 * 语义权威源：docs/protocols/message-envelope.md v0.2 · docs/protocols/api.md v0.2
 */
import { z } from "zod";
import { signalKinds } from "./types.ts";

/** 三种 kind（不加第四种）—— 常量真源在 types.ts，此处只做 schema 化 */
export { signalKinds };
export const SignalKindSchema = z.enum(signalKinds);

/** digest 三段式的 validation 段取值 */
export const validationLevels = ["none", "self-tested", "battle-tested"] as const;
export const ValidationLevelSchema = z.enum(validationLevels);

/** 硬校验限（signal spec §4：digest 10–220 · body_md ≤50k · tokens_est 0–1e5，超限 400） */
export const DIGEST_MIN = 10;
export const DIGEST_MAX = 220;
export const BODY_MAX = 50_000;
export const TOKENS_EST_MAX = 100_000;

export const ExperienceSchema = z.object({
  format: z.literal("markdown"),
  body: z.string().min(1, "experience.body 不可为空").max(BODY_MAX),
});

export const OriginSchema = z.object({
  kind: z.enum(["github", "skill-file", "text"]),
  ref: z.string().min(1),
  path: z.string().optional(),
});

/** 发布请求体（客户端可提交的字段；sender/created_at 由服务端填充） */
export const PublishRequestSchema = z.object({
  kind: SignalKindSchema,
  digest: z.string().min(DIGEST_MIN).max(DIGEST_MAX),
  priority: z.number().int().min(0).max(100).default(30),
  tokens_est: z.number().int().min(0).max(TOKENS_EST_MAX).default(0),
  origin: OriginSchema.optional(),
  experience: ExperienceSchema.optional(),
});

export const RegisterRequestSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  description: z.string().max(200).optional(),
});

/** 列表查询参数（游标分页 + 关键词 + 排序 + kind 过滤） */
export const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  // newest 排序传 sig_ id；verified 排序传 "<verify_count>:<sig_ id>" 复合游标（响应 next_cursor 直接回传）
  cursor: z.string().max(120).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(["newest", "verified"]).default("newest"),
  kind: SignalKindSchema.optional(),
});

/**
 * include 参数：逗号分隔字符串（experience / ui_ext / related）。
 * 刻意不做 zod transform —— zod v4 的 transform+pipe 在 unknown 输入下类型不收敛，
 * 解析逻辑统一放在路由层的 parseInclude()，行为一致且更好测。
 */
export const includeValues = ["experience", "ui_ext", "related"] as const;
export const IncludeQuerySchema = z.object({
  include: z.string().max(100).optional(),
});

/**
 * 信封（网络下发的默认形态；不含 experience）。
 * digest_valid 属 UI 扩展（signal spec §1：ui_ext.digest_valid）；tokens_saved_est 是
 * 列表级统计（glossary：Σ tokens_est × dropped_count），都不在单条信封上。
 */
export const EnvelopeSchema = z.object({
  id: z.string(),
  kind: SignalKindSchema,
  topic_id: z.string(),
  topic: z.string(),
  priority: z.number().int(),
  tokens_est: z.number().int(),
  digest: z.string(),
  sender: z.string(),
  sender_number: z.number().int().nullable(),
  sender_name: z.string().nullable(),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  origin: OriginSchema.nullable(),
});

/** 列表响应：信封级，另附游标与「未展开即省下」的 token 统计 */
export const SignalListSchema = z.object({
  topic_id: z.string(),
  signals: z.array(EnvelopeSchema),
  next_cursor: z.string().nullable(),
  tokens_saved_est: z.number().int(),
});

/** UI 扩展字段（视图模型，不进核心协议；端点默认剥离，include=ui_ext 才下发） */
export const UiExtSchema = z.object({
  recommended: z.boolean(),
  verify_count: z.number().int(),
  last_verified_at: z.number().nullable(),
  views: z.number().int(),
  stats_tag: z.array(z.string()),
  digest_valid: z.boolean(),
});

export const SignalFullSchema = EnvelopeSchema.extend({
  experience: ExperienceSchema.nullable(),
  _ui_ext: UiExtSchema.optional(),
});

export const TopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  mode: z.enum(["broadcast", "forum"]),
  signal_count: z.number().int(),
});

export const AgentPublicSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  name: z.string(),
  description: z.string(),
  created_at: z.string(),
});

export const RegisterResponseSchema = z.object({
  number: z.number().int(),
  name: z.string(),
  agent_id: z.string(),
  token: z.string(), // 明文仅此一次
  status: z.literal("active"),
});

export const FrontpageStatsSchema = z.object({
  signals: z.number().int(),
  agents: z.number().int(),
  topics: z.number().int(),
  installs: z.number().int(),
  new_this_week: z.number().int(),
});

/** 校验结果（软约束：不拦发布，只标记） */
export const ValidateResponseSchema = z.object({
  valid: z.boolean(),
  digest_valid: z.boolean(),
  section_hits: z.array(z.string()),
  section_rate: z.number(),
  warnings: z.array(
    z.object({ code: z.string(), message: z.string(), level: z.enum(["warn", "info"]) }),
  ),
});

/** 容器探针（/healthz · /readyz）—— 从 errors.ts 迁来：健康关注点归 schema 真源 */
export const HealthSchema = z.object({
  status: z.literal("ok"),
  uptimeSec: z.number().int(),
  version: z.string(),
});

export const ReadySchema = z.object({
  status: z.enum(["ready", "degraded"]),
  store: z.enum(["up", "down"]),
  migration: z.string(),
  driver: z.enum(["pglite", "pg"]),
});

export type PublishRequest = z.infer<typeof PublishRequestSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
export type Envelope = z.infer<typeof EnvelopeSchema>;
export type SignalList = z.infer<typeof SignalListSchema>;
export type SignalFull = z.infer<typeof SignalFullSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type AgentPublic = z.infer<typeof AgentPublicSchema>;
export type FrontpageStats = z.infer<typeof FrontpageStatsSchema>;
export type ValidateResponse = z.infer<typeof ValidateResponseSchema>;
export type Health = z.infer<typeof HealthSchema>;
export type Ready = z.infer<typeof ReadySchema>;
