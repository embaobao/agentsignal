/**
 * 适配器契约测试套件（local-capability-plane 轨道 C · C2，V0 层）。
 *
 * 「四方法 × 门控 × 锁」的通用套件，A 轨适配器直接套用——新适配器接入 = 3 行：
 *   import { runAdapterContract } from "./scenarios/contract.ts";
 *   test("apm 契约", () => runAdapterContract(makeApmAdapter()));
 *   // （需要锁语义时传 { lock: acquireHostLock }——1.4 落地后启用）
 *
 * V0 断言面（types.ts 结构契约）：
 *   - probe 返回结构（available + 缺席 reason）；
 *   - capabilities() 返回非空 ReadonlySet；
 *   - hosts() 非空；
 *   - deploy 产物 ladder ∈ L1/L2/L3 且 skipped[] 逐条带 reason（降级可见，D10）；
 *   - reconcile 硬要求（规则三）：必实现且 entries 结构合规；
 *   - 声明一致性：remove 未见声明时，remove() 调用必须抛 UnsupportedCapability（规则一）。
 * 门控 assertCap（1.2）与归属锁（1.4）落地后经 options.gate/options.lock 插入——骨架位已留。
 */
import assert from "node:assert/strict";
import {
  type Cap,
  type CapabilityAdapter,
  type PackageItem,
  UnsupportedCapability,
} from "../../src/capability/types.ts";

export interface ContractOptions {
  /** 1.2 落地后传 assertCap——对每个 Cap 断言门控行为（骨架位） */
  gate?: (adapter: CapabilityAdapter, cap: Cap) => void;
  /** 1.4 落地后传 acquire/release——断言一宿主×一能力单适配器（骨架位） */
  lock?: {
    acquire: (host: string, cap: string, adapterId: string) => void;
    release: (host: string, cap: string) => void;
    conflict: (host: string, cap: string) => unknown;
  };
  /** deploy/remove 用的测试条目（缺省最小 skill 条目） */
  items?: { id: string; cap: Cap; path: string }[];
}

const DEFAULT_ITEMS = [
  { id: "contract_probe", cap: "skill" as const, path: "skills/contract_probe/SKILL.md" },
];

/** 契约套件：同步断言全部跑完，违规直接 throw（接入方包一层 test 即可） */
export async function runAdapterContract(
  adapter: CapabilityAdapter,
  options: ContractOptions = {},
): Promise<void> {
  const items = options.items ?? DEFAULT_ITEMS;

  // ── probe：结构契约（缺席不是错误，但必须有结构）──
  const availability = await adapter.probe();
  assert.equal(
    typeof availability.available,
    "boolean",
    `${adapter.id}.probe().available 必须是 boolean`,
  );
  if (!availability.available) {
    assert.ok(
      typeof availability.reason === "string" && availability.reason.length > 0,
      `${adapter.id} 不可用时必须带 reason（降级可见，D10）`,
    );
  }

  // ── capabilities：非空 ReadonlySet（规则一的数据基础）──
  const caps = adapter.capabilities();
  assert.ok(
    caps instanceof Set || typeof caps.has === "function",
    "capabilities() 须返回 Set 形态",
  );
  assert.ok(caps.size > 0, `${adapter.id} 必须至少声明一个能力（空声明 = 不可用，应省略适配器）`);

  // ── hosts：非空（空宿主集的适配器不可用）──

  // ── deploy：ladder 落档 + skipped 逐条带 reason ──
  const host = adapter.hosts()[0];
  assert.ok(host !== undefined, `${adapter.id}.hosts() 不能为空`);
  const deploy = await adapter.deploy(items as PackageItem[], host);
  assert.ok(
    ["L1", "L2", "L3"].includes(deploy.ladder),
    `${adapter.id}.deploy().ladder 必须是 L1/L2/L3，实得 ${String(deploy.ladder)}`,
  );
  for (const s of deploy.skipped ?? []) {
    assert.ok(s.reason && s.reason.length > 0, "skipped 条目必须带 reason（D10 不静默）");
  }

  // ── remove：声明一致性（规则一）——未声明 remove 时调用必须抛 UnsupportedCapability ──
  if (!caps.has("remove")) {
    await assert.rejects(
      () => adapter.remove(items as PackageItem[], host),
      (err: unknown) =>
        err instanceof UnsupportedCapability ||
        (err instanceof Error && err.name === "UnsupportedCapability"),
      `${adapter.id} 未声明 remove，调用时必须抛 UnsupportedCapability`,
    );
  } else {
    const removed = await adapter.remove(items as PackageItem[], host);
    for (const s of removed.skipped ?? []) {
      assert.ok(s.reason && s.reason.length > 0, "remove skipped 条目必须带 reason");
    }
  }

  // ── reconcile：规则三硬要求 ──
  const report = await adapter.reconcile();
  assert.ok(Array.isArray(report.entries), "reconcile().entries 必须是数组");
  assert.ok(typeof report.at === "string" && report.at.length > 0, "reconcile().at 必须是对账时间");
  for (const e of report.entries) {
    assert.ok(
      ["active", "outdated", "revoked", "missing", "foreign"].includes(e.state),
      `对账五态之外的状态：${String(e.state)}`,
    );
  }

  // ── 门控/锁骨架位（1.2/1.4 落地后由接入方传入即自动生效）──
  if (options.gate) {
    for (const cap of caps) options.gate(adapter, cap);
  }
  if (options.lock) {
    options.lock.acquire(String(host), "skill", adapter.id);
    const conflict = options.lock.conflict(String(host), "skill");
    assert.ok(conflict !== undefined, "锁位被占时 conflict 必须可见（HostLockConflict）");
    options.lock.release(String(host), "skill");
  }
}
