// src/errors.ts
import { z } from "zod";
var errorCodes = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "payload_too_large",
  "rate_limited",
  "unsupported_media_type",
  "internal"
];
var DEFAULT_STATUS = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  unsupported_media_type: 415,
  internal: 500
};
var ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(errorCodes),
    message: z.string(),
    details: z.unknown().optional()
  })
});
function apiError(code, message, details) {
  return { error: details === void 0 ? { code, message } : { code, message, details } };
}
var AppError = class extends Error {
  code;
  status;
  details;
  constructor(code, message, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = DEFAULT_STATUS[code];
    this.details = details;
  }
};

// src/schemas.ts
import { z as z2 } from "zod";

// src/types.ts
var signalKinds = ["solution", "update", "discussion"];

// src/schemas.ts
var SignalKindSchema = z2.enum(signalKinds);
var validationLevels = ["none", "self-tested", "battle-tested"];
var ValidationLevelSchema = z2.enum(validationLevels);
var DIGEST_MIN = 10;
var DIGEST_MAX = 220;
var BODY_MAX = 5e4;
var TOKENS_EST_MAX = 1e5;
var ExperienceSchema = z2.object({
  format: z2.literal("markdown"),
  body: z2.string().min(1, "experience.body \u4E0D\u53EF\u4E3A\u7A7A").max(BODY_MAX)
});
var OriginSchema = z2.object({
  kind: z2.enum(["github", "skill-file", "text"]),
  ref: z2.string().min(1),
  path: z2.string().optional()
});
var PublishRequestSchema = z2.object({
  kind: SignalKindSchema,
  digest: z2.string().min(DIGEST_MIN).max(DIGEST_MAX),
  priority: z2.number().int().min(0).max(100).default(30),
  tokens_est: z2.number().int().min(0).max(TOKENS_EST_MAX).default(0),
  origin: OriginSchema.optional(),
  experience: ExperienceSchema.optional()
});
var RegisterRequestSchema = z2.object({
  name: z2.string().min(1).max(40).optional(),
  description: z2.string().max(200).optional()
});
var ListQuerySchema = z2.object({
  limit: z2.coerce.number().int().min(1).max(200).default(20),
  // newest 排序传 sig_ id；verified 排序传 "<verify_count>:<sig_ id>" 复合游标（响应 next_cursor 直接回传）
  cursor: z2.string().max(120).optional(),
  q: z2.string().max(200).optional(),
  sort: z2.enum(["newest", "verified"]).default("newest"),
  kind: SignalKindSchema.optional()
});
var includeValues = ["experience", "ui_ext", "related"];
var IncludeQuerySchema = z2.object({
  include: z2.string().max(100).optional()
});
var EnvelopeSchema = z2.object({
  id: z2.string(),
  kind: SignalKindSchema,
  topic_id: z2.string(),
  topic: z2.string(),
  priority: z2.number().int(),
  tokens_est: z2.number().int(),
  digest: z2.string(),
  sender: z2.string(),
  sender_number: z2.number().int().nullable(),
  sender_name: z2.string().nullable(),
  created_at: z2.string(),
  expires_at: z2.string().nullable(),
  origin: OriginSchema.nullable()
});
var SignalListSchema = z2.object({
  topic_id: z2.string(),
  signals: z2.array(EnvelopeSchema),
  next_cursor: z2.string().nullable(),
  tokens_saved_est: z2.number().int()
});
var UiExtSchema = z2.object({
  recommended: z2.boolean(),
  verify_count: z2.number().int(),
  last_verified_at: z2.number().nullable(),
  views: z2.number().int(),
  stats_tag: z2.array(z2.string()),
  digest_valid: z2.boolean(),
  /** verdict 聚合（仅详情接口下发；列表接口逐条查询会 N+1，不下发） */
  verify_total: z2.number().int().optional(),
  verify_worked: z2.number().int().optional(),
  verify_partial: z2.number().int().optional(),
  verify_failed: z2.number().int().optional()
});
var SignalFullSchema = EnvelopeSchema.extend({
  experience: ExperienceSchema.nullable(),
  _ui_ext: UiExtSchema.optional()
});
var TopicSchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  slug: z2.string(),
  description: z2.string(),
  mode: z2.enum(["broadcast", "forum"]),
  signal_count: z2.number().int()
});
var AgentPublicSchema = z2.object({
  id: z2.string(),
  number: z2.number().int(),
  name: z2.string(),
  description: z2.string(),
  created_at: z2.string()
});
var RegisterResponseSchema = z2.object({
  number: z2.number().int(),
  name: z2.string(),
  agent_id: z2.string(),
  token: z2.string(),
  // 明文仅此一次
  status: z2.literal("active")
});
var FrontpageStatsSchema = z2.object({
  signals: z2.number().int(),
  agents: z2.number().int(),
  topics: z2.number().int(),
  installs: z2.number().int(),
  new_this_week: z2.number().int()
});
var ValidateResponseSchema = z2.object({
  valid: z2.boolean(),
  digest_valid: z2.boolean(),
  section_hits: z2.array(z2.string()),
  section_rate: z2.number(),
  warnings: z2.array(
    z2.object({ code: z2.string(), message: z2.string(), level: z2.enum(["warn", "info"]) })
  )
});
var HealthSchema = z2.object({
  status: z2.literal("ok"),
  uptimeSec: z2.number().int(),
  version: z2.string()
});
var ReadySchema = z2.object({
  status: z2.enum(["ready", "degraded"]),
  store: z2.enum(["up", "down"]),
  migration: z2.string(),
  driver: z2.enum(["pglite", "pg"])
});

// src/skill-schema.ts
import { z as z3 } from "zod";
var skillStatuses = ["incubating", "solidified", "archived"];
var autoLoadModes = ["true", "detect_stack", "trigger_match", "false"];
var triggerFields = ["task", "stack", "domain", "keyword"];
var triggerOperators = ["contains_any", "includes", "equals"];
var parameterTypes = ["string", "number", "boolean", "duration"];
var SKILL_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;
var builtinLayerIds = ["base", "domain", "task", "session"];
var LAYER_MAX_TOKENS_CEILING = 8192;
var TriggerRuleSchema = z3.object({
  field: z3.enum(triggerFields),
  operator: z3.enum(triggerOperators),
  values: z3.array(z3.string().min(1)).min(1),
  weight: z3.number().min(0).max(1).default(1)
});
var SkillParametersSchema = z3.record(
  z3.string(),
  z3.object({
    type: z3.enum(parameterTypes),
    description: z3.string().optional(),
    default: z3.union([z3.string(), z3.number(), z3.boolean()]).optional(),
    required: z3.boolean().default(false),
    options: z3.array(z3.string()).optional()
  })
);
var SkillDependenciesSchema = z3.object({
  /** 环境变量名（存在性预检，不读值） */
  env: z3.array(z3.string()).default([]),
  /** 可执行文件（PATH 预检） */
  bins: z3.array(z3.string()).default([]),
  /** 包名声明（仅提示，不做安装） */
  packages: z3.array(z3.string()).default([])
}).default(() => ({ env: [], bins: [], packages: [] }));
var SkillProvenanceSchema = z3.object({
  /** 源 sig_<ulid>（订阅 kind=solution 落盘时写入） */
  sig_id: z3.string().optional(),
  digest: z3.string().optional(),
  origin: z3.object({ kind: z3.string(), ref: z3.string(), path: z3.string().optional() }).optional(),
  published_at: z3.string().optional(),
  // === 2026-09-08 dynamic-skill-management 扩展（订阅落库溯源全录，全部 optional）===
  /** 技能来源站点（回流镜像 verify 时据此回传） */
  base_url: z3.string().optional(),
  topic: z3.string().optional(),
  validation: z3.enum(validationLevels).optional(),
  /** 最近一次同步时间（ISO 8601） */
  synced_at: z3.string().optional()
});
var skillSyncStates = ["active", "outdated", "revoked"];
var SkillLifecycleSchema = z3.object({
  status: z3.enum(skillStatuses).default("incubating"),
  provenance: SkillProvenanceSchema.optional(),
  metrics: z3.object({
    use_count: z3.number().int().min(0).default(0),
    worked: z3.number().int().min(0).default(0),
    partial: z3.number().int().min(0).default(0),
    failed: z3.number().int().min(0).default(0),
    /** 三计数分立（P5 5.3 · S2 缺口）：被检索命中 +1（used 即 use_count，呈现层映射） */
    retrieved: z3.number().int().min(0).default(0),
    /** 被注入模型上下文（loadDetail 成功）+1 */
    injected: z3.number().int().min(0).default(0)
  }).default(() => ({
    use_count: 0,
    worked: 0,
    partial: 0,
    failed: 0,
    retrieved: 0,
    injected: 0
  })),
  /** 订阅同步状态（dynamic-skill-management P3：源信号有更新/失效时由同步器改写） */
  sync_state: z3.enum(skillSyncStates).default("active"),
  /** 锚定到本技能的平台更新记录（更新正文在同目录 UPDATES.md 附加层） */
  updates: z3.array(z3.object({ sig_id: z3.string(), digest: z3.string(), synced_at: z3.string() })).default([])
}).default(() => ({
  status: "incubating",
  metrics: { use_count: 0, worked: 0, partial: 0, failed: 0, retrieved: 0, injected: 0 },
  sync_state: "active",
  updates: []
}));
var SkillVerifyTargetSchema = z3.object({
  statement: z3.string().min(1),
  checks: z3.array(z3.string().min(1)).default([])
});
var SkillFrontmatterSchema = z3.object({
  // === 必收六字段 ===
  id: z3.string().regex(SKILL_ID_PATTERN, "id \u987B\u4E3A\u5C0F\u5199 slug\uFF08[a-z][a-z0-9_-]*\uFF09"),
  name: z3.string().min(1),
  description: z3.string().min(1),
  /** 业务域；含 "common" 表示全域可见 */
  domains: z3.array(z3.string().min(1)).min(1),
  /** 归属分层 id（须存在于 config.layers） */
  layers: z3.array(z3.string().min(1)).min(1),
  /** 触发规则：检索主路径（weighted 求和过 match_threshold） */
  triggers: z3.array(TriggerRuleSchema),
  // === AgentSignal 扩展（optional 安全默认）===
  /** keywords：trigger 缺省时的 fallback 规则源 */
  keywords: z3.array(z3.string()).default([]),
  version: z3.string().default("0.1.0"),
  dependencies: SkillDependenciesSchema,
  /** mustache 参数声明（四来源链解析） */
  parameters: SkillParametersSchema.default(() => ({})),
  /** verify_target：verify_skill 的可核验目标（P5 起新形态 {statement, checks[]}；
   *  历史形态 null 与字符串数组照旧可读（零破坏），归一归引擎层 normalizeVerifyTarget） */
  verify_target: z3.union([SkillVerifyTargetSchema, z3.array(z3.string()), z3.null()]).optional(),
  /** 正文引用（正文存储在同级 SKILL.md） */
  content: z3.object({
    format: z3.string().default("markdown"),
    path: z3.string().default("./SKILL.md"),
    tokens_est: z3.number().int().min(0).optional()
  }).default(() => ({ format: "markdown", path: "./SKILL.md" })),
  lifecycle: SkillLifecycleSchema
});
var ArtifactFrontmatterSchema = z3.object({
  name: z3.string().min(1),
  description: z3.string().min(1)
});
function parseArtifactFrontmatter(raw, expectedDirName) {
  const parsed = ArtifactFrontmatterSchema.parse(raw);
  if (expectedDirName !== void 0 && parsed.name !== expectedDirName) {
    throw new Error(
      `\u4EA7\u7269 frontmatter name\uFF08${parsed.name}\uFF09\u2260 \u843D\u88C5\u76EE\u5F55\u540D\uFF08${expectedDirName}\uFF09\u2014\u2014\u4EA7\u7269 name \u5FC5\u987B\u7B49\u4E8E\u76EE\u5F55\u540D`
    );
  }
  return parsed;
}
var SubscriptionSchema = z3.object({
  topic: z3.string().min(1),
  /** 游标（sig_<ulid>）；缺省 = 从头同步 */
  cursor: z3.string().optional(),
  /** 同步过滤阈值：validation 低于阈值的 solution 不落库 */
  min_validation: z3.enum(validationLevels).default("none")
});
var SyncStateSchema = z3.object({
  subscriptions: z3.array(SubscriptionSchema).default([]),
  /** verify_skill 本地裁决后自动镜像平台 verify（默认 false，手动优先——决议裁决 4） */
  mirror_verify: z3.boolean().default(false),
  /** 本地技能库容量上限（超限只告警 + 管理界面列清理候选，不自动删） */
  max_skills: z3.number().int().min(1).default(200)
});
var ConfigLayerSchema = z3.object({
  id: z3.string().min(1),
  name: z3.string().min(1),
  description: z3.string().optional(),
  auto_load: z3.enum(autoLoadModes),
  max_tokens: z3.number().int().min(0).max(LAYER_MAX_TOKENS_CEILING),
  /** trigger_match 层的过阈值 */
  match_threshold: z3.number().min(0).max(1).default(0.8),
  /** detect_stack 层的栈规则组（MVP 只内置 Next.js+TS） */
  stack_rules: z3.array(
    z3.object({
      name: z3.string().min(1),
      /** 全部命中才加载该组 */
      match: z3.array(
        z3.object({
          file: z3.string().min(1),
          exists: z3.boolean().optional(),
          contains: z3.string().optional()
        })
      )
    })
  ).default([])
});
var HostBindingSchema = z3.object({
  /** 宿主标识：claude-code | cursor | codex | cline | gemini | hermes（host-matrix-alignment Phase 1 起） */
  host: z3.enum(["claude-code", "cursor", "codex", "cline", "gemini", "hermes"]),
  wired: z3.boolean().default(false),
  /** 实际写入的配置文件绝对路径 */
  config_path: z3.string().optional()
});
var ConfigSchema = z3.object({
  version: z3.string().default("1.0.0"),
  domains: z3.object({
    /** 当前激活域；空 = 通用 */
    current: z3.string().default("common"),
    available: z3.array(z3.string().min(1)).default(["common"])
  }).default(() => ({ current: "common", available: ["common"] })),
  /** 分层：数组即顺序，即优先级，即加载链 */
  layers: z3.array(ConfigLayerSchema).min(1),
  hosts: z3.array(HostBindingSchema).default([]),
  arbitration: z3.object({
    strategy: z3.enum(["lru"]).default("lru"),
    fallback: z3.enum(["compress"]).default("compress")
  }).default(() => ({ strategy: "lru", fallback: "compress" })),
  /** 订阅落库 × 回流闭环（dynamic-skill-management；缺省安全默认） */
  sync: SyncStateSchema.default(() => ({ subscriptions: [], mirror_verify: false, max_skills: 200 }))
});

// src/ulid.ts
var CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
var TIME_CHARS = 10;
var RANDOM_CHARS = 16;
var TOTAL = TIME_CHARS + RANDOM_CHARS;
var rand = (n) => {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += CROCKFORD[b % 32];
  return s;
};
function encodeTime(ms) {
  let s = "";
  for (let i = TIME_CHARS - 1; i >= 0; i--) {
    s = CROCKFORD[ms % 32 & 31] + s;
    ms = Math.floor(ms / 32);
  }
  return s;
}
function ulid(now = Date.now()) {
  return encodeTime(now) + rand(RANDOM_CHARS);
}
function prefixed(prefix) {
  return `${prefix}_${ulid()}`;
}
function isPrefixed(prefix, id) {
  if (!id.startsWith(`${prefix}_`)) return false;
  const body = id.slice(prefix.length + 1);
  if (body.length !== TOTAL) return false;
  return [...body].every((c) => CROCKFORD.includes(c));
}
export {
  AgentPublicSchema,
  ApiErrorSchema,
  AppError,
  ArtifactFrontmatterSchema,
  BODY_MAX,
  ConfigLayerSchema,
  ConfigSchema,
  DEFAULT_STATUS,
  DIGEST_MAX,
  DIGEST_MIN,
  EnvelopeSchema,
  ExperienceSchema,
  FrontpageStatsSchema,
  HealthSchema,
  HostBindingSchema,
  IncludeQuerySchema,
  LAYER_MAX_TOKENS_CEILING,
  ListQuerySchema,
  OriginSchema,
  PublishRequestSchema,
  ReadySchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  SKILL_ID_PATTERN,
  SignalFullSchema,
  SignalKindSchema,
  SignalListSchema,
  SkillDependenciesSchema,
  SkillFrontmatterSchema,
  SkillLifecycleSchema,
  SkillParametersSchema,
  SkillProvenanceSchema,
  SkillVerifyTargetSchema,
  SubscriptionSchema,
  SyncStateSchema,
  TOKENS_EST_MAX,
  TopicSchema,
  TriggerRuleSchema,
  UiExtSchema,
  ValidateResponseSchema,
  ValidationLevelSchema,
  apiError,
  autoLoadModes,
  builtinLayerIds,
  errorCodes,
  includeValues,
  isPrefixed,
  parameterTypes,
  parseArtifactFrontmatter,
  prefixed,
  signalKinds,
  skillStatuses,
  skillSyncStates,
  triggerFields,
  triggerOperators,
  ulid,
  validationLevels
};
