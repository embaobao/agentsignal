/**
 * P1 1.4 归属锁单测（local-capability-plane · node:test 单口径）。
 *
 * 规则二：一宿主 × 一能力 = 一适配器。冲突（HostLockConflict 含持锁方与建议）/
 * 释放 / 复得三断言；锁为进程内语义（CLI 短命令生命周期，跨进程协调归 P2 装载接线）。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { acquireHostLock, releaseHostLock } from "../src/capability/lock.ts";
import { HostLockConflict } from "../src/capability/types.ts";

test("冲突：同宿主同能力被持有时，第二个适配器 acquire 抛 HostLockConflict（含持锁方与建议）", () => {
  acquireHostLock("claude-code", "skill", "apm");
  assert.throws(
    () => acquireHostLock("claude-code", "skill", "native"),
    (err: unknown) => {
      assert.ok(err instanceof HostLockConflict);
      assert.equal((err as HostLockConflict).holder, "apm");
      assert.equal((err as HostLockConflict).host, "claude-code");
      assert.match(err.message, /unwire/);
      return true;
    },
  );
  releaseHostLock("claude-code", "skill");
});

test("不同能力 / 不同宿主互不冲突", () => {
  acquireHostLock("claude-code", "skill", "apm");
  acquireHostLock("claude-code", "mcp", "native");
  acquireHostLock("cursor", "skill", "native");
  releaseHostLock("claude-code", "skill");
  releaseHostLock("claude-code", "mcp");
  releaseHostLock("cursor", "skill");
});

test("释放 / 复得：release 后同槽位可被另一适配器获得；双重释放幂等", () => {
  acquireHostLock("gemini", "skill", "apm");
  releaseHostLock("gemini", "skill");
  // 复得：换适配器持锁成功，冲突方指向新持锁者
  acquireHostLock("gemini", "skill", "native");
  assert.throws(
    () => acquireHostLock("gemini", "skill", "apm"),
    (err: unknown) =>
      err instanceof HostLockConflict && (err as HostLockConflict).holder === "native",
  );
  releaseHostLock("gemini", "skill");
  releaseHostLock("gemini", "skill"); // 双重释放不抛（幂等）
});
