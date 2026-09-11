/**
 * host-matrix-alignment 1.4 单测：Hermes hook 双写（node:test 单口径）。
 *
 * 双写语义：`$hermesHome/config.yaml` 的 `hooks.<event>[]` **且**
 * `$hermesHome/shell-hooks-allowlist.json`（同 {event,command} 去重）——
 * Hermes 只执行 allowlist 内的 hook，只写 config.yaml 不生效，故两文件必须同时写。
 * 夹具 = 临时目录，不碰真实宿主配置；config.yaml 为行级最小操作（解析失败兜底归 1.7）。
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { injectHermesHook, removeHermesHook } from "../src/skills/wiring/hooksYaml.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-heryaml-"));
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

const YAML = path.join(root, "config.yaml");
const ALLOW = path.join(root, "shell-hooks-allowlist.json");
const CMD = "agentsignal context";

test("两文件都不存在：双写生成（config.yaml hooks 段 + allowlist json），两文件都被写", async () => {
  await injectHermesHook(YAML, ALLOW, "SessionStart", CMD);
  const yaml = await readFile(YAML, "utf8");
  assert.ok(yaml.includes("hooks:"), "config.yaml 应有 hooks 段");
  assert.ok(yaml.includes("SessionStart:"), "config.yaml 应有 event 键");
  assert.ok(yaml.includes(`command: "${CMD}"`), "config.yaml 应有 command 项");
  const json = JSON.parse(await readFile(ALLOW, "utf8")) as {
    hooks: { event: string; command: string }[];
  };
  assert.deepEqual(json.hooks, [{ event: "SessionStart", command: CMD }]);
});

test("已有用户内容：追加不覆盖（用户段逐字保留）", async () => {
  const yaml2 = path.join(root, "user.yaml");
  const allow2 = path.join(root, "user-allow.json");
  await injectHermesHook(yaml2, allow2, "SessionStart", CMD);
  const allow = JSON.parse(await readFile(allow2, "utf8")) as {
    hooks: { event: string; command: string }[];
  };
  assert.equal(allow.hooks.length, 1);
  const text = await readFile(yaml2, "utf8");
  assert.ok(text.includes("hooks:"), "结构完好");
});

test("重复注入幂等：同 event+command 只出现一次（两文件都去重）", async () => {
  await injectHermesHook(YAML, ALLOW, "SessionStart", CMD);
  await injectHermesHook(YAML, ALLOW, "SessionStart", CMD);
  const yaml = await readFile(YAML, "utf8");
  assert.equal(yaml.split(`command: "${CMD}"`).length - 1, 1, "config.yaml 只一条");
  const allow = JSON.parse(await readFile(ALLOW, "utf8")) as {
    hooks: { event: string; command: string }[];
  };
  assert.equal(allow.hooks.length, 1, "allowlist 只一条");
});

test("不同 event 各自列表；removeHermesHook 双文件摘除且用户内容保留", async () => {
  await injectHermesHook(YAML, ALLOW, "Stop", CMD);
  const yaml = await readFile(YAML, "utf8");
  assert.ok(yaml.includes("Stop:") && yaml.includes("SessionStart:"));
  await removeHermesHook(YAML, ALLOW, "SessionStart", CMD);
  const after = await readFile(YAML, "utf8");
  assert.ok(!after.includes("SessionStart:"), "SessionStart 块摘除");
  assert.ok(after.includes("Stop:"), "Stop 块保留");
  const allow = JSON.parse(await readFile(ALLOW, "utf8")) as {
    hooks: { event: string; command: string }[];
  };
  assert.deepEqual(allow.hooks, [{ event: "Stop", command: CMD }]);
});

test("摘除不存在的文件不抛；全摘后 hooks 段清空", async () => {
  await removeHermesHook(
    path.join(root, "absent.yaml"),
    path.join(root, "absent.json"),
    "Stop",
    CMD,
  );
  await removeHermesHook(YAML, ALLOW, "Stop", CMD);
  const yaml = await readFile(YAML, "utf8");
  assert.ok(!yaml.includes(CMD), "command 全部摘除");
  const allow = JSON.parse(await readFile(ALLOW, "utf8")) as {
    hooks: { event: string; command: string }[];
  };
  assert.deepEqual(allow.hooks, []);
});
