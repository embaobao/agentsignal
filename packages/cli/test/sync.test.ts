/**
 * P2.1 订阅同步器单测（dynamic-skill-management · node:test 单口径）。
 *
 * 覆盖（tasks.md 2.1）：游标分页两页拉全 · kind=solution 过滤（update 不拉详情）·
 * transcode 落库 + 同 id 幂等 · 游标持久化进 config.subscriptions（原子写）·
 * 429 按 retry_after 退避重试同页（sleepImpl 注入零真实等待）· done=next_cursor null。
 * 全程 fake fetch，零外部服务零数据库。
 */
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { defaultConfig, loadConfig, writeConfigAtomic } from "../src/skills/config.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { scanSkills } from "../src/skills/store.ts";
import { type SyncOptions, syncSubscription } from "../src/skills/sync.ts";

const TOPIC = "ai-research";
const BASE = "https://fake.example";

interface Route {
  url: (base: string) => string;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function envelope(id: string, kind: string, digest: string) {
  return {
    id,
    kind,
    topic: TOPIC,
    topic_id: "tp_1",
    digest,
    created_at: "2026-09-01T00:00:00.000Z",
  };
}

const A = "sig_01aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "sig_01bbbbbbbbbbbbbbbbbbbbbbbb";
const C = "sig_01cccccccccccccccccccccccc";
const D = "sig_01dddddddddddddddddddddddd";

const bodyOf = (tag: string) =>
  `## Why\nw-${tag}\n\n## What worked\n1. s-${tag}\n\n## Evidence\ne\n\n## Caveats\nc\n`;

function pageFs(signals: unknown[], nextCursor: string | null) {
  return { topic_id: "tp_1", signals, next_cursor: nextCursor, tokens_saved_est: 0 };
}

let root = "";
const sleeps: number[] = [];

function makeFetch(routes: Route[], log: string[] = []): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    log.push(`${init?.method ?? "GET"} ${url.replace(BASE, "")}`);
    for (const r of routes) {
      if (url === r.url(BASE)) {
        return new Response(JSON.stringify(r.body ?? {}), {
          status: r.status,
          headers: { "content-type": "application/json", ...(r.headers ?? {}) },
        });
      }
    }
    return new Response(JSON.stringify({ error: { code: "not_found" } }), { status: 404 });
  }) as typeof fetch;
}

async function writeConfigWithSub(cursor?: string) {
  const cfg = defaultConfig();
  cfg.sync.subscriptions = [
    { topic: TOPIC, min_validation: "none", ...(cursor ? { cursor } : {}) },
  ];
  await writeConfigAtomic(cfg);
}

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-sync-"));
  process.env.AGENTSIGNAL_CONFIG = root;
});
after(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

function opts(extra: Partial<SyncOptions> = {}): SyncOptions {
  return {
    baseUrl: BASE,
    paths: resolvePaths(),
    sleepImpl: async (ms) => {
      sleeps.push(ms);
    },
    ...extra,
  };
}

test("两页拉全：solution 落库、update 跳过不拉详情、游标持久化、done 收口", async () => {
  await writeConfigWithSub();
  const log: string[] = [];
  const routes: Route[] = [
    {
      url: (b) => `${b}/topics/${TOPIC}/signals?limit=20`,
      status: 200,
      body: pageFs(
        [
          envelope(A, "solution", "方案 A | scope: web | validation: self-tested"),
          envelope(B, "update", "[adoption] 复现成功（anchor: sig_x）"),
          envelope(C, "solution", "方案 C | scope: rag | validation: none"),
        ],
        C,
      ),
    },
    {
      url: (b) => `${b}/topics/${TOPIC}/signals?limit=20&cursor=${C}`,
      status: 200,
      body: pageFs(
        [envelope(D, "solution", "方案 D | scope: web | validation: battle-tested")],
        null,
      ),
    },
    {
      url: (b) => `${b}/signals/${A}?include=experience`,
      status: 200,
      body: {
        ...envelope(A, "solution", "方案 A | scope: web | validation: self-tested"),
        experience: { format: "markdown", body: bodyOf("A") },
      },
    },
    {
      url: (b) => `${b}/signals/${C}?include=experience`,
      status: 200,
      body: {
        ...envelope(C, "solution", "方案 C | scope: rag | validation: none"),
        experience: { format: "markdown", body: bodyOf("C") },
      },
    },
    {
      url: (b) => `${b}/signals/${D}?include=experience`,
      status: 200,
      body: {
        ...envelope(D, "solution", "方案 D | scope: web | validation: battle-tested"),
        experience: { format: "markdown", body: bodyOf("D") },
      },
    },
  ];
  const report = await syncSubscription(
    { topic: TOPIC },
    opts({ fetchImpl: makeFetch(routes, log) }),
  );

  assert.deepEqual(
    {
      scanned: report.scanned,
      installed: report.installed,
      skipped: report.skipped,
      done: report.done,
    },
    { scanned: 4, installed: 3, skipped: 1, done: true },
  );
  assert.equal(report.cursor, D, "游标应推进到本页最后一条");
  assert.ok(!log.some((l) => l.includes(`/signals/${B}?`)), "update 信号不得拉详情");

  // 游标持久化进 config.subscriptions（tmp+rename 由 config 加载器保证）
  const loaded = await loadConfig();
  assert.equal(loaded?.config.sync.subscriptions[0]?.cursor, D);
  // 落库可扫描
  const { skills } = await scanSkills();
  assert.deepEqual(skills.map((s) => s.id).sort(), [A, C, D].sort());
});

test("同游标重放幂等：库内不重复、游标不动", async () => {
  await writeConfigWithSub(D);
  const routes: Route[] = [
    {
      url: (b) => `${b}/topics/${TOPIC}/signals?limit=20&cursor=${D}`,
      status: 200,
      body: pageFs(
        [envelope(D, "solution", "方案 D | scope: web | validation: battle-tested")],
        null,
      ),
    },
    {
      url: (b) => `${b}/signals/${D}?include=experience`,
      status: 200,
      body: {
        ...envelope(D, "solution", "方案 D | scope: web | validation: battle-tested"),
        experience: { format: "markdown", body: bodyOf("D-2") },
      },
    },
  ];
  const report = await syncSubscription({ topic: TOPIC }, opts({ fetchImpl: makeFetch(routes) }));
  assert.equal(report.installed, 1, "重放同 id 幂等 upsert");
  const { skills } = await scanSkills();
  assert.equal(skills.filter((s) => s.id === D).length, 1);
  const dirs = await readdir(path.join(root, "skills"));
  assert.equal(dirs.filter((d) => d === D).length, 1);
});

test("429 退避：按 retry_after 重试同页后成功，零真实 sleep", async () => {
  await writeConfigWithSub();
  sleeps.length = 0;
  const listUrl = `${BASE}/topics/${TOPIC}/signals?limit=20`;
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === listUrl) {
      if (calls.filter((c) => c === listUrl).length === 1) {
        return new Response(JSON.stringify({ error: { code: "rate_limited", retry_after: 2 } }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "2" },
        });
      }
      return new Response(JSON.stringify(pageFs([], null)), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;

  const report = await syncSubscription({ topic: TOPIC }, opts({ fetchImpl }));
  assert.deepEqual(sleeps, [2000], "按 retry_after 秒退避");
  assert.equal(calls.filter((c) => c === listUrl).length, 2, "同页重试一次");
  assert.equal(report.done, true);
});

test("min_validation 阈值：低于阈值不拉详情", async () => {
  await writeConfigWithSub();
  const log: string[] = [];
  const routes: Route[] = [
    {
      url: (b) => `${b}/topics/${TOPIC}/signals?limit=20`,
      status: 200,
      body: pageFs(
        [
          envelope(A, "solution", "方案 A | scope: web | validation: self-tested"),
          envelope(C, "solution", "方案 C | scope: rag | validation: none"),
        ],
        null,
      ),
    },
    {
      url: (b) => `${b}/signals/${A}?include=experience`,
      status: 200,
      body: {
        ...envelope(A, "solution", "方案 A | scope: web | validation: self-tested"),
        experience: { format: "markdown", body: bodyOf("A") },
      },
    },
  ];
  const report = await syncSubscription(
    { topic: TOPIC, min_validation: "self-tested" },
    opts({ fetchImpl: makeFetch(routes, log) }),
  );
  assert.equal(report.installed, 1);
  assert.equal(report.skipped, 1, "none 低于 self-tested 阈值应跳过");
  assert.ok(!log.some((l) => l.includes(`/signals/${C}?`)), "低于阈值不得拉详情");
});

test("config 缺失：结构化报错 CONFIG_MISSING", async () => {
  // 指向一个空目录（无 config.json5）
  const emptyRoot = await mkdtemp(path.join(tmpdir(), "as-sync-empty-"));
  const saved = process.env.AGENTSIGNAL_CONFIG;
  process.env.AGENTSIGNAL_CONFIG = emptyRoot;
  try {
    await assert.rejects(
      () => syncSubscription({ topic: TOPIC }, opts({ fetchImpl: makeFetch([]) })),
      (err: unknown) => (err as { code?: string }).code === "CONFIG_MISSING",
    );
  } finally {
    process.env.AGENTSIGNAL_CONFIG = saved ?? undefined;
    await rm(emptyRoot, { recursive: true, force: true });
  }
});
