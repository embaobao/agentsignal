/**
 * P1 1.2 capability/caps 单测（node:test 单口径）。
 *
 * 能力门控（规则一）：assertCap 对未声明能力抛 UnsupportedCapability（结构化错）；
 * 已声明放行。冻结枚举 Cap 的完整性由 types.ts 编译期锁定，此处锁运行时守卫行为。
 * C2 契约套件的 options.gate 钩子即消费本函数。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCap } from "../src/capability/caps.ts";
import type { CapabilityAdapter } from "../src/capability/types.ts";

function fake(caps: Cap[]): CapabilityAdapter {
  return {
    id: caps.includes("remove") ? "fake-full" : "fake-no-remove",
    probe: async () => ({ available: true }),
    capabilities: () => new Set(caps),
    hosts: () => ["claude-code"],
    deploy: async () => ({ host: "claude-code", ladder: "L1", written: [] }),
    remove: async () => ({ host: "claude-code", removed: [] }),
    reconcile: async () => ({ entries: [], at: new Date().toISOString() }),
  };
}
type Cap = ReturnType<CapabilityAdapter["capabilities"]> extends ReadonlySet<infer C> ? C : never;

test("assertCap：未声明 remove 抛 UnsupportedCapability（APM 实测形态守卫）", () => {
  const apm = fake(["skill", "deploy"]);
  assert.throws(
    () => assertCap(apm, "remove"),
    (err: unknown) =>
      err instanceof Error &&
      err.name === "UnsupportedCapability" &&
      (err as { adapter?: string }).adapter === "fake-no-remove" &&
      (err as { cap?: string }).cap === "remove",
  );
});

test("assertCap：已声明能力放行（不抛即通过）", () => {
  const native = fake(["skill", "deploy", "remove", "audit"]);
  assert.doesNotThrow(() => assertCap(native, "remove"));
  assert.doesNotThrow(() => assertCap(native, "audit"));
});

test("assertCap：全部九能力对未声明适配器逐一拒绝（枚举冻结覆盖）", () => {
  const none = fake([]);
  for (const cap of [
    "skill",
    "mcp",
    "prompt",
    "rule",
    "deploy",
    "remove",
    "audit",
    "runtime",
    "switch",
  ] as const) {
    assert.throws(
      () => assertCap(none, cap),
      (e: unknown) => e instanceof Error,
      `能力 ${cap} 应被拒`,
    );
  }
});
