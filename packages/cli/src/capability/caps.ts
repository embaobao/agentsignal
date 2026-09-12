/**
 * 能力门控（local-capability-plane P1 · 1.2，决议 D5 规则一）。
 *
 * capabilities() 未声明的操作不得调用——APM 实测反例：有 deploy 无 remove，
 * 盲调 remove = 依赖其不存在的命令。assertCap 是所有适配器调用方的统一守卫，
 * C2 契约套件经 options.gate 消费。
 */
import type { Cap, CapabilityAdapter } from "./types.ts";
import { UnsupportedCapability } from "./types.ts";

/** 能力枚举冻结（O10）：与 types.ts 的 Cap 同源，此处导出常量供展示/校验 */
export const FROZEN_CAPS: readonly Cap[] = [
  "skill",
  "mcp",
  "prompt",
  "rule",
  "deploy",
  "remove",
  "audit",
  "runtime",
  "switch",
] as const;

/** 规则一守卫：adapter 未声明 cap 即抛 UnsupportedCapability，声明则放行 */
export function assertCap(adapter: CapabilityAdapter, cap: Cap): void {
  if (!adapter.capabilities().has(cap)) {
    throw new UnsupportedCapability({ adapter: adapter.id, cap });
  }
}
