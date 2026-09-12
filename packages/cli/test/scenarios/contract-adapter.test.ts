/**
 * C2 契约套件自证：fake 适配器跑通 + 「新适配器接入 = 3 行」示范（轨道 C）。
 *
 * fakeFull —— 声明 skill/deploy/remove/reconcile 全能力（native 形态）；
 * fakeNoRemove —— 不声明 remove（APM 实测形态，规则一）。
 * 门控/锁钩子位（options.gate/lock）待 1.2/1.4 落地后由 A 轨接入。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { CapabilityAdapter } from "../../src/capability/types.ts";
import { runAdapterContract } from "./contract.ts";

function makeFakeFull(): CapabilityAdapter {
  return {
    id: "fake-full",
    probe: async () => ({ available: true, version: "0.0.0" }),
    capabilities: () => new Set(["skill", "deploy", "remove"] as const),
    hosts: () => ["claude-code"],
    deploy: async (items) => ({
      host: "claude-code",
      ladder: "L1",
      written: items.map((i) => `${i.path}`),
    }),
    remove: async (items) => ({ host: "claude-code", removed: items.map((i) => i.path) }),
    reconcile: async () => ({
      entries: [{ item: "skills/contract_probe", host: "claude-code", state: "active" }],
      at: new Date().toISOString(),
    }),
  };
}

function makeFakeNoRemove(): CapabilityAdapter {
  const base = makeFakeFull();
  return {
    ...base,
    id: "fake-no-remove",
    probe: async () => ({ available: false, reason: "未安装 APM（S6 前半形态）" }),
    capabilities: () => new Set(["skill", "deploy"] as const),
    remove: async () => {
      throw new UnsupportedCapabilityShim();
    },
  };
}

/** APM 形态适配器的 remove 守卫（1.2 assertCap 落地前，适配器自守卫的同形错误） */
class UnsupportedCapabilityShim extends Error {
  override name = "UnsupportedCapability";
}

test("契约套件：fakeFull 全绿（新适配器接入 = 3 行示范）", async () => {
  // 接入示范：import 套件 → 构造适配器 → 一行跑契约
  await runAdapterContract(makeFakeFull());
});

test("契约套件：fakeNoRemove 过声明一致性（未声明 remove 必须自守卫抛错）", async () => {
  await runAdapterContract(makeFakeNoRemove());
});

test("契约套件：缺席 probe 带 reason 才放行（D10 降级可见）", async () => {
  const noReason = makeFakeNoRemove();
  noReason.probe = async () => ({ available: false });
  await assert.rejects(() => runAdapterContract(noReason), /不可用时必须带 reason/);
});

test("契约套件：reconcile 缺失即违约（规则三硬要求）", async () => {
  const noReconcile = makeFakeFull() as Partial<CapabilityAdapter>;
  delete noReconcile.reconcile; // 故意违约：模拟未实现 reconcile 的适配器
  await assert.rejects(() => runAdapterContract(noReconcile as CapabilityAdapter));
});
