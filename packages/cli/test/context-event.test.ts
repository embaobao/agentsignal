/**
 * host-matrix-alignment 1.6 单测：事件映射（node:test 单口径）。
 *
 * TeamAI/Hermes 的 hook event 语义 → AgentSignal 既有推通道：
 *   SessionStart（开工）→ 全量推（L1/L2/L3 现行为）；
 *   Stop（收尾）→ 静默早退——AgentSignal 推通道只服务开工语义，不硬造收尾功能；
 *   未知/缺省 → 按缺省推通道（宽容，hook 侧不炸）。
 * 夹具 = 未初始化目录（contextCmd 静默退出契约顺带覆盖）。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { mapHookEvent, parseEventArg } from "../src/skills/context.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-event-"));
  process.chdir(root); // 未初始化夹具（contextCmd 静默契约）
});
after(async () => {
  process.chdir(tmpdir());
  if (root) await rm(root, { recursive: true, force: true });
});

test("parseEventArg：--event 提取 · 缺省 undefined · 非 event 参数忽略", () => {
  assert.equal(parseEventArg(["--event", "SessionStart"]), "SessionStart");
  assert.equal(parseEventArg(["--event=Stop"]), "Stop");
  assert.equal(parseEventArg(["--event", "SessionStart", "登录"]), "SessionStart");
  assert.equal(parseEventArg(["登录", "认证"]), undefined);
  assert.equal(parseEventArg([]), undefined);
});

test("mapHookEvent：SessionStart→push（全量推）·Stop→noop（不硬造收尾）·未知→push（宽容）", () => {
  assert.equal(mapHookEvent("SessionStart"), "push");
  assert.equal(mapHookEvent("Stop"), "noop");
  assert.equal(mapHookEvent("PreCompact"), "push");
  assert.equal(mapHookEvent(undefined), "push");
});

test("Stop 事件静默早退：不产出正文且未初始化也不炸（hook 不得打断宿主）", async () => {
  const { contextCmd } = await import("../src/skills/context.ts");
  const written: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    await contextCmd(["--event", "Stop"]);
  } finally {
    process.stdout.write = origWrite;
  }
  assert.deepEqual(written, [], "Stop 早退零输出");
});
