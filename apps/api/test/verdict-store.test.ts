/**
 * 2.4 Verdict Store 状态机单测（audit-restore · node:test 零依赖）。
 * 覆盖（tasks.md 2.4 + 设计 MUST #4）：
 *   固定转移表（publish→keep/amend/freeze→tombstone）· 非法转移抛错（不静默）·
 *   tombstoned 直接恢复禁止（先到 frozen 两步）· verdicts.json 持久化（原子写）·
 *   history 追加 · 非法转移不落盘。
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { assertTransition, VerdictError, VerdictStore, verdictStates } from "@agentssignal/audit";

let dir = "";
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "as-verdict-"));
});
after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const FILE = () => path.join(dir, "verdicts.json");

describe("状态机转移表", () => {
  test("合法转移全通过（publish→keep/amend/freeze→tombstone 等）", () => {
    for (const [from, to] of [
      ["published", "kept"],
      ["published", "amended"],
      ["published", "frozen"],
      ["published", "tombstoned"],
      ["kept", "amended"],
      ["kept", "frozen"],
      ["kept", "tombstoned"],
      ["amended", "kept"],
      ["frozen", "kept"],
      ["frozen", "tombstoned"],
      ["tombstoned", "frozen"], // 还原两步的第一步（2.6）
    ] as const) {
      assert.doesNotThrow(() => assertTransition(from, to), `${from}→${to} 应合法`);
    }
  });

  test("非法转移抛 VerdictError（不静默）：自转移 / tombstoned 直接恢复 / 越级", () => {
    assert.throws(
      () => assertTransition("published", "published"),
      (e: unknown) => e instanceof VerdictError,
    );
    // 2.6/2.10 口径：tombstoned 直接回 published 禁止（必须先 frozen）
    assert.throws(() => assertTransition("tombstoned", "published"), VerdictError);
    assert.throws(() => assertTransition("kept", "kept"), VerdictError);
    // 词表外状态直接拒绝
    assert.throws(() => assertTransition("archived" as never, "kept"), VerdictError);
  });

  test("verdictStates 词表固定五态", () => {
    assert.deepEqual([...verdictStates], ["published", "kept", "amended", "frozen", "tombstoned"]);
  });
});

describe("VerdictStore（verdicts.json 持久化）", () => {
  test("transition 落盘 + 重载状态一致 + history 追加", async () => {
    const store = new VerdictStore(FILE());
    store.transition("sig_01A", "amended", { actor: "admin:z", at: "2026-09-16T00:00:00Z" });
    store.transition("sig_01A", "frozen", { actor: "admin:z", at: "2026-09-16T00:01:00Z" });

    const reopened = new VerdictStore(FILE());
    const rec = reopened.get("sig_01A");
    assert.equal(rec?.state, "frozen");
    assert.equal(rec?.history.length, 2);
    assert.equal(rec?.history[0]?.to, "amended");
    assert.equal(rec?.history[1]?.from, "amended");
  });

  test("非法转移不落盘：状态不变、无历史污染、异常抛出", async () => {
    const store = new VerdictStore(FILE());
    store.transition("sig_01B", "frozen", { actor: "admin:z", at: "2026-09-16T00:00:00Z" });
    assert.throws(
      () => store.transition("sig_01B", "published", { actor: "a", at: "x" }),
      VerdictError,
    );
    const rec = store.get("sig_01B");
    assert.equal(rec?.state, "frozen");
    assert.equal(rec?.history.length, 1, "失败转移不进 history");
  });

  test("未知名录按 published 起步；get 未知名录为 undefined", () => {
    const store = new VerdictStore(FILE());
    assert.equal(store.get("sig_未知"), undefined);
    store.transition("sig_新", "tombstoned", { actor: "a", at: "t" });
    assert.equal(store.get("sig_新")?.state, "tombstoned");
  });
});
