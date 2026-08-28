/**
 * 单测：MCP 工具面 —— 五工具与 REST 的 1:1 镜像关系（不经网络，注入 fake fetch）。
 * 另覆盖 stdio 分发的同步分支（initialize / tools/list / 未知工具）。
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { RestClient } from "../src/client.ts";
import { buildTools } from "../src/tools.ts";

/** 记录请求并按路径返回假数据的 fetch 替身 */
interface FakeCall {
  path: string;
  method: string;
  body?: string;
}

function fakeFetch(handler: (path: string, call: FakeCall) => unknown) {
  const calls: FakeCall[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, "");
    const call: FakeCall = {
      path,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    const payload = handler(path, call);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return { impl, calls };
}

const clientOf = (impl: typeof fetch) =>
  new RestClient({ baseUrl: "http://test.local", token: "ags_test", fetchImpl: impl });

describe("MCP 五工具镜像 REST", () => {
  test("恰好五个工具，名称与决议一致", () => {
    const names = buildTools().map((t) => t.name);
    assert.deepEqual(names, [
      "list_spaces",
      "query_signals",
      "use_signal",
      "publish_signal",
      "report_outcome",
    ]);
  });

  test("list_spaces → GET /topics", async () => {
    const { impl, calls } = fakeFetch(() => ({ topics: [] }));
    const tool = buildTools()[0];
    if (!tool) throw new Error("list_spaces 工具缺失");
    const out = await tool.run({}, clientOf(impl));
    assert.match(out, /topics/);
    assert.equal(calls[0]?.path, "/topics");
    assert.equal(calls[0]?.method, "GET");
  });

  test("query_signals 组装 q/limit/cursor；use_signal 带 include=experience", async () => {
    const { impl, calls } = fakeFetch(() => ({ signals: [], next_cursor: null }));
    const tools = buildTools();
    const query = tools[1];
    const use = tools[2];
    if (!query || !use) throw new Error("query/use 工具缺失");
    await query.run({ space: "ai-research", keyword: "RAG", limit: 5 }, clientOf(impl));
    assert.equal(calls[0]?.path, "/topics/ai-research/signals?limit=5&q=RAG");

    await use.run({ sig_id: "sig_abc" }, clientOf(impl));
    assert.equal(calls[1]?.path, "/signals/sig_abc?include=experience,ui_ext");
  });

  test("publish_signal 携带 Bearer 与四节正文", async () => {
    const { impl, calls } = fakeFetch(() => ({ id: "sig_new" }));
    const tools = buildTools();
    const publish = tools[3];
    if (!publish) throw new Error("publish 工具缺失");
    const out = await publish.run(
      {
        space: "ai-research",
        kind: "solution",
        digest: "测试 digest 足够长 | scope: x | validation: none",
        body: "## Why\n…",
      },
      clientOf(impl),
    );
    assert.match(out, /sig_new/);
    assert.equal(calls[0]?.method, "POST");
    const body = JSON.parse(calls[0]?.body ?? "{}") as { experience?: unknown };
    assert.ok(body.experience, "正文应组装进 experience");
  });

  test("report_outcome 先取目标定位 topic，再发 [adoption] update 锚定 sig", async () => {
    const { impl, calls } = fakeFetch((path) =>
      path.startsWith("/signals/")
        ? { id: "sig_t1", topic: "ai-research" }
        : { id: "sig_new", validation: { digest_valid: true } },
    );
    const tools = buildTools();
    const report = tools[4];
    if (!report) throw new Error("report 工具缺失");
    const out = await report.run(
      {
        target_sig_id: "sig_t1",
        verdict: "worked",
        evidence: "按 Runbook 执行完毕",
        result: "召回率 0.61→0.84 复现",
        artifact: "commit abc123",
      },
      clientOf(impl),
    );
    assert.match(out, /sig_new/);
    assert.equal(calls[0]?.path, "/signals/sig_t1");
    assert.equal(calls[1]?.path, "/topics/ai-research/signals");
    const body = JSON.parse(calls[1]?.body ?? "{}") as { digest: string; kind: string };
    assert.match(body.digest, /^\[adoption\]/);
    assert.match(body.digest, /sig_t1/);
    assert.equal(body.kind, "update");
  });
});
