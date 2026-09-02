/**
 * 环境变量校验 —— 启动时 fail-fast，不允许带半套配置运行。
 *
 * 纪律：新增变量先改这里 + .env.example + docs/design/deployment.md §3。
 */
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default("0.0.0.0"),
  // pino 支持 silent（测试与导出模式下静音）
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]).default("info"),
  LOG_PRETTY: z.enum(["0", "1"]).default("0"),

  // 存储（决议 2026-08-28-standardize-node-postgres：标准 Postgres，URL 必填）
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => v.startsWith("postgres://") || v.startsWith("postgresql://"), {
      message: "DATABASE_URL 必须是 postgres:// 连接串",
    }),

  // 站点
  AGENTSIGNAL_BASE_URL: z.string().url().default("http://localhost:3000"),
  OAUTH_REDIRECT_URI: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  // GitHub OAuth（better-auth；留空则 /auth/* fail-soft，不影响其他端点）
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  BETTER_AUTH_SECRET: z.string().optional(),

  // Token Firewall · Server Filter
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WRITE_WINDOW: z.string().default("1m"),
  RATE_LIMIT_READ_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_READ_WINDOW: z.string().default("1m"),
  // 自注册门禁（身份 spec §1.3：默认关，M0–M3 管理员签发；开时限频 1/IP/min）
  SELF_REGISTER_ENABLED: z.enum(["0", "1"]).default("0"),
  RATE_LIMIT_REGISTER_MAX: z.coerce.number().int().positive().default(1),
  RATE_LIMIT_REGISTER_WINDOW: z.string().default("1m"),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(65536),

  // 管理后台（audit-restore 1B-1：Basic 单管理员；未配置则 /admin/* 整体 404 fail-soft）
  AS_ADMIN_USER: z.string().optional(),
  AS_ADMIN_PASS_BCRYPT: z.preprocess(
    (v) => (v === "" || v == null || v === "undefined" ? undefined : v),
    z
      .string()
      .regex(/^\$2[aby]\$/, "须为 bcrypt 哈希")
      .optional(),
  ),
  AS_ADMIN_SINGLE: z.enum(["y", "n"]).default("n"),

  // 生命周期
  TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(90),
  SIGNAL_DEFAULT_TTL_DAYS: z.coerce.number().int().nonnegative().default(7),

  // 静态资源（C7：解开 import.meta.url 对打包/挂载的耦合）
  AS_SKILL_PATH: z.string().optional(),
  AS_UI_DIST_PATH: z.string().optional(),

  VERSION: z.string().default("0.1.0"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** 解析并缓存；校验失败直接抛错（由启动流程转成非零退出） */
export function loadEnv(overrides: Record<string, string | undefined> = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(overrides);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`环境变量校验失败：\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** 测试用：清缓存 */
export function resetEnv(): void {
  cached = null;
}
