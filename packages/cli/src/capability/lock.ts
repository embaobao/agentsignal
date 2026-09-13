/**
 * 归属锁（local-capability-plane P1 · 1.4，决议 D5 规则二）。
 *
 * 一宿主 × 一能力 = 一适配器：同一槽位被持有时，其他适配器 acquire 即抛
 * HostLockConflict（含持锁方与 unwire 建议）。锁是进程内语义——CLI 短命令
 * （init/deploy/uninstall）单进程生命周期内保证互斥；跨进程协调（多终端并发）
 * 归 P2 装载接线时随 ledger 升级。
 */
import { HostLockConflict } from "./types.ts";

/** 槽位键：host × cap */
const locks = new Map<string, string>();

function slot(host: string, cap: string): string {
  return `${host}::${cap}`;
}

/** 获得归属锁：槽位空闲或已由同一适配器持有（幂等复得）→ 成功；否则抛 HostLockConflict */
export function acquireHostLock(host: string, cap: string, adapterId: string): void {
  const key = slot(host, cap);
  const holder = locks.get(key);
  if (holder !== undefined && holder !== adapterId) {
    throw new HostLockConflict({
      host: host as never,
      cap: cap as never,
      holder,
    });
  }
  locks.set(key, adapterId);
}

/** 释放归属锁：幂等（未持有/已释放均不抛） */
export function releaseHostLock(host: string, cap: string): void {
  locks.delete(slot(host, cap));
}

/** 只读查询：槽位当前持锁方（undefined = 空闲）——status 呈现与对账用 */
export function lockHolder(host: string, cap: string): string | undefined {
  return locks.get(slot(host, cap));
}
