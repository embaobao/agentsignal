/**
 * 健康检查 —— liveness 与 readiness 分离（容器探针依赖，见 deployment.md §4）
 *
 * 纪律：两端点都不打业务日志，避免高频探针刷爆日志。
 */
import type { FastifyInstance } from "fastify";
import type { IStore } from "../store/store.ts";

export function registerHealthRoutes(
  app: FastifyInstance,
  store: IStore,
  meta: { version: string; driver: "pg"; startedAt: number },
): void {
  const noLog = { logLevel: "silent" as const };

  /** liveness：进程活着即可，不查依赖 */
  app.get("/healthz", { ...noLog }, async () => ({
    status: "ok",
    uptimeSec: Math.round((Date.now() - meta.startedAt) / 1000),
    version: meta.version,
  }));

  /** readiness：可对外服务才算 ready（真查一次库） */
  app.get("/readyz", { ...noLog }, async (_req, reply) => {
    const up = await store.ready();
    const migration = up ? await store.migrationVersion() : "unknown";
    return reply.code(up ? 200 : 503).send({
      status: up ? "ready" : "degraded",
      store: up ? "up" : "down",
      migration,
      driver: meta.driver,
    });
  });
}
