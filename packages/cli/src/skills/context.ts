/**
 * 推通道内部实现（skill-engine 2.2 · 用户无感，不进 USAGE，不进命令面护栏）。
 *
 * 由 init 写入的宿主 hook 调用：输出 L1/L2 正文段 + L3 简表，预算内截断。
 * 任何异常都静默退出（hook 失败不得打断宿主工作流）。
 */
import { createEngine } from "./engine.ts";
import { recordMetrics } from "./metrics.ts";
import { tokensEst } from "./paths.ts";

export async function contextCmd(args: string[] = []): Promise<void> {
  let query = args.filter((a) => !a.startsWith("--")).join(" ");
  query = query || process.env.AGENTSIGNAL_HOOK_INPUT || "";
  try {
    const engine = await createEngine();
    const result = await engine.buildContext(
      { query, task: query },
      process.env.AGENTSIGNAL_PROJECT_ROOT,
    );
    if (result.context.trim()) process.stdout.write(`${result.context}\n`);

    // 双指标：简表代替全文 = 省下的；实际注入 = 残留
    const injected = result.layers.reduce((acc, l) => acc + l.tokens, 0);
    const brief = result.catalog.reduce((acc, c) => acc + c.tokens_est, 0);
    await recordMetrics({ saved: Math.max(0, brief - injected), residual: injected });
  } catch {
    // 静默：未初始化或配置损坏时不得干扰宿主
  }
}

/** 供 MCP 复用的同一套口径 */
export { tokensEst };
