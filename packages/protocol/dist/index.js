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
  digest_valid: z2.boolean()
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
  BODY_MAX,
  DEFAULT_STATUS,
  DIGEST_MAX,
  DIGEST_MIN,
  EnvelopeSchema,
  ExperienceSchema,
  FrontpageStatsSchema,
  HealthSchema,
  IncludeQuerySchema,
  ListQuerySchema,
  OriginSchema,
  PublishRequestSchema,
  ReadySchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  SignalFullSchema,
  SignalKindSchema,
  SignalListSchema,
  TOKENS_EST_MAX,
  TopicSchema,
  UiExtSchema,
  ValidateResponseSchema,
  ValidationLevelSchema,
  apiError,
  errorCodes,
  includeValues,
  isPrefixed,
  prefixed,
  signalKinds,
  ulid,
  validationLevels
};
