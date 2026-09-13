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
  const event = parseEventArg(args);
  // 事件映射（host-matrix-alignment 1.6）：推通道只服务开工语义——Stop 静默早退
  if (mapHookEvent(event) === "noop") return;
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

/* ------------------------------- 事件映射（host-matrix 1.6） ------------------------------- */

/** hook event → 推通道动作：push（全量推）/ noop（静默早退） */
export type HookEventAction = "push" | "noop";

/** 提取 --event <name> / --event=<name>（其余参数留给 query） */
export function parseEventArg(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--event") return args[i + 1];
    if (a.startsWith("--event=")) return a.slice("--event=".length);
  }
  return undefined;
}

/** 事件语义映射：AgentSignal 推通道只服务开工（SessionStart/未知一律 push）；
 *  Stop（收尾）无对应语义 → noop 静默早退，不硬造收尾功能 */
export function mapHookEvent(event: string | undefined): HookEventAction {
  return event === "Stop" ? "noop" : "push";
}
