/**
 * agentsignal mcp —— 唯一 MCP server（裁决 2/13；mcp-sdk-consolidation 决议）。
 *
 * 状态机（skill-engine design §4.8）：
 *   BOOTING → config 缺失 ? WAITING_CONFIG（拉向导，不退出；--yes/CI 直通）: INIT_ENGINE
 *           → READY ⇄ CALLING → SHUTTING_DOWN
 *   旁路：DEGRADED（索引损坏/版本不符 → 整库重建 → 回 READY）
 *
 * 调用管线：zod 校验 → 引擎单例处理 → 统一错误码结构化 JSON → Trace（只记录不审计）。
 * 工具面：5 平台 + 3 技能 + 1 管理 = 恰好九个。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CONFIG_MISSING, ConfigError } from "../skills/config.ts";
import { bootstrapWithDefaults, createEngine, type Engine } from "../skills/engine.ts";
import { resolvePaths } from "../skills/paths.ts";
import { createTrace, pruneSessions, registerShutdown, type Trace } from "../skills/session.ts";
import { startWizard } from "../skills/wizard/server.ts";
import { RestClient } from "./client.ts";
import { platformTools } from "./platformTools.ts";
import { manageTools, skillTools } from "./skillTools.ts";

export type ServerState =
  | "BOOTING"
  | "WAITING_CONFIG"
  | "INIT_ENGINE"
  | "READY"
  | "CALLING"
  | "DEGRADED"
  | "SHUTTING_DOWN";

export interface McpRuntime {
  state: ServerState;
  engine: Engine | null;
  trace: Trace;
}

const isCi = (): boolean =>
  process.env.CI === "true" || process.env.CI === "1" || !process.stdin.isTTY;

const log = (msg: string): void => {
  // stdio 传输下 stdout 归协议，日志一律走 stderr
  process.stderr.write(`[agentsignal mcp] ${msg}\n`);
};

/** 无配置 → WAITING_CONFIG：拉向导；CI/非 TTY 走 --yes 直通，不阻塞宿主 */
async function awaitConfig(runtime: McpRuntime): Promise<void> {
  runtime.state = "WAITING_CONFIG";
  if (isCi()) {
    const { configFile } = await bootstrapWithDefaults();
    log(`无配置：CI 环境已走缺省直通 → ${configFile}`);
    return;
  }
  const w = await startWizard({ open: true });
  log(`无配置：已打开初始化向导 ${w.url}`);
  const outcome = await w.wait;
  await w.close().catch(() => undefined);
  if (outcome.action === "closed") {
    log("向导未提交，继续以无配置状态运行（配置就绪前技能工具将返回结构化提示）");
  }
}

export async function createMcpServer(runtime: McpRuntime): Promise<McpServer> {
  const server = new McpServer({ name: "agentsignal", version: "0.4.0" });
  const client = new RestClient();

  const wrap =
    (name: string, run: (engine: Engine | null) => Promise<string>) =>
    async (
      _args: Record<string, unknown>,
    ): Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> => {
      const started = Date.now();
      runtime.state = "CALLING";
      try {
        const out = await run(runtime.engine);
        runtime.trace.record({
          ts: new Date().toISOString(),
          tool: name,
          ok: true,
          ms: Date.now() - started,
        });
        return { content: [{ type: "text" as const, text: out }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = message.startsWith("SKILL_NOT_FOUND")
          ? "SKILL_NOT_FOUND"
          : message.startsWith("CONFIG_MISSING")
            ? "CONFIG_MISSING"
            : "USAGE_INVALID";
        runtime.trace.record({
          ts: new Date().toISOString(),
          tool: name,
          ok: false,
          ms: Date.now() - started,
          code,
        });
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { error: { code, message, hint: "參见工具描述中的使用时机；修正参数后可重试。" } },
                null,
                2,
              ),
            },
          ],
        };
      } finally {
        runtime.state = "READY";
      }
    };

  const requireEngine = (engine: Engine | null): Engine => {
    if (!engine)
      throw new Error(
        "CONFIG_MISSING: 本机尚未初始化，请先运行 agentsignal init（或调用 open_setup 打开界面）",
      );
    return engine;
  };

  for (const tool of platformTools()) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      async (args: Record<string, unknown>) => wrap(tool.name, () => tool.run(args, client))(args),
    );
  }
  for (const tool of [...skillTools(), ...manageTools()]) {
    const needsEngine = tool.name !== "open_setup";
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      async (args: Record<string, unknown>) =>
        wrap(tool.name, (engine) =>
          needsEngine ? tool.run(args, requireEngine(engine)) : tool.run(args, engine),
        )(args),
    );
  }
  return server;
}

export async function mcpCmd(): Promise<void> {
  const runtime: McpRuntime = { state: "BOOTING", engine: null, trace: createTrace() };
  registerShutdown(runtime.trace);
  const paths = resolvePaths();

  try {
    runtime.state = "INIT_ENGINE";
    runtime.engine = await createEngine();
  } catch (err) {
    if (err instanceof ConfigError && err.code === CONFIG_MISSING) {
      await awaitConfig(runtime);
      try {
        runtime.state = "INIT_ENGINE";
        runtime.engine = await createEngine();
      } catch {
        log("配置仍未就绪，服务继续运行；配置完成后技能工具自动可用");
      }
    } else {
      throw err;
    }
  }

  if (runtime.engine?.indexRebuilt) {
    runtime.state = "DEGRADED";
    log("索引版本不符或已损坏，已整库重建并回到 READY");
  }
  runtime.state = "READY";

  const server = await createMcpServer(runtime);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`READY · 工具面 ${"9"}（5 平台 + 3 技能 + 1 管理）· 状态目录 ${paths.root}`);
  void pruneSessions(paths);
}

export { resolvePaths };
