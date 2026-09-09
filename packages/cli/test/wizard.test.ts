/**
 * 向导与管理界面夹具测试（skill-engine 1.4 · node:test）。
 *
 *   · 单文件 HTML 产物：零外部请求 + 无 skills 字样（规范 §8 前两条）
 *   · wizard server：127.0.0.1 随机端口 + 真实 http 请求；状态机 A/B/C 三态齐备
 *   · 提交/接线/摘除全链路走临时目录夹具（AGENTSIGNAL_CONFIG + AGENTSIGNAL_HOME）
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import JSON5 from "json5";
import { defaultConfig, writeConfigAtomic } from "../src/skills/config.ts";
import { resolvePaths } from "../src/skills/paths.ts";
import { WIZARD_HTML } from "../src/skills/wizard/html.ts";
import { startWizard } from "../src/skills/wizard/server.ts";

let root = "";
let home = "";
const saved: Record<string, string | undefined> = {};

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "as-wizard-"));
  home = await mkdtemp(path.join(tmpdir(), "as-home-"));
  saved.AGENTSIGNAL_CONFIG = process.env.AGENTSIGNAL_CONFIG;
  saved.AGENTSIGNAL_HOME = process.env.AGENTSIGNAL_HOME;
  process.env.AGENTSIGNAL_CONFIG = root;
  process.env.AGENTSIGNAL_HOME = home;
});

after(async () => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  await rm(root, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

test("产物：单文件 HTML 零外部请求（无 http(s) 引用、无 @import url）", () => {
  assert.ok(WIZARD_HTML.includes('<div id="root"></div>'), "需含挂载点");
  assert.ok(WIZARD_HTML.includes("<script>"), "JS 必须内联");
  assert.ok(WIZARD_HTML.includes("<style>"), "CSS 必须内联");
  assert.equal(/src=["']https?:/.test(WIZARD_HTML), false, "禁止外链脚本/图片");
  assert.equal(/href=["']https?:/.test(WIZARD_HTML), false, "禁止外链样式/字体");
  assert.equal(/@import\s+url\(/.test(WIZARD_HTML), false, "禁止 @import url()");
  assert.equal(/fonts\.googleapis|cdn\./.test(WIZARD_HTML), false, "禁止 CDN/字体");
});

test("产物：用户可见文案无 skills 字样（允许工具名 search_skills 等）", () => {
  const visible = WIZARD_HTML.replaceAll(/search_skills|load_skill_detail|verify_skill/g, "");
  assert.equal(/\bskills\b/i.test(visible), false, "界面文案不得出现 skills");
});

async function withServer<T>(fn: (base: string) => Promise<T>): Promise<T> {
  const w = await startWizard({ open: false });
  try {
    return await fn(w.url.replace(/\/$/, ""));
  } finally {
    await w.close();
  }
}

test("server：GET / 返回单文件页面；/api/state 首次为向导态", async () => {
  await withServer(async (base) => {
    const page = await (await fetch(`${base}/`)).text();
    assert.match(page, /<div id="root"><\/div>/);
    const state = (await (await fetch(`${base}/api/state`)).json()) as {
      state: string;
      hosts: { id: string; detected: boolean }[];
      options: { domains: string[] };
    };
    assert.equal(state.state, "wizard");
    assert.equal(state.hosts.length, 5);
    assert.ok(state.options.domains.length >= 8);
  });
});

test("server：提交（--yes 等价 defaults）落 config + 接线已探测宿主", async () => {
  await mkdir(path.join(home, ".cursor"), { recursive: true });
  await writeFile(path.join(home, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: {} }));
  await withServer(async (base) => {
    const res = (await (
      await fetch(`${base}/api/submit`, {
        method: "POST",
        body: JSON.stringify({ defaults: true }),
      })
    ).json()) as { ok: boolean; written: { host: string; path: string }[] };
    assert.equal(res.ok, true);
    assert.ok(res.written.length >= 1, "已探测宿主应被接线");
    const cfg = JSON5.parse(await readFile(resolvePaths(root).configFile, "utf8"));
    assert.deepEqual(
      cfg.layers.map((l: { id: string }) => l.id),
      ["base", "domain", "task", "session"],
    );
    const cursor = JSON.parse(await readFile(path.join(home, ".cursor", "mcp.json"), "utf8"));
    assert.deepEqual(cursor.mcpServers.agentsignal, { command: "agentsignal", args: ["mcp"] });
  });
});

test("server：有 config → 管理态；路由图改接线（/api/wire）可摘除", async () => {
  await withServer(async (base) => {
    const state = (await (await fetch(`${base}/api/state`)).json()) as {
      state: string;
      hosts: { host: string; mcp: string }[];
    };
    assert.equal(state.state, "manage");
    const cursorRow = state.hosts.find((h) => h.host === "cursor");
    assert.equal(cursorRow?.mcp, "wired");

    const res = (await (
      await fetch(`${base}/api/wire`, { method: "POST", body: JSON.stringify({ hosts: [] }) })
    ).json()) as { ok: boolean };
    assert.equal(res.ok, true);
    const after = (await (await fetch(`${base}/api/state`)).json()) as {
      hosts: { host: string; mcp: string }[];
    };
    assert.equal(after.hosts.find((h) => h.host === "cursor")?.mcp, "absent");
  });
});

test("server：config 损坏 → corrupt 态；autofix/reinit 可恢复", async () => {
  await writeFile(resolvePaths(root).configFile, "{ layers: [", "utf8");
  await withServer(async (base) => {
    const state = (await (await fetch(`${base}/api/state`)).json()) as {
      state: string;
      corrupt?: string;
    };
    assert.equal(state.state, "corrupt");
    assert.ok(state.corrupt?.includes("无法解析"));
    const reinit = (await (await fetch(`${base}/api/reinit`, { method: "POST" })).json()) as {
      ok: boolean;
    };
    assert.equal(reinit.ok, true);
    const fresh = (await (await fetch(`${base}/api/state`)).json()) as { state: string };
    assert.equal(fresh.state, "wizard");
  });
});

test("server：/api/uninstall 全量摘除且保留数据目录", async () => {
  await writeConfigAtomic(defaultConfig(), resolvePaths(root));
  await withServer(async (base) => {
    const res = (await (await fetch(`${base}/api/uninstall`, { method: "POST" })).json()) as {
      ok: boolean;
      dataKept: string;
    };
    assert.equal(res.ok, true);
    assert.equal(res.dataKept, root);
  });
});

/* ── P2.3 订阅 / 同步 / 经验库端点（dynamic-skill-management）───────────────── */

test("订阅区端点：state 带 sync/library · 增删订阅 · 同步回环平台落库 · 库移除", async () => {
  const SIG = "sig_01wizardsync0000000000000000";
  const platform = createServer((req, res) => {
    const u = req.url ?? "";
    if (u.startsWith(`/topics/ai-research/signals`)) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          topic_id: "tp_1",
          signals: [
            {
              id: SIG,
              kind: "solution",
              topic: "ai-research",
              digest: "向导同步端到端 | scope: e2e | validation: self-tested",
              created_at: "2026-09-09T00:00:00.000Z",
            },
          ],
          next_cursor: null,
          tokens_saved_est: 0,
        }),
      );
      return;
    }
    if (u.startsWith(`/signals/${SIG}`)) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: SIG,
          kind: "solution",
          topic: "ai-research",
          digest: "向导同步端到端 | scope: e2e | validation: self-tested",
          created_at: "2026-09-09T00:00:00.000Z",
          experience: {
            format: "markdown",
            body: "## Why\nw\n\n## What worked\n1. s\n\n## Evidence\ne\n\n## Caveats\nc\n",
          },
        }),
      );
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });
  await new Promise<void>((r) => platform.listen(0, "127.0.0.1", r));
  const platformBase = `http://127.0.0.1:${(platform.address() as AddressInfo).port}`;
  const savedBase = process.env.AGENTSIGNAL_BASE;
  process.env.AGENTSIGNAL_BASE = platformBase;
  await writeConfigAtomic(defaultConfig());
  try {
    await withServer(async (base) => {
      // state：manage 态带 sync + library
      const state = (await (await fetch(`${base}/api/state`)).json()) as {
        state: string;
        library: { id: string; status: string }[];
        sync: { subscriptions: { topic: string }[]; max_skills: number; base_url: string | null };
      };
      assert.equal(state.state, "manage");
      assert.ok(Array.isArray(state.library));
      assert.equal(state.sync.max_skills, 200);
      assert.equal(state.sync.base_url, platformBase, "env 优先读平台站点");

      // 添加订阅（重复添加 400）
      const post = async (path: string, body: unknown) =>
        await (
          await fetch(`${base}${path}`, { method: "POST", body: JSON.stringify(body) })
        ).json();
      assert.equal(
        ((await post("/api/subscriptions/add", { topic: "ai-research" })) as { ok: boolean }).ok,
        true,
      );
      const dup = (await post("/api/subscriptions/add", { topic: "ai-research" })) as {
        ok: boolean;
      };
      assert.equal(dup.ok, false);

      // 同步：回环平台 → 落库 → 游标持久化
      const syncRes = (await post("/api/sync", { topic: "ai-research" })) as {
        ok: boolean;
        report?: { installed: number; cursor: string | null };
      };
      assert.equal(syncRes.ok, true);
      assert.equal(syncRes.report?.installed, 1);

      // state.library 出现 active 条目（带平台来源）
      const state2 = (await (await fetch(`${base}/api/state`)).json()) as {
        library: { id: string; status: string; source: { topic: string | null } | null }[];
        sync: { subscriptions: { topic: string; cursor?: string }[] };
      };
      const item = state2.library.find((l) => l.id === SIG);
      assert.ok(item, "同步后经验应出现在库列表");
      assert.equal(item.status, "active");
      assert.equal(item.source?.topic, "ai-research");
      assert.equal(state2.sync.subscriptions[0]?.cursor, SIG, "游标持久化");

      // 库移除（物理删）+ 订阅移除
      assert.equal(((await post("/api/library/delete", { id: SIG })) as { ok: boolean }).ok, true);
      const miss = (await post("/api/library/delete", { id: SIG })) as { ok: boolean };
      assert.equal(miss.ok, false);
      assert.equal(
        ((await post("/api/subscriptions/remove", { topic: "ai-research" })) as { ok: boolean }).ok,
        true,
      );
      const state3 = (await (await fetch(`${base}/api/state`)).json()) as {
        library: { id: string }[];
        sync: { subscriptions: { topic: string }[] };
      };
      assert.ok(!state3.library.some((l) => l.id === SIG), "移除后库中不得残留");
      assert.equal(state3.sync.subscriptions.length, 0);
    });
  } finally {
    if (savedBase === undefined) delete process.env.AGENTSIGNAL_BASE;
    else process.env.AGENTSIGNAL_BASE = savedBase;
    platform.close();
  }
});

/* ── P3.4 库列表三态：state.library.status 反映真实 sync_state ─────────────── */

test("库状态三态：outdated / revoked 经 sync_state 上抛（着色数据源）", async () => {
  const { installSignal } = await import("../src/skills/install.ts");
  const { applySignalUpdate, markRevoked } = await import("../src/skills/lifecycle.ts");
  await writeConfigAtomic(defaultConfig());
  const SIGC = "sig_01statemachinetest000000000";
  await installSignal(
    {
      id: SIGC,
      topic: "ai-research",
      kind: "solution",
      digest: "状态机测试 | scope: e2e | validation: none",
      created_at: "2026-09-09T12:00:00.000Z",
      experience: {
        format: "markdown",
        body: "## Why\nw\n\n## What worked\n1. s\n\n## Evidence\ne\n\n## Caveats\nc\n",
      },
    },
    { base_url: "https://fake.example", synced_at: "2026-09-09T12:00:00.000Z" },
  );

  await withServer(async (base) => {
    const lib = async () =>
      (
        (await (await fetch(`${base}/api/state`)).json()) as {
          library: { id: string; status: string }[];
        }
      ).library;
    assert.equal((await lib()).find((l) => l.id === SIGC)?.status, "active");

    await applySignalUpdate(SIGC, {
      sig_id: "sig_01stateupdate00000000000000",
      digest: `[adoption] 修订（anchor: ${SIGC}）`,
      synced_at: "2026-09-09T12:01:00.000Z",
      body: "补充",
    });
    assert.equal((await lib()).find((l) => l.id === SIGC)?.status, "outdated");

    await markRevoked(SIGC);
    assert.equal((await lib()).find((l) => l.id === SIGC)?.status, "revoked");
  });
});
