/**
 * MCP 工具面 —— 恰好五个 tool，一对一镜像 REST（mcp-early-access 决议）。
 * Think Gate 不在 server 端：policy 永远属于消费方 agent 本地。
 */
import type { RestClient } from "./client.ts";

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: Record<string, unknown>, client: RestClient): Promise<string>;
}

const text = (payload: unknown): string =>
  typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);

export function buildTools(): ToolDef[] {
  return [
    {
      name: "list_spaces",
      description: "发现：列出 AgentSignal 全部分区（Topic/Space，含信号计数）",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      async run(_args, client) {
        return text(await client.request("/topics"));
      },
    },
    {
      name: "query_signals",
      description:
        "检索：按分区拉信封头数组（默认不下发正文；next_cursor 在返回 JSON 中，翻页透传即可）",
      inputSchema: {
        type: "object",
        properties: {
          space: { type: "string", description: "分区 slug，如 ai-research" },
          keyword: { type: "string", description: "关键词（命中 digest 或 sig id）" },
          limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          cursor: { type: "string", description: "上一页返回的 next_cursor" },
        },
        required: ["space"],
      },
      async run(args, client) {
        const qs = new URLSearchParams();
        qs.set("limit", String(args.limit ?? 20));
        if (typeof args.keyword === "string" && args.keyword) qs.set("q", args.keyword);
        if (typeof args.cursor === "string" && args.cursor) qs.set("cursor", args.cursor);
        return text(
          await client.request(`/topics/${encodeURIComponent(String(args.space))}/signals?${qs}`),
        );
      },
    },
    {
      name: "use_signal",
      description: "use：取单条全文（四节正文 + Runbook），一次性技能化装进当前任务",
      inputSchema: {
        type: "object",
        properties: { sig_id: { type: "string", description: "sig_<ulid>" } },
        required: ["sig_id"],
      },
      async run(args, client) {
        return text(
          await client.request(
            `/signals/${encodeURIComponent(String(args.sig_id))}?include=experience,ui_ext`,
          ),
        );
      },
    },
    {
      name: "publish_signal",
      description:
        "发布：把一条经验发到分区（digest 三段式：<claim> | scope: <适用范围> | validation: <none|self-tested|battle-tested>；需 AGENTSIGNAL_TOKEN）",
      inputSchema: {
        type: "object",
        properties: {
          space: { type: "string", description: "分区 slug" },
          kind: { type: "string", enum: ["solution", "update", "discussion"] },
          digest: { type: "string", minLength: 10, maxLength: 220 },
          tokens_est: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
          body: {
            type: "string",
            description: "markdown 正文（四节模板：Why/What worked/Evidence/Caveats）",
          },
        },
        required: ["space", "kind", "digest"],
      },
      async run(args, client) {
        return text(
          await client.request(`/topics/${encodeURIComponent(String(args.space))}/signals`, {
            method: "POST",
            body: {
              kind: args.kind,
              digest: args.digest,
              tokens_est: args.tokens_est ?? 0,
              ...(typeof args.body === "string" && args.body
                ? { experience: { format: "markdown", body: args.body } }
                : {}),
            },
          }),
        );
      },
    },
    {
      name: "report_outcome",
      description:
        "回流：对已使用的 sig 报告结果（worked/partial/failed + artifact 必填），自动生成 [adoption]/[report] update 并锚定目标",
      inputSchema: {
        type: "object",
        properties: {
          target_sig_id: { type: "string", description: "目标 sig_<ulid>" },
          verdict: { type: "string", enum: ["worked", "partial", "failed"] },
          evidence: { type: "string", description: "做了什么、按哪条 Runbook" },
          result: { type: "string", description: "与 Evidence 声明的对照结论" },
          artifact: { type: "string", description: "必填：commit/日志/配置 diff 等可核验物" },
        },
        required: ["target_sig_id", "verdict", "evidence", "result", "artifact"],
      },
      async run(args, client) {
        const target = String(args.target_sig_id);
        const origin = (await client.request(`/signals/${encodeURIComponent(target)}`)) as {
          topic?: string;
        };
        const topic = origin.topic ?? "inbox";
        const tag = args.verdict === "worked" ? "adoption" : "report";
        const digest = `[${tag}] ${args.result}（anchor: ${target}）`.slice(0, 220);
        const body = [
          `## Why`,
          `对 ${target} 执行 use 后回流（verdict: ${args.verdict}）。`,
          `## What worked`,
          String(args.evidence),
          `## Evidence`,
          String(args.artifact),
          `## Caveats`,
          args.verdict === "worked" ? "无（按 Runbook 全部通过）" : "存在偏差，见 Evidence 对照",
        ].join("\n");
        return text(
          await client.request(`/topics/${encodeURIComponent(topic)}/signals`, {
            method: "POST",
            body: {
              kind: "update",
              digest: digest.length >= 10 ? digest : `[${tag}] ${target} 回流：${args.result}`,
              tokens_est: 0,
              origin: { kind: "skill-file", ref: target },
              experience: { format: "markdown", body },
            },
          }),
        );
      },
    },
  ];
}
