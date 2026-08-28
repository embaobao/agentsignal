#!/usr/bin/env node
/**
 * AgentSignal MCP server（stdio）—— mcp-early-access 决议的最小落地。
 *
 * 五工具 1:1 镜像 REST，不新增协议语义；零依赖手写 stdio JSON-RPC
 * （newline-delimited，MCP stdio transport），只实现 tools 能力面。
 *
 * MCP config 片段（装一送一，见 packages/skills/participant）：
 * {
 *   "mcpServers": {
 *     "agentsignal": {
 *       "command": "node",
 *       "args": ["<repo>/packages/mcp/src/index.ts"],
 *       "env": { "AGENTSIGNAL_BASE_URL": "https://agentsignal.vip", "AGENTSIGNAL_TOKEN": "ags_..." }
 *     }
 *   }
 * }
 */
import { createInterface } from "node:readline";
import { RestClient } from "./client.ts";
import { buildTools } from "./tools.ts";

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

const tools = buildTools();
const client = new RestClient();

/** 挂起的异步回包数：stdin 关闭后须排空再退，避免截断 tools/call 响应 */
let pending = 0;

function dispatch(message: JsonRpcMessage): unknown | undefined {
  const { id, method } = message;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "agentsignal-mcp", version: "0.1.0" },
        },
      };
    case "notifications/initialized":
    case "notifications/cancelled":
      return undefined; // 通知不回包
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map(({ name, description, inputSchema }) => ({
            name,
            description,
            inputSchema,
          })),
        },
      };
    case "tools/call": {
      // 同步段：找不到工具立即回错；异步调用在事件循环里补齐
      const name = String(message.params?.name ?? "");
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `unknown tool: ${name}` },
        };
      }
      pending++;
      void tool
        .run(args, client)
        .then((output) => {
          reply({
            jsonrpc: "2.0",
            id,
            result: { content: [{ type: "text", text: output }], isError: false },
          });
        })
        .catch((err: unknown) => {
          reply({
            jsonrpc: "2.0",
            id,
            result: {
              content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
              isError: true,
            },
          });
        })
        .finally(() => {
          pending--;
        });
      return undefined; // 异步稍后回包
    }
    default:
      if (isNotification) return undefined;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `method not found: ${method}` },
      };
  }
}

function reply(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message: JsonRpcMessage;
  try {
    message = JSON.parse(trimmed) as JsonRpcMessage;
  } catch {
    reply({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
    return;
  }
  const out = dispatch(message);
  if (out !== undefined) reply(out);
});
rl.on("close", () => {
  // 排空挂起的异步回包（上限 5s），再干净退出
  const started = Date.now();
  const drain = () => {
    if (pending <= 0 || Date.now() - started > 5_000) process.exit(0);
    setTimeout(drain, 25);
  };
  drain();
});
