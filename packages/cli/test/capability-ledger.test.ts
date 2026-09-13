/**
 * P1 1.3 归属账本单测（local-capability-plane · node:test 单口径）。
 *
 * ledger.json5（schema v1，design §3.2）：委托记录 + 委托快照（sha256 自足——
 * 适配器缺席/被卸载后账本仍能回答"当时装了什么"）。
 * tmp+rename 原子写；进程内文件级互斥（并发 append 零丢写）；快照 sha256 断言。
 * 夹具 = 临时 root（AGENTSSIGNAL_CONFIG），不碰真实 ~/.agentsignal。
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { appendLedger, loadLedger, snapshotOf } from "../src/capability/ledger.ts";
import { resolvePaths } from "../src/skills/paths.ts";

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-ledger-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  delete process.env.AGENTSIGNAL_CONFIG;
  if (root) await rm(root, { recursive: true, force: true });
});

test("snapshotOf：委托快照 sha256 与 node crypto 一致（自足性）", async () => {
  const dir = path.join(root, "probe-host");
  await mkdir(path.join(dir, "skills", "x"), { recursive: true });
  await writeFile(path.join(dir, "skills", "x", "SKILL.md"), "快照内容\n", "utf8");
  const snap = await snapshotOf(dir, ["skills/x/SKILL.md"]);
  assert.equal(snap.length, 1);
  assert.equal(snap[0]?.path, "skills/x/SKILL.md");
  // sha256("快照内容\n") = 已知值
  const { createHash } = await import("node:crypto");
  const expected = createHash("sha256").update("快照内容\n", "utf8").digest("hex");
  assert.equal(snap[0]?.sha256, expected);
});

test("append + load：schema v1 结构合规（读回字段逐一断言）", async () => {
  const p = resolvePaths(root);
  await appendLedger(
    {
      pkg_id: "pkg_01demo",
      adapter: "native",
      host: "claude-code",
      mode: "link",
      ladder: "L1",
      items: ["skills/x"],
      snapshot: [{ path: "skills/x/SKILL.md", sha256: "ab".repeat(32) }],
    },
    p,
  );
  const ledger = await loadLedger(p);
  assert.equal(ledger.schema, "agentsignal.ledger/v1");
  const e = ledger.entries[0];
  assert.equal(e?.pkg_id, "pkg_01demo");
  assert.equal(e?.adapter, "native");
  assert.equal(e?.mode, "link");
  assert.equal(e?.ladder, "L1");
  assert.deepEqual(e?.items, ["skills/x"]);
  assert.equal(e?.snapshot[0]?.sha256, "ab".repeat(32));
  assert.ok(typeof e?.at === "string" && e.at.length > 0, "append 自动盖时间戳");
  // 原子写：无 tmp 残留
  const files = await readdir(p.root);
  assert.ok(
    files.every((f) => !f.includes(".tmp-")),
    "不得留 tmp 残留",
  );
});

test("文件级互斥：并发 10 次 append 零丢写（进程内串行化）", async () => {
  const p = resolvePaths(root);
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      appendLedger(
        {
          pkg_id: `pkg_concurrent_${i}`,
          adapter: "native",
          host: "cursor",
          mode: "copy",
          ladder: "L2",
          items: [],
          snapshot: [],
        },
        p,
      ),
    ),
  );
  const ledger = await loadLedger(p);
  const concurrent = ledger.entries.filter((e) => e.pkg_id.startsWith("pkg_concurrent_"));
  assert.equal(concurrent.length, 10, "并发写零丢失（read-modify-write 互斥）");
  // schema v1 头仍在且唯一
  assert.equal(ledger.schema, "agentsignal.ledger/v1");
});

test("空账本读入：schema v1 + 空 entries（零破坏）", async () => {
  const empty = await loadLedger(
    resolvePaths(await mkdtemp(path.join(tmpdir(), "as-ledger-empty-"))),
  );
  assert.equal(empty.schema, "agentsignal.ledger/v1");
  assert.deepEqual(empty.entries, []);
});

test("损坏账本读入：非法 JSON5 → v1 空账本零阻断（修复/重建由使用方决定）", async () => {
  const bad = await mkdtemp(path.join(tmpdir(), "as-ledger-bad-"));
  process.env.AGENTSIGNAL_CONFIG = bad;
  try {
    const p = resolvePaths(bad);
    await mkdir(p.root, { recursive: true });
    await writeFile(path.join(p.root, "ledger.json5"), "{{{ 非法内容", "utf8");
    const ledger = await loadLedger(p);
    assert.equal(ledger.schema, "agentsignal.ledger/v1");
    assert.deepEqual(ledger.entries, []);
  } finally {
    delete process.env.AGENTSIGNAL_CONFIG;
    await rm(bad, { recursive: true, force: true });
  }
});
