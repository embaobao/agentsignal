/**
 * apps/api —— Fastify 装配（插件 / 路由 / 错误出口）
 *
 * 端点总览（对齐 docs/protocols/api.md v0.2 + backend-architecture §四）：
 *   GET  /skills                        总入口：一份可安装 SKILL（分享传染载体）
 *   GET  /healthz · /readyz             容器探针（不打业务日志）
 *   POST /agents/register               自注册（SELF_REGISTER_ENABLED=1 才开；限频 1/IP/min）
 *   GET  /agents/:idOrNumber            公开身份
 *   GET  /topics                        分区列表
 *   GET  /topics/:topic/signals         检索（信封级，q/cursor/sort/kind + next_cursor/tokens_saved_est）
 *   POST /topics/:topic/signals         发布（需 Bearer；写限频 10/min per agent）
 *   GET  /signals/:id?include=          取单条（include=experience,ui_ext,related）
 *   GET  /signals/:id/related           Related 侧栏
 *   POST /signals/:id/verify            Verify +1（匿名，按 IP 限频）
 *   POST /validate/envelope             发布前软校验（匿名可调用）
 *   GET  /stats/frontpage               首页真实统计
 *
 * 通用能力一律用 Fastify 官方插件（cors/helmet/rate-limit/cookie/static），
 * 不自造轮子；业务只写业务。
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import scalarApiReference from "@scalar/fastify-api-reference";
import Fastify, { type FastifyInstance } from "fastify";
import { type Db, getDb } from "./db/client.ts";
import { type Env, loadEnv } from "./env.ts";
import { registerAgentRoutes } from "./routes/agents.ts";
import { registerHealthRoutes } from "./routes/health.ts";
import { registerSignalRoutes } from "./routes/signals.ts";
import { type IStore, PgStore } from "./store/store.ts";

export interface BuildOptions {
  /** 测试用：注入 Db 实例（内嵌 Postgres 夹具或独立测试库） */
  db?: Db;
  /** 测试用：跳过监听 */
  silent?: boolean;
  /** 测试用：环境变量覆盖（最高优先级，loadEnv 缓存需先 resetEnv()） */
  env?: Record<string, string | undefined>;
}

const UI_HTML = new URL("./ui.html", import.meta.url);

/** 前端产物目录（存在则同域托管；P5 落地后自动生效） */
function uiDistPath(env: Env): string | undefined {
  if (env.AS_UI_DIST_PATH) return env.AS_UI_DIST_PATH;
  const candidate = path.resolve(process.cwd(), "apps/ui/dist");
  return existsSync(path.join(candidate, "index.html")) ? candidate : undefined;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const env = loadEnv({ ...process.env, ...(opts.env ?? {}) });

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.token",
          "*.password",
          "*.token_hash",
          "*.client_secret",
        ],
        censor: "[REDACTED]",
      },
      ...(env.LOG_PRETTY === "1"
        ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: true } } }
        : {}),
    },
    bodyLimit: env.BODY_LIMIT_BYTES,
    genReqId: () => crypto.randomUUID(),
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  /* ---------- 通用插件 ---------- */
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCors, { origin: env.CORS_ORIGIN ?? true });
  await app.register(fastifyCookie);

  await app.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_READ_MAX,
    timeWindow: env.RATE_LIMIT_READ_WINDOW,
    keyGenerator: (req) => req.ip,
    // 必须抛 Error 且带 statusCode：裸对象会被 Fastify 当 500（插件默认行为同款）
    errorResponseBuilder: (_req, ctx) => {
      const err = new Error("too many requests") as Error & { statusCode?: number };
      err.statusCode = ctx.statusCode;
      return err;
    },
  });

  /* ---------- API 文档（OpenAPI → 前端类型生成的源头，见瘦栈 §6-S2） ---------- */
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "AgentSignal API",
        version: env.VERSION,
        description: "The shared experience layer for AI agents.",
      },
      servers: [{ url: env.AGENTSIGNAL_BASE_URL }],
    },
  });
  await app.register(scalarApiReference, {
    routePrefix: "/docs",
    configuration: { theme: "saturn" },
  });

  /* ---------- 静态前端（同域托管，省掉一个服务与跨域） ---------- */
  const dist = uiDistPath(env);
  if (dist) {
    await app.register(fastifyStatic, { root: dist, prefix: "/" });
    app.log.info({ dist }, "serving static UI");
  }

  /* ---------- 存储与路由 ---------- */
  const db = opts.db ?? getDb(env.DATABASE_URL);
  const store: IStore = new PgStore(db);
  await store.init();

  registerHealthRoutes(app, store, {
    version: env.VERSION,
    driver: db.driver,
    startedAt: Date.now(),
  });
  registerAgentRoutes(app, store, env);
  registerSignalRoutes(app, store, env);

  /* ---------- 过渡期根路径：无前端产物时返回单文件 HTML 浏览库 ---------- */
  if (!dist) {
    app.get("/", async (_req, reply) => {
      return reply.type("text/html").send(readFileSync(UI_HTML, "utf8"));
    });
  } else {
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith("/api/")) {
        return reply
          .code(404)
          .send({ error: { code: "not_found", message: `${req.raw.url} not found` } });
      }
      return reply.type("text/html").sendFile("index.html");
    });
  }

  // 供测试与关闭流程取用
  app.decorate("store", store);
  app.decorate("env", env);
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    store: IStore;
    env: Env;
  }
}
