/**
 * P1 1.7 降级矩阵首条夹具（local-capability-plane · node:test 单口径）。
 * （审查席勘误 2026-09-15：原头注误标 1.6——1.6 为 capability/adapters/apm.ts 适配器，保持待认领。）
 *
 * 矩阵首行「宿主能力位」（design §1.2）：有 skills 位 → L1 直写；
 * 无 skills 位但有 MCP → L2 + 原因可见；两者皆无 → L3 + 原因可见。
 * fake 降级适配器经 C2 契约套件全绿（四方法 × 门控 × 锁同一套断言），
 * 并与 broker 组合验证「native 缺席 → 降级适配器接管不报错」（S6 形态）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { selectAdapter } from "../../src/capability/broker.ts";
import type { CapabilityAdapter, PackageItem } from "../../src/capability/types.ts";
import { UnsupportedCapability } from "../../src/capability/types.ts";
import { runAdapterContract } from "./contract.ts";

/** 降级 fake：按宿主能力位返回实际落档（skipped 必带原因，D10 不静默） */
function makeDegradingAdapter(): CapabilityAdapter {
  const deployTo = (host: string): "L1" | "L2" | "L3" =>
    host === "claude-code" ? "L1" : host === "cursor" ? "L2" : "L3";
  return {
    id: "fake-degrading",
    probe: async () => ({ available: true }),
    capabilities: () => new Set(["skill", "deploy"] as const),
    hosts: () => ["claude-code", "cursor", "gemini"],
    deploy: async (items: PackageItem[], host) => {
      const ladder = deployTo(host);
      return {
        host,
        ladder,
        written: ladder === "L1" ? items.map((i) => i.path) : [],
        skipped:
          ladder === "L1"
            ? undefined
            : [
                {
                  target: host,
                  reason:
                    ladder === "L2"
                      ? "宿主无 skills 位但有 MCP——落 L2 按需可达"
                      : "宿主无 skills 位且无 MCP——落 L3 rules 一行兜底",
                },
              ],
      };
    },
    remove: async () => {
      // 未声明 remove（矩阵首行降级适配器只装不卸）——规则一自守卫
      throw new UnsupportedCapability({ adapter: "fake-degrading", cap: "remove" });
    },
    reconcile: async () => ({ entries: [], at: new Date().toISOString() }),
  };
}

test("契约套件：降级 fake 全绿（四方法 × 门控同一套断言）", async () => {
  await runAdapterContract(makeDegradingAdapter());
});

test("降级矩阵首条：L1 直写 · L2 带原因 · L3 带原因（不报错不静默）", async () => {
  const adapter = makeDegradingAdapter();
  const items: PackageItem[] = [{ id: "x", cap: "skill", path: "skills/x/SKILL.md" }];
  const l1 = await adapter.deploy(items, "claude-code");
  assert.equal(l1.ladder, "L1");
  assert.deepEqual(l1.written, ["skills/x/SKILL.md"]);
  const l2 = await adapter.deploy(items, "cursor");
  assert.equal(l2.ladder, "L2");
  assert.match(l2.skipped?.[0]?.reason ?? "", /L2/);
  const l3 = await adapter.deploy(items, "gemini");
  assert.equal(l3.ladder, "L3");
  assert.match(l3.skipped?.[0]?.reason ?? "", /L3/);
});

test("S6 形态：native 缺席 → 降级适配器接管不报错", async () => {
  const degraded = makeDegradingAdapter();
  const absentNative: CapabilityAdapter = {
    ...(await (async () => ({ ...degraded, id: "native" }))()),
    probe: async () => ({ available: false, reason: "native 未安装" }),
  };
  const picked = await selectAdapter([absentNative, degraded]);
  assert.equal(picked?.id, "fake-degrading", "降级适配器接管");
});
