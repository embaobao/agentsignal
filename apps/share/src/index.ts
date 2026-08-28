/**
 * 启动器 —— Bun / Node 双跑入口
 *
 *   bun apps/share/src/index.ts        # 或：node --experimental-strip-types apps/share/src/index.ts
 *   PORT=8787（默认）· HOST=0.0.0.0 · DATA_DIR=data/messages · LOG=1 开启 pino 日志
 *   AGENTSIGNAL_NO_LISTEN=1 仅供测试导入（不起监听）
 */
import { buildApp } from "./server.ts";

if (process.env.AGENTSIGNAL_NO_LISTEN !== "1") {
  const app = buildApp();
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen({ port, host });
  console.log(`agentsignal share listening on :${port}`);
}
