// R2 回归：官方 @a2a-js/sdk client 与本服务的互认验证（持续回归，非一次性脚本）。
// 验证点：① 官方 ClientFactory 能从 /.well-known/agent-card.json 建连
//        ② 官方 client.sendMessage 发出的 wire 与固化结构 v0 互认（能落库、能拉回）
// 双运行时：bun test 与 node --experimental-strip-types --test。
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { AgentCard, Message } from "@a2a-js/sdk";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "agentsignal-r2-"));
process.env.AGENTSIGNAL_NO_LISTEN = "1";

const { buildApp } = await import("../../apps/share/src/server.ts");
const { ClientFactory } = await import("@a2a-js/sdk/client");

let app: FastifyInstance;
let base = "";

before(async () => {
  app = buildApp();
  await app.listen({ port: 0, host: "127.0.0.1" });
  base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
});
after(async () => {
  await app.close();
});

test("official SDK resolves our agent card and builds a client", async () => {
  const factory = new ClientFactory();
  const client = await factory.createFromUrl(base); // 默认打 /.well-known/agent-card.json
  assert.ok(client, "client created from card");
});

test("official SDK sendMessage round-trips through frozen schema v0", async () => {
  const factory = new ClientFactory();
  const client = await factory.createFromUrl(base);

  // SDK 内部 Part 形态：{ $case: "text", value }，transport 层序列化为 A2A JSON wire
  const message = {
    role: "user",
    parts: [{ $case: "text" as const, value: "# SDK interop\nR2 wire compatibility probe." }],
    messageId: `msg-sdk-${Date.now()}`,
    contextId: "experience-share",
  } satisfies Message;

  const result = (await client.sendMessage({ message })) as unknown as {
    message?: { messageId?: string; contextId?: string };
  };
  assert.ok(result, "sendMessage returned a result without protocol error");

  // 服务侧拉回同一条：官方 client 发出的消息已被固化结构接收并落库
  const fetched = await fetch(`${base}/messages/${message.messageId}`);
  assert.equal(fetched.status, 200);
  const stored = (await fetched.json()) as { contextId: string; parts: { kind: string }[] };
  assert.equal(stored.contextId, "experience-share");
  assert.ok(stored.parts.some((p) => p.kind === "text"), "text part preserved on wire");
});
