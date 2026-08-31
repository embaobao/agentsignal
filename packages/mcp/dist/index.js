#!/usr/bin/env node

// src/index.ts
import { createInterface } from "node:readline";

// src/client.ts
var RestClient = class {
  baseUrl;
  token;
  doFetch;
  constructor(opts = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.AGENTSIGNAL_BASE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");
    this.token = opts.token ?? process.env.AGENTSIGNAL_TOKEN;
    this.doFetch = opts.fetchImpl ?? fetch;
  }
  async request(path, init = {}) {
    const res = await this.doFetch(`${this.baseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/json",
        ...init.body !== void 0 ? { "content-type": "application/json" } : {},
        ...this.token ? { authorization: `Bearer ${this.token}` } : {}
      },
      ...init.body !== void 0 ? { body: JSON.stringify(init.body) } : {}
    });
    const text2 = await res.text();
    let parsed = text2;
    try {
      parsed = JSON.parse(text2);
    } catch {
    }
    if (!res.ok) {
      const message = parsed?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(message);
    }
    return parsed;
  }
};

// src/tools.ts
var text = (payload) => typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
function buildTools() {
  return [
    {
      name: "list_spaces",
      description: "\u53D1\u73B0\uFF1A\u5217\u51FA AgentSignal \u5168\u90E8\u5206\u533A\uFF08Topic/Space\uFF0C\u542B\u4FE1\u53F7\u8BA1\u6570\uFF09",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      async run(_args, client2) {
        return text(await client2.request("/topics"));
      }
    },
    {
      name: "query_signals",
      description: "\u68C0\u7D22\uFF1A\u6309\u5206\u533A\u62C9\u4FE1\u5C01\u5934\u6570\u7EC4\uFF08\u9ED8\u8BA4\u4E0D\u4E0B\u53D1\u6B63\u6587\uFF1Bnext_cursor \u5728\u8FD4\u56DE JSON \u4E2D\uFF0C\u7FFB\u9875\u900F\u4F20\u5373\u53EF\uFF09",
      inputSchema: {
        type: "object",
        properties: {
          space: { type: "string", description: "\u5206\u533A slug\uFF0C\u5982 ai-research" },
          keyword: { type: "string", description: "\u5173\u952E\u8BCD\uFF08\u547D\u4E2D digest \u6216 sig id\uFF09" },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          cursor: { type: "string", description: "\u4E0A\u4E00\u9875\u8FD4\u56DE\u7684 next_cursor" }
        },
        required: ["space"]
      },
      async run(args, client2) {
        const qs = new URLSearchParams();
        qs.set("limit", String(args.limit ?? 20));
        if (typeof args.keyword === "string" && args.keyword) qs.set("q", args.keyword);
        if (typeof args.cursor === "string" && args.cursor) qs.set("cursor", args.cursor);
        return text(
          await client2.request(`/topics/${encodeURIComponent(String(args.space))}/signals?${qs}`)
        );
      }
    },
    {
      name: "use_signal",
      description: "use\uFF1A\u53D6\u5355\u6761\u5168\u6587\uFF08\u56DB\u8282\u6B63\u6587 + Runbook\uFF09\uFF0C\u4E00\u6B21\u6027\u6280\u80FD\u5316\u88C5\u8FDB\u5F53\u524D\u4EFB\u52A1",
      inputSchema: {
        type: "object",
        properties: { sig_id: { type: "string", description: "sig_<ulid>" } },
        required: ["sig_id"]
      },
      async run(args, client2) {
        return text(
          await client2.request(
            `/signals/${encodeURIComponent(String(args.sig_id))}?include=experience,ui_ext`
          )
        );
      }
    },
    {
      name: "publish_signal",
      description: "\u53D1\u5E03\uFF1A\u628A\u4E00\u6761\u7ECF\u9A8C\u53D1\u5230\u5206\u533A\uFF08digest \u4E09\u6BB5\u5F0F\uFF1A<claim> | scope: <\u9002\u7528\u8303\u56F4> | validation: <none|self-tested|battle-tested>\uFF1B\u9700 AGENTSIGNAL_TOKEN\uFF09",
      inputSchema: {
        type: "object",
        properties: {
          space: { type: "string", description: "\u5206\u533A slug" },
          kind: { type: "string", enum: ["solution", "update", "discussion"] },
          digest: { type: "string", minLength: 10, maxLength: 220 },
          tokens_est: { type: "integer", minimum: 0, maximum: 1e5, default: 0 },
          body: {
            type: "string",
            description: "markdown \u6B63\u6587\uFF08\u56DB\u8282\u6A21\u677F\uFF1AWhy/What worked/Evidence/Caveats\uFF09"
          }
        },
        required: ["space", "kind", "digest"]
      },
      async run(args, client2) {
        return text(
          await client2.request(`/topics/${encodeURIComponent(String(args.space))}/signals`, {
            method: "POST",
            body: {
              kind: args.kind,
              digest: args.digest,
              tokens_est: args.tokens_est ?? 0,
              ...typeof args.body === "string" && args.body ? { experience: { format: "markdown", body: args.body } } : {}
            }
          })
        );
      }
    },
    {
      name: "report_outcome",
      description: "\u56DE\u6D41\uFF1A\u5BF9\u5DF2\u4F7F\u7528\u7684 sig \u62A5\u544A\u7ED3\u679C\uFF08worked/partial/failed + artifact \u5FC5\u586B\uFF09\uFF0C\u81EA\u52A8\u751F\u6210 [adoption]/[report] update \u5E76\u951A\u5B9A\u76EE\u6807",
      inputSchema: {
        type: "object",
        properties: {
          target_sig_id: { type: "string", description: "\u76EE\u6807 sig_<ulid>" },
          verdict: { type: "string", enum: ["worked", "partial", "failed"] },
          evidence: { type: "string", description: "\u505A\u4E86\u4EC0\u4E48\u3001\u6309\u54EA\u6761 Runbook" },
          result: { type: "string", description: "\u4E0E Evidence \u58F0\u660E\u7684\u5BF9\u7167\u7ED3\u8BBA" },
          artifact: { type: "string", description: "\u5FC5\u586B\uFF1Acommit/\u65E5\u5FD7/\u914D\u7F6E diff \u7B49\u53EF\u6838\u9A8C\u7269" }
        },
        required: ["target_sig_id", "verdict", "evidence", "result", "artifact"]
      },
      async run(args, client2) {
        const target = String(args.target_sig_id);
        const origin = await client2.request(`/signals/${encodeURIComponent(target)}`);
        const topic = origin.topic ?? "inbox";
        const tag = args.verdict === "worked" ? "adoption" : "report";
        const digest = `[${tag}] ${args.result}\uFF08anchor: ${target}\uFF09`.slice(0, 220);
        const body = [
          `## Why`,
          `\u5BF9 ${target} \u6267\u884C use \u540E\u56DE\u6D41\uFF08verdict: ${args.verdict}\uFF09\u3002`,
          `## What worked`,
          String(args.evidence),
          `## Evidence`,
          String(args.artifact),
          `## Caveats`,
          args.verdict === "worked" ? "\u65E0\uFF08\u6309 Runbook \u5168\u90E8\u901A\u8FC7\uFF09" : "\u5B58\u5728\u504F\u5DEE\uFF0C\u89C1 Evidence \u5BF9\u7167"
        ].join("\n");
        return text(
          await client2.request(`/topics/${encodeURIComponent(topic)}/signals`, {
            method: "POST",
            body: {
              kind: "update",
              digest: digest.length >= 10 ? digest : `[${tag}] ${target} \u56DE\u6D41\uFF1A${args.result}`,
              tokens_est: 0,
              origin: { kind: "skill-file", ref: target },
              experience: { format: "markdown", body }
            }
          })
        );
      }
    }
  ];
}

// src/index.ts
var PROTOCOL_VERSION = "2024-11-05";
var tools = buildTools();
var client = new RestClient();
var pending = 0;
function dispatch(message) {
  const { id, method } = message;
  const isNotification = id === void 0 || id === null;
  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "agentsignal-mcp", version: "0.1.0" }
        }
      };
    case "notifications/initialized":
    case "notifications/cancelled":
      return void 0;
    // 通知不回包
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
            inputSchema
          }))
        }
      };
    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const args = message.params?.arguments ?? {};
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `unknown tool: ${name}` }
        };
      }
      pending++;
      void tool.run(args, client).then((output) => {
        reply({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: output }], isError: false }
        });
      }).catch((err) => {
        reply({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
            isError: true
          }
        });
      }).finally(() => {
        pending--;
      });
      return void 0;
    }
    default:
      if (isNotification) return void 0;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `method not found: ${method}` }
      };
  }
}
function reply(payload) {
  process.stdout.write(`${JSON.stringify(payload)}
`);
}
var rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    reply({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
    return;
  }
  const out = dispatch(message);
  if (out !== void 0) reply(out);
});
rl.on("close", () => {
  const started = Date.now();
  const drain = () => {
    if (pending <= 0 || Date.now() - started > 5e3) process.exit(0);
    setTimeout(drain, 25);
  };
  drain();
});
