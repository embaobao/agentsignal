// E2E：golden sample 发布 → 拉取同构往返 + 结构拒绝 + zod 错误细节。
// 经 fastify inject() 直调 handler（无真实端口），bun test 与
// node --experimental-strip-types --test 双跑兼容。

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { FastifyInstance } from "fastify";
import type { Response as InjectResponse } from "light-my-request";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "agentsignal-test-"));
process.env.AGENTSIGNAL_NO_LISTEN = "1"; // 只导 handler 工厂，不起监听

const { buildApp } = await import("../../apps/share/src/server.ts");
let app: FastifyInstance;

before(async () => {
  app = buildApp();
});
after(async () => {
  await app.close();
});

// 走真实 JSON 解析路径（字符串 + content-type），而非对象直传
const post = (body: unknown): Promise<InjectResponse> =>
  app.inject({
    method: "POST",
    url: "/",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(body),
  });
const get = (url: string): Promise<InjectResponse> => app.inject({ method: "GET", url });

const GOLDEN = JSON.parse(
  readFileSync(
    new URL(
      "../../openspec/changes/a2a-share-mvp/examples/experience-message.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("agent card is discoverable", async () => {
  const res = await get("/.well-known/agent-card.json");
  assert.equal(res.statusCode, 200);
  const card = res.json();
  assert.equal(card.name, "AgentSignal Share");
  assert.ok(card.skills.some((s: { id: string }) => s.id === "experience-share"));
});

test("golden sample publishes and round-trips unchanged", async () => {
  const res = await post({
    jsonrpc: "2.0",
    id: 1,
    method: "message/send",
    params: { message: GOLDEN },
  });
  assert.equal(res.statusCode, 200);
  const out = res.json();
  assert.equal(out.result.messageId, GOLDEN.messageId);

  const fetched = await get(`/messages/${GOLDEN.messageId}`);
  assert.equal(fetched.statusCode, 200);
  assert.deepEqual(fetched.json(), GOLDEN); // 同构往返：发什么结构取回什么结构
});

test("list newest-first with identical structure", async () => {
  const second = { ...GOLDEN, messageId: "msg-experience-0002" };
  await post({ jsonrpc: "2.0", id: 2, method: "message/send", params: { message: second } });
  const list = (await get("/messages?limit=10")).json();
  assert.equal(list.count, 2);
  assert.equal(list.messages[0].messageId, "msg-experience-0002");
  assert.deepEqual(list.messages[1], GOLDEN);
});

test("structure rejections carry zod diagnostics", async () => {
  const noText = { ...GOLDEN, messageId: "m3", parts: [{ kind: "data", data: { name: "x" } }] };
  const e1 = (
    await post({ jsonrpc: "2.0", id: 3, method: "message/send", params: { message: noText } })
  ).json().error;
  assert.equal(e1.code, -32602);
  assert.match(JSON.stringify(e1.data), /text/); // 错误数据能定位到缺 text part

  const badCtx = { ...GOLDEN, messageId: "m4", contextId: "other" };
  const e2 = (
    await post({ jsonrpc: "2.0", id: 4, method: "message/send", params: { message: badCtx } })
  ).json().error;
  assert.equal(e2.code, -32602);

  const e3 = (await post({ jsonrpc: "2.0", id: 5, method: "message/stream", params: {} })).json()
    .error;
  assert.equal(e3.code, -32601);
});
