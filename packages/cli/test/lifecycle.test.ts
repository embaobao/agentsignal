/**
 * P3.1 更新链单测（dynamic-skill-management · node:test 单口径）。
 *
 * 覆盖（tasks.md 3.1）：lifecycle 新字段向后兼容 · applySignalUpdate 标 outdated +
 * UPDATES.md 附加层（原 SKILL.md 逐字不动）· loadDetail 更新层附加注入 ·
 * sync 对锚定 update 的处理（命中已装技能 → updated；未命中 → 跳过不拉详情）。
 * fake fetch 零外部依赖；决议口径 2026-09-08 裁决 3。
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import JSON5 from "json5";
import { SkillFrontmatterSchema } from "../../protocol/src/skill-schema.ts";
import { defaultConfig, writeConfigAtomic } from "../src/skills/config.ts";
import { installSignal } from "../src/skills/install.ts";
import { applySignalUpdate } from "../src/skills/lifecycle.ts";
import { loadDetail } from "../src/skills/loader.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { scanSkills } from "../src/skills/store.ts";
import { type SyncOptions, syncSubscription } from "../src/skills/sync.ts";
import type { TranscodeInput } from "../src/skills/transcoder.ts";

const SIG = "sig_01lifecyclesrc00000000000000";
const UP = "sig_01lifecycleupd00000000000000";
const OTHER = "sig_01lifecycleabsent00000000000";
const CTX = { base_url: "https://fake.example", synced_at: "2026-09-09T16:00:00.000Z" };
const TOPIC = "ai-research";
const BODY = "## Why\nw\n\n## What worked\n1. s\n\n## Evidence\ne\n\n## Caveats\nc\n";
const UPDATE_BODY = "补充：Windows 下步骤 1 需改用 bash 执行";

function solution(): TranscodeInput {
  return {
    id: SIG,
    topic: TOPIC,
    kind: "solution",
    digest: "语义分块 beats 固定分块 | scope: 中文RAG | validation: self-tested",
    created_at: "2026-09-01T10:00:00.000Z",
    experience: { format: "markdown", body: BODY },
  };
}

let root = "";
before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-lifecycle-"));
  process.env.AGENTSIGNAL_CONFIG = root;
  await writeConfigAtomic(defaultConfig());
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

function opts(extra: Partial<SyncOptions> = {}): SyncOptions {
  return {
    baseUrl: "https://fake.example",
    paths: resolvePaths(),
    sleepImpl: async () => {},
    ...extra,
  };
}

test("schema 向后兼容：旧 lifecycle（无 sync_state/updates）解析出安全默认", () => {
  const fm = SkillFrontmatterSchema.parse({
    id: "x_1",
    name: "n",
    description: "d",
    domains: ["common"],
    layers: ["base"],
    triggers: [],
    lifecycle: {
      status: "incubating",
      metrics: { use_count: 0, worked: 0, partial: 0, failed: 0 },
    },
  });
  assert.equal(fm.lifecycle.sync_state, "active");
  assert.deepEqual(fm.lifecycle.updates, []);
});

test("applySignalUpdate：标 outdated + updates 记录 + UPDATES.md 附加层（原 Runbook 逐字保留）", async () => {
  await installSignal(solution(), CTX);
  const ok = await applySignalUpdate(
    SIG,
    {
      sig_id: UP,
      digest: `[adoption] 步骤修订（anchor: ${SIG}）`,
      synced_at: CTX.synced_at,
      body: UPDATE_BODY,
    },
    resolvePaths(),
  );
  assert.equal(ok, true);
  const meta = JSON5.parse(
    await readFile(path.join(root, "skills", SIG, "skill.json5"), "utf8"),
  ) as { lifecycle: { sync_state: string; updates: { sig_id: string }[] } };
  assert.equal(meta.lifecycle.sync_state, "outdated");
  assert.equal(meta.lifecycle.updates.length, 1);
  assert.equal(meta.lifecycle.updates[0]?.sig_id, UP);
  // 原 Runbook 逐字不动
  assert.equal(await readFile(path.join(root, "skills", SIG, "SKILL.md"), "utf8"), BODY);
  // 更新层落 UPDATES.md
  const updatesMd = await readFile(path.join(root, "skills", SIG, "UPDATES.md"), "utf8");
  assert.ok(updatesMd.includes(UP) && updatesMd.includes(UPDATE_BODY));
});

test("loadDetail：正文 = 原 Runbook + 更新层附加（更新在后，不覆盖）", async () => {
  const r = await loadDetail(SIG, resolvePaths());
  assert.ok(r.ok);
  assert.ok(r.body.startsWith("## Why"), "原 Runbook 仍在前");
  assert.ok(r.body.includes("平台更新") && r.body.includes(UPDATE_BODY));
  assert.ok(r.body.indexOf("## Why") < r.body.indexOf("平台更新"));
});

test("sync：锚定已装技能的 update → updated=1 标 outdated；未命中锚点跳过不拉详情", async () => {
  const log: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    log.push(url);
    if (url.endsWith(`/topics/${TOPIC}/signals?limit=20`)) {
      return new Response(
        JSON.stringify({
          topic_id: "tp_1",
          next_cursor: null,
          tokens_saved_est: 0,
          signals: [
            {
              id: UP,
              kind: "update",
              topic: TOPIC,
              digest: `[adoption] 修订（anchor: ${SIG}）`,
              created_at: "2026-09-09T10:00:00.000Z",
            },
            {
              id: OTHER,
              kind: "update",
              topic: TOPIC,
              digest: `[adoption] 无主更新（anchor: ${OTHER}）`,
              created_at: "2026-09-09T10:01:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.startsWith(`https://fake.example/signals/${UP}`)) {
      return new Response(
        JSON.stringify({
          id: UP,
          kind: "update",
          topic: TOPIC,
          digest: `[adoption] 修订（anchor: ${SIG}）`,
          experience: { format: "markdown", body: UPDATE_BODY },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;

  const report = await syncSubscription({ topic: TOPIC }, opts({ fetchImpl }));
  assert.deepEqual(
    {
      scanned: report.scanned,
      updated: report.updated,
      skipped: report.skipped,
      installed: report.installed,
    },
    { scanned: 2, updated: 1, skipped: 1, installed: 0 },
  );
  assert.ok(!log.some((l) => l.includes(OTHER) && l.includes("signals/")), "未命中锚点不得拉详情");
  const { skills } = await scanSkills(resolvePaths());
  assert.equal(skills.find((s) => s.id === SIG)?.lifecycle.sync_state, "outdated");
});
