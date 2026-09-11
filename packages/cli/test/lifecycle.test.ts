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
import { applySignalUpdate, markRevoked } from "../src/skills/lifecycle.ts";
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
  // 原 Runbook 逐字不动（P0.3 产物格式：首部产物 frontmatter + 正文）
  const md = await readFile(path.join(root, "skills", SIG, "SKILL.md"), "utf8");
  assert.ok(md.startsWith(`---\nname: "${SIG}"\ndescription: `), "产物首部 name=目录名");
  assert.ok(md.endsWith(BODY), "正文逐字保留在首部之后");
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

/* ── P3.2 失效降权（404/hidden → revoked：降权置灰不物理删）──────────────── */

/** 独立 root：库/游标状态隔离（防同文件用例间污染与死循环重放） */
async function freshRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "as-lc-iso-"));
  process.env.AGENTSIGNAL_CONFIG = dir;
  return dir;
}

test("markRevoked：标 revoked 但文件保留（不物理删）", async () => {
  const iso = await freshRoot();
  try {
    await installSignal(solution(), CTX);
    const ok = await applySignalUpdate(
      SIG,
      {
        sig_id: UP,
        digest: `[adoption] 修订（anchor: ${SIG}）`,
        synced_at: CTX.synced_at,
        body: UPDATE_BODY,
      },
      resolvePaths(),
    );
    assert.equal(ok, true);
    assert.equal(await markRevoked(SIG, resolvePaths()), true);
    const meta = JSON5.parse(
      await readFile(path.join(iso, "skills", SIG, "skill.json5"), "utf8"),
    ) as {
      lifecycle: { sync_state: string };
    };
    assert.equal(meta.lifecycle.sync_state, "revoked");
    // 不物理删（P0.3 产物格式：首部产物 frontmatter + 正文）
    const md = await readFile(path.join(iso, "skills", SIG, "SKILL.md"), "utf8");
    assert.ok(md.startsWith(`---\nname: "${SIG}"\ndescription: `));
    assert.ok(md.endsWith(BODY));
    assert.ok((await readFile(path.join(iso, "skills", SIG, "UPDATES.md"), "utf8")).length > 0);
    assert.equal(await markRevoked("sig_01notinstalled000000000000", resolvePaths()), false);
  } finally {
    await rm(iso, { recursive: true, force: true });
  }
});

test("sync：列表内 solution 详情 404 且已装 → 标 revoked（report.revoked），未装仅跳过", async () => {
  const iso = await freshRoot();
  try {
    await writeConfigAtomic(defaultConfig());
    const HIDDEN = "sig_01lifecyclehidden0000000000";
    await installSignal(
      { ...solution(), id: HIDDEN, digest: "将被隐藏的方案 | scope: web | validation: none" },
      CTX,
    );
    const NEW = "sig_01lifecyclenew00000000000000";
    const fetchImpl = (async (input: string | URL) => {
      const url = String(input);
      if (url === `https://fake.example/topics/${TOPIC}/signals?limit=20`) {
        return new Response(
          JSON.stringify({
            topic_id: "tp_1",
            next_cursor: null,
            tokens_saved_est: 0,
            signals: [
              {
                id: HIDDEN,
                kind: "solution",
                topic: TOPIC,
                digest: "将被隐藏的方案 | scope: web | validation: none",
                created_at: "2026-09-09T11:00:00.000Z",
              },
              {
                id: NEW,
                kind: "solution",
                topic: TOPIC,
                digest: "新方案 | scope: web | validation: none",
                created_at: "2026-09-09T11:01:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.startsWith(`https://fake.example/signals/${HIDDEN}`)) {
        return new Response("{}", { status: 404 }); // 已 hidden
      }
      if (url.startsWith(`https://fake.example/signals/${NEW}`)) {
        return new Response(
          JSON.stringify({
            id: NEW,
            kind: "solution",
            topic: TOPIC,
            digest: "新方案 | scope: web | validation: none",
            experience: { format: "markdown", body: BODY },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const report = await syncSubscription({ topic: TOPIC }, opts({ fetchImpl }));
    assert.equal(report.revoked, 1, "已装信号详情 404 应计 revoked");
    assert.equal(report.installed, 1);
    const { skills } = await scanSkills(resolvePaths());
    assert.equal(skills.find((s) => s.id === HIDDEN)?.lifecycle.sync_state, "revoked");
    // 不物理删
    await readFile(path.join(iso, "skills", HIDDEN, "SKILL.md"), "utf8");
  } finally {
    await rm(iso, { recursive: true, force: true });
  }
});

test("检索降权：revoked 沉底但仍出现在结果中（置灰不隐藏）", async () => {
  const iso = await freshRoot();
  try {
    const A = "sig_01revokedemoted00000000000";
    const B = "sig_01revokenormal000000000000";
    await installSignal(
      { ...solution(), id: A, digest: "登录认证方案 A | scope: web | validation: none" },
      CTX,
    );
    await installSignal(
      { ...solution(), id: B, digest: "登录认证方案 B | scope: web | validation: none" },
      CTX,
    );
    assert.equal(await markRevoked(A, resolvePaths()), true);
    await writeConfigAtomic(defaultConfig()); // createEngine 需要引擎 config
    const { createEngine } = await import("../src/skills/engine.ts");
    const engine = await createEngine(iso);
    const hits = await engine.search({ query: "登录认证", domain: "common", limit: 10 });
    const ids = hits.map((h) => h.id);
    assert.ok(ids.includes(A) && ids.includes(B), `两者都应在结果中：${JSON.stringify(ids)}`);
    assert.ok(ids.indexOf(B) < ids.indexOf(A), `revoked 应沉底：${JSON.stringify(ids)}`);
  } finally {
    await rm(iso, { recursive: true, force: true });
  }
});

/* ── P3.3 容量治理（超限仅告警 · LRU 候选 · 确认后手动清理，不自动删）──────── */

test("capacityReport：候选 = 未验证按 use_count 升序；超限判定读 config.sync.max_skills", async () => {
  const iso = await freshRoot();
  try {
    await writeConfigAtomic(defaultConfig()); // max_skills 默认 200
    const { verifySkill } = await import("../src/skills/verify.ts");
    const C1 = "sig_01capacitynocheck0000000001";
    const C2 = "sig_01capacitynocheck0000000002";
    const V = "sig_01capacityverified000000000";
    await installSignal(
      { ...solution(), id: C1, digest: "容量候选一 | scope: web | validation: none" },
      CTX,
    );
    await installSignal(
      { ...solution(), id: C2, digest: "容量候选二 | scope: web | validation: none" },
      CTX,
    );
    await installSignal(
      { ...solution(), id: V, digest: "已验证方案 | scope: web | validation: none" },
      CTX,
    );
    await verifySkill(V, "worked", resolvePaths());

    const { capacityReport } = await import("../src/skills/lifecycle.ts");
    const rep = await capacityReport(resolvePaths());
    assert.equal(rep.count, 3);
    assert.equal(rep.max, 200);
    assert.equal(rep.over, false);
    assert.deepEqual(
      rep.candidates.map((c) => c.id).sort(),
      [C1, C2].sort(),
      "候选 = 未验证技能（已验证的 V 不入候选）",
    );

    // 超限：max_skills=2
    const cfg = defaultConfig();
    cfg.sync.max_skills = 2;
    await writeConfigAtomic(cfg);
    const rep2 = await capacityReport(resolvePaths());
    assert.equal(rep2.over, true);
  } finally {
    await rm(iso, { recursive: true, force: true });
  }
});

test("status：超限输出容量告警行（fail-soft，退出码 0）", async () => {
  const iso = await freshRoot();
  try {
    await writeConfigAtomic(defaultConfig());
    await installSignal(
      { ...solution(), id: SIG, digest: "容量告警方案 | scope: web | validation: none" },
      CTX,
    );
    const cfg = defaultConfig();
    cfg.sync.max_skills = 1; // 已装 1 条 + 将装 1 条 → 必超限
    await writeConfigAtomic(cfg);
    await installSignal(
      { ...solution(), id: UP, digest: "第二条方案 | scope: web | validation: none" },
      CTX,
    );
    const { spawnSync } = await import("node:child_process");
    const CLI = path.resolve(import.meta.dirname, "../src/index.ts");
    const r = spawnSync(process.execPath, [CLI, "status"], {
      env: {
        ...process.env,
        AGENTSIGNAL_CONFIG: iso,
        AGENTSIGNAL_HOME: iso,
        AGENTSIGNAL_BASE: "http://localhost:9",
        CI: "1",
      },
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(`${r.stdout}${r.stderr}`, /容量告警：2\/1 超限/);
    assert.match(`${r.stdout}${r.stderr}`, /不自动删/);
  } finally {
    await rm(iso, { recursive: true, force: true });
  }
});

/* ── 4.2a 回归：真实平台 id 含大写 ULID ───────────────────────────────────── */

test("真实平台 id（大写 ULID）：小写目录落库 · provenance 保留原大小写 · 原始 id 可 verify/revoked", async () => {
  const iso = await freshRoot();
  try {
    const UPPER = "sig_01M23WMYSA2ZZY93YJAY0MB2MM"; // 4.2a 实测的真实形态
    await installSignal({ ...solution(), id: UPPER }, CTX);
    const { skills } = await scanSkills(resolvePaths());
    const s = skills.find((x) => x.id === UPPER.toLowerCase());
    assert.ok(s, "落库目录/记录应为小写 id");
    assert.equal(
      s.lifecycle.provenance?.sig_id,
      UPPER,
      "provenance 保留原始大小写（回流回传依据）",
    );
    const { verifySkill } = await import("../src/skills/verify.ts");
    assert.equal((await verifySkill(UPPER, "worked", resolvePaths())).id, UPPER.toLowerCase());
    assert.equal(await markRevoked(UPPER, resolvePaths()), true);
  } finally {
    await rm(iso, { recursive: true, force: true });
  }
});
