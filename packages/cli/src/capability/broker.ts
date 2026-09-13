/**
 * 适配器选择器（local-capability-plane P1 · 1.5，决议 D5 优先级规则）。
 *
 * 选择序：用户声明（preferred）→ native → 其余按传入序；
 * probe 不可用者跳过**不报错**（缺席是降级信号不是异常，S6）；全不可用 → undefined，
 * 由上层走降级阶梯（D10：L1→L2→L3，取不到任何一档才允许报错）。
 * 纯选择逻辑、零副作用——probe 本身属适配器（可用性探测见各 adapter）。
 */
import type { CapabilityAdapter } from "./types.ts";

export interface SelectOptions {
  /** 用户声明（config.hosts / 显式 --adapter）：命中者最高优先（但 probe 不可用仍让位） */
  preferred?: string;
}

/** 按优先级选第一个 probe 可用的适配器；全不可用返回 undefined（不抛错） */
export async function selectAdapter<T extends CapabilityAdapter>(
  adapters: readonly T[],
  options: SelectOptions = {},
): Promise<T | undefined> {
  const { preferred } = options;
  const order = [...adapters].sort((a, b) => rank(a) - rank(b));
  // preferred 置顶（保持稳定：同分按传入序）
  const ordered = preferred
    ? [...order.filter((a) => a.id === preferred), ...order.filter((a) => a.id !== preferred)]
    : order;

  for (const adapter of ordered) {
    const { available } = await adapter.probe();
    if (available) return adapter;
  }
  return undefined;
}

/** 排序权值：native 最优先，其余按传入序（稳定排序保序） */
function rank(adapter: CapabilityAdapter): number {
  return adapter.id === "native" ? 0 : 1;
}
