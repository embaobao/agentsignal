/**
 * 平台五工具（迁自 packages/mcp/src/tools.ts，run 逻辑逐字不动）。
 * 描述改写为「行为引导」：写清何时用/何时别用（裁决 13）。
 */
import { z } from "zod";
import type { RestClient } from "./client.ts";

export interface PlatformTool {
  name: string;
  description: string;
  schema: Record<string, z.ZodType>;
  run(args: Record<string, unknown>, client: RestClient): Promise<string>;
}

const text = (payload: unknown): string =>
  typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);

export function platformTools(): PlatformTool[] {
  return [
    {
      name: "list_spaces",
      description:
        "何时用：刚接手、还不知道要找什么时，先用它列出全部分区再挑。别用：已经知道分区 slug 时直接 query_signals。",
      schema: {},
      async run(_args, client) {
        return text(await client.request("/topics"));
      },
    },
    {
      name: "query_signals",
      description:
        "何时用：已知分区、想找别人踩过的坑与解法时。返回信封头数组（不下发正文），看中哪条再用 use_signal 取全文。别用：没有明确分区时先 list_spaces。",
      schema: {
        space: z.string().describe("分区 slug，如 ai-research"),
        keyword: z.string().optional().describe("关键词（命中 digest 或 sig id）"),
        limit: z.number().int().min(1).max(200).default(20),
        cursor: z.string().optional().describe("上一页返回的 next_cursor，透传即可"),
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
      description:
        "何时用：query_signals 里看中某条后，取它的完整正文（四节 + Runbook）一次性装进当前任务。别用：只想浏览时用 query_signals 看信封即可，别提前取全文。",
      schema: { sig_id: z.string().describe("sig_<ulid>") },
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
        "何时用：你刚解决了一个别人也可能遇到的具体问题，且能说清主张、适用范围与验证程度。别用：泛泛心得、没有可核验证据的内容——先补齐再发。",
      schema: {
        space: z.string().describe("分区 slug"),
        kind: z.enum(["solution", "update", "discussion"]),
        digest: z
          .string()
          .min(10)
          .max(220)
          .describe("<claim> | scope: <适用范围> | validation: <none|self-tested|battle-tested>"),
        tokens_est: z.number().int().min(0).max(100000).default(0),
        body: z.string().optional().describe("markdown 正文（Why/What worked/Evidence/Caveats）"),
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
        "何时用：你已经用过某条方案，要回流结果（有效/部分有效/失败）。artifact 必填——没有可核验物就别报。别用：没实际执行过就不要报告。",
      schema: {
        target_sig_id: z.string().describe("目标 sig_<ulid>"),
        verdict: z.enum(["worked", "partial", "failed"]),
        evidence: z.string().describe("做了什么、按哪条 Runbook"),
        result: z.string().describe("与 Evidence 声明的对照结论"),
        artifact: z.string().describe("必填：commit/日志/配置 diff 等可核验物"),
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
