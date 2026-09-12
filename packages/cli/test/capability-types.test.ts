/**
 * P1 1.1 capability/types 单测（node:test 单口径）。
 *
 * 类型层 DoD：类型编译过（check 全仓 tsc 即门）+ DeployResult 含 ladder 与
 * skipped[].reason 结构；两个结构化错误（UnsupportedCapability / HostLockConflict）
 * 的运行时行为（code/字段/message 可读）。零 IO、零外部依赖。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type Cap,
  type CapabilityAdapter,
  type DeployResult,
  HostLockConflict,
  type PackageItem,
  UnsupportedCapability,
} from "../src/capability/types.ts";

test("DeployResult 结构：ladder 实际落档 + skipped[].reason 必带原因", () => {
  const r: DeployResult = {
    host: "claude-code",
    ladder: "L2",
    written: [],
    skipped: [{ target: "cursor", reason: "宿主无 skills 位，落 L2 经 MCP 按需" }],
    warnings: ["字段 x 因宿主不支持被丢弃"],
  };
  assert.equal(r.ladder, "L2");
  assert.equal(r.skipped?.[0]?.reason, "宿主无 skills 位，落 L2 经 MCP 按需");
});

test("UnsupportedCapability：规则一结构化错（code/adapter/cap/message 可读）", () => {
  const err = new UnsupportedCapability({ adapter: "apm", cap: "remove" });
  assert.ok(err instanceof Error);
  assert.equal(err.code, "UNSUPPORTED_CAPABILITY");
  assert.equal(err.adapter, "apm");
  assert.equal(err.cap, "remove");
  assert.ok(err.message.includes("apm") && err.message.includes("remove"));
  assert.ok(err.message.includes("capabilities()"), "message 指出自纠路径");
});

test("HostLockConflict：规则二结构化错（含持锁方与建议）", () => {
  const err = new HostLockConflict({ host: "claude-code", cap: "skill", holder: "apm" });
  assert.equal(err.code, "HOST_LOCK_CONFLICT");
  assert.equal(err.holder, "apm");
  assert.ok(err.message.includes("apm") && err.message.includes("unwire"));
});

test("CapabilityAdapter 形状：fake 适配器可完整实现（编译期形状锁定）", async () => {
  const caps: ReadonlySet<Cap> = new Set(["skill", "deploy", "reconcile"] as Cap[]);
  const fake: CapabilityAdapter = {
    id: "fake",
    probe: async () => ({ available: true, version: "0.0.0" }),
    capabilities: () => caps,
    hosts: () => ["claude-code"],
    deploy: async () => ({ host: "claude-code", ladder: "L1", written: [] }),
    remove: async () => ({ host: "claude-code", removed: [] }),
    reconcile: async () => ({
      entries: [{ item: "skills/x", host: "claude-code", state: "foreign", detail: "非我方写入" }],
      at: "2026-09-13T00:00:00.000Z",
    }),
  };
  const items: PackageItem[] = [{ id: "x", cap: "skill", path: "skills/x/SKILL.md" }];
  const r = await fake.deploy(items, "claude-code");
  assert.equal(r.ladder, "L1");
  const report = await fake.reconcile();
  assert.equal(report.entries[0]?.state, "foreign");
  assert.ok(!caps.has("remove"), "fake 未声明 remove——门控（1.2）将拒绝");
});
