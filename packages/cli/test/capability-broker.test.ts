/**
 * P1 1.5 broker 单测（local-capability-plane · node:test 单口径）。
 *
 * 适配器选择（决议 D5 优先级）：用户声明优先 → native 优先 → 其余按序；
 * probe 不可用 → 换下一个**不报错**；全不可用 → undefined（上层走降级阶梯 D10）。
 * 全程 fake 适配器，零 IO。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { selectAdapter } from "../src/capability/broker.ts";
import type { CapabilityAdapter } from "../src/capability/types.ts";

function fake(id: string, available = true): CapabilityAdapter {
  return {
    id,
    probe: async () => ({ available, reason: available ? undefined : `${id} 缺席` }),
    capabilities: () => new Set(["skill", "deploy"] as const),
    hosts: () => ["claude-code"],
    deploy: async () => ({ host: "claude-code", ladder: "L1", written: [] }),
    remove: async () => ({ host: "claude-code", removed: [] }),
    reconcile: async () => ({ entries: [], at: new Date().toISOString() }),
  };
}

test("用户声明优先：preferred 命中即直选（跳过 probe 顺序与 native 加权）", async () => {
  const picked = await selectAdapter([fake("native"), fake("apm")], { preferred: "apm" });
  assert.equal(picked?.id, "apm");
});

test("preferred 不可用：换下一个不报错（不盲选声明）", async () => {
  const picked = await selectAdapter([fake("native"), fake("apm", false)], { preferred: "apm" });
  assert.equal(picked?.id, "native", "声明缺席 → native 接管（S6 降级）");
});

test("native 优先：无声明时探测可用的 native 压过可用的一般适配器", async () => {
  const picked = await selectAdapter([fake("apm"), fake("native")]);
  assert.equal(picked?.id, "native");
});

test("probe 不可用：逐个换适配器不报错，选到可用者为止", async () => {
  const picked = await selectAdapter([fake("pi", false), fake("dsh", false), fake("native")]);
  assert.equal(picked?.id, "native");
});

test("全不可用：返回 undefined（不抛，上层走降级阶梯 D10）", async () => {
  const picked = await selectAdapter([fake("pi", false), fake("dsh", false)]);
  assert.equal(picked, undefined);
});

test("空候选列表：返回 undefined", async () => {
  assert.equal(await selectAdapter([]), undefined);
});
