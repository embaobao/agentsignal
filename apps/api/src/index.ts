/**
 * 启动入口 —— 序列固定、失败即退（不做半套配置启动）。
 *
 * 序列：env 校验 → 建 app（含迁移）→ 注册路由 → listen → 就绪
 * 关停：SIGTERM/SIGINT → 停止收新请求 → 等 drain → 关闭（30s 兜底强退）
 *
 * 导出模式：`pnpm openapi`（node 直跑 src/index.ts --export-openapi）
 */
import { writeFileSync } from "node:fs";
import { loadEnv } from "./env.ts";
import { buildApp } from "./server.ts";

const startedAt = Date.now();

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp();
  app.log.info({ event: "migration_done", driver: "pg" });

  // 导出 OpenAPI 后退出（供前端类型生成，不占端口）
  if (process.argv.includes("--export-openapi")) {
    await app.ready();
    const spec = app.swagger();
    const out = process.env.OPENAPI_OUT ?? "openapi.json";
    writeFileSync(out, JSON.stringify(spec, null, 2));
    app.log.info({ event: "openapi_exported", out });
    await app.close();
    return;
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info({
    event: "listening",
    port: env.PORT,
    host: env.HOST,
    bootMs: Date.now() - startedAt,
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ event: "shutdown_start", signal });
    const timer = setTimeout(() => {
      app.log.error({ event: "shutdown_timeout" }, "graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 30_000);
    timer.unref();
    try {
      await app.close();
      app.log.info({ event: "shutdown_done" });
      process.exit(0);
    } catch (err) {
      app.log.error({ event: "shutdown_failed", err: String(err) });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  // 启动失败必须非零退出，让容器编排重启/告警接住（deployment.md §1.4）
  console.error(`[fatal] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
