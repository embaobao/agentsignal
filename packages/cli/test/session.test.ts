/**
 * Trace 持久化（skill-engine 2.3）：只记录不审计。
 * TTL 30min · 50 轮上限 · flush 原子落盘 · prune 清过期。
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { resolvePaths } from "../src/skills/paths.ts";
import { createTrace, pruneSessions, SESSION_MAX_ROUNDS, Trace } from "../src/skills/session.ts";

let root = "";

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-session-"));
});

after(async () => {
  await rm(root, { recursive: true, force: true });
});

test("Trace：flush 原子落盘到 sessions/<id>.json", async () => {
  const paths = resolvePaths(root);
  const trace = new Trace(paths, "sess_fixture_1");
  trace.record({ ts: "t1", tool: "search_skills", ok: true, ms: 3 });
  trace.record({ ts: "t2", tool: "load_skill_detail", ok: false, ms: 7, code: "SKILL_NOT_FOUND" });
  const file = await trace.flush();
  const parsed = JSON.parse(await readFile(file, "utf8")) as {
    id: string;
    entries: { tool: string; ok: boolean }[];
  };
  assert.equal(parsed.id, "sess_fixture_1");
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.entries[1]?.ok, false);
});

test("Trace：50 轮自动刷盘上限不爆内存", async () => {
  const trace = createTrace(resolvePaths(root));
  for (let i = 0; i < SESSION_MAX_ROUNDS + 5; i++) {
    trace.record({ ts: String(i), tool: "query_signals", ok: true, ms: 1 });
  }
  assert.ok(trace.length <= SESSION_MAX_ROUNDS, "超过 50 轮应触发自动刷盘并回收");
  await trace.flush();
});

test("pruneSessions：过期（>TTL）会话被清理，新会话保留", async () => {
  const paths = resolvePaths(root);
  const fresh = new Trace(paths, "sess_fresh").file;
  const stale = new Trace(paths, "sess_stale").file;
  await new Trace(paths, "sess_fresh").flush();
  await new Trace(paths, "sess_stale").flush();
  // 伪造过期 mtime
  const old = new Date(Date.now() - 31 * 60_000);
  const { utimes } = await import("node:fs/promises");
  await utimes(stale, old, old);
  void fresh;
  const removed = await pruneSessions(paths);
  assert.equal(removed, 1);
  await import("node:fs/promises").then((fs) => fs.access(fresh));
  await import("node:fs/promises").then((fs) =>
    fs.access(stale).then(
      () => assert.fail("过期会话应被清理"),
      () => undefined,
    ),
  );
});

test("record 在 closed 后不再追加（graceful shutdown 语义）", () => {
  const trace = createTrace(resolvePaths(root));
  trace.close();
  trace.record({ ts: "t", tool: "x", ok: true, ms: 1 });
  assert.equal(trace.length, 0);
});
