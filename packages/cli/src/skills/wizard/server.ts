/**
 * 本地 Web 管理/向导服务（skills/wizard/server.ts）。
 *
 * 契约（skill-engine design §4.9.6）：
 *   GET  /            → 单文件 HTML（零外部请求，由 build.mjs 产物内联）
 *   GET  /api/state   → { state: wizard|manage|corrupt, hosts, config, stats, metrics, corrupt? }
 *   POST /api/submit  → { ok: true, written: [{host, path}] } | { ok: false, reason }
 *   POST /api/repair  → 重写 ✗/⚠ 宿主配置
 *   POST /api/uninstall → 全量摘除（数据保留）
 *   POST /api/autofix → 尝试修复损坏 config
 *   POST /api/reinit  → 备份后回到状态 A
 *
 * 生命周期：只绑 127.0.0.1 随机端口；提交/卸载完成即关服（页面静态可浏览）。
 */

import { spawn } from "node:child_process";
import { readFile, rename, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { EngineConfig } from "@agentssignal/protocol";
import {
  CONFIG_INVALID,
  ConfigError,
  defaultConfig,
  ensureLayout,
  loadConfig,
  writeConfigAtomic,
} from "../config.ts";
import { deleteSkill } from "../install.ts";
import { readMetrics } from "../metrics.ts";
import { readPlatformCredentials } from "../mirror.ts";
import { type AgentSignalPaths, resolvePaths } from "../paths.ts";
import { scanSkills } from "../store.ts";
import { syncSubscription } from "../sync.ts";
import { detectHosts, type HostId, hostById, hostDefs } from "../wiring/hosts.ts";
import { hostStatus, unwireMcp, type WireResult, wireMcp } from "../wiring/snippets.ts";
import { uninstallAll } from "../wiring/uninstall.ts";
import { WIZARD_HTML } from "./html.ts";

export interface WizardOutcome {
  action: "submit" | "uninstall" | "closed";
  written?: { host: string; path: string }[];
}

export interface StartWizardOptions {
  rootOverride?: string;
  /** 非 TTY/CI 场景不拉浏览器 */
  open?: boolean;
  /** 页面上的业务域/栈规则可选项（由 CLI 传入，保持单一真源） */
  domainOptions?: string[];
  stackOptions?: StackOption[];
}

export interface StackOption {
  id: string;
  name: string;
  /** 匹配条件：组内全部命中才算该栈启用 */
  match: { file: string; exists?: boolean; contains?: string }[];
}

export const DEFAULT_DOMAINS = [
  "化工",
  "金融",
  "前端",
  "后端",
  "DevOps",
  "数据分析",
  "技术写作",
  "电商运营",
];

/** MVP 内置栈规则（裁决 10：只内置 Next.js + TypeScript；其余按需勾选） */
export const STACK_OPTIONS: StackOption[] = [
  {
    id: "nextjs",
    name: "Next.js",
    match: [{ file: "package.json", contains: "next" }],
  },
  {
    id: "typescript",
    name: "TypeScript",
    match: [{ file: "tsconfig.json", exists: true }],
  },
  { id: "react", name: "React", match: [{ file: "package.json", contains: "react" }] },
  { id: "vue", name: "Vue", match: [{ file: "package.json", contains: "vue" }] },
  { id: "python", name: "Python", match: [{ file: "pyproject.toml", exists: true }] },
  { id: "go", name: "Go", match: [{ file: "go.mod", exists: true }] },
  { id: "rust", name: "Rust", match: [{ file: "Cargo.toml", exists: true }] },
];

function json(res: ServerResponse, body: unknown, status = 200): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(cmd, [url], { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* 无浏览器环境静默降级，URL 由 CLI 打印 */
    });
    child.unref();
  } catch {
    /* 忽略 */
  }
}

function configFromForm(body: Record<string, unknown>, stackOptions: StackOption[]): EngineConfig {
  const domains = Array.isArray(body.domains) ? (body.domains as string[]).filter(Boolean) : [];
  const stacks = Array.isArray(body.stacks) ? (body.stacks as string[]).filter(Boolean) : [];
  const base = defaultConfig();
  const domainLayer = base.layers.find((l) => l.id === "domain");
  if (domainLayer) {
    domainLayer.stack_rules = stackOptions
      .filter((s) => stacks.includes(s.id))
      .map((s) => ({ name: s.name, match: s.match }));
  }
  base.domains = {
    current: domains[0] ?? "common",
    available: ["common", ...domains.filter((d) => d !== "common")],
  };
  base.hosts = Array.isArray(body.hosts)
    ? (body.hosts as string[]).map((h) => ({ host: h as never, wired: true }))
    : [];
  return base;
}

export async function startWizard(
  options: StartWizardOptions = {},
): Promise<{ url: string; wait: Promise<WizardOutcome>; close: () => Promise<void> }> {
  const paths = resolvePaths(options.rootOverride);
  let resolveWait: (v: WizardOutcome) => void = () => {};
  const wait = new Promise<WizardOutcome>((r) => {
    resolveWait = r;
  });

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1`);
      try {
        if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(WIZARD_HTML);
          return;
        }
        if (req.method === "GET" && url.pathname === "/api/state") {
          json(res, await buildState(paths));
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/submit") {
          const body = await readBody(req);
          const config = body.defaults
            ? defaultConfig()
            : configFromForm(body, options.stackOptions ?? STACK_OPTIONS);
          await ensureLayout(paths);
          await writeConfigAtomic(config, paths);
          const hosts = body.defaults
            ? detectHosts()
                .filter((h) => h.detected)
                .map((h) => h.id)
            : ((body.hosts as HostId[]) ?? []);
          const written: { host: string; path: string }[] = [];
          const failed: { host: string; reason: string }[] = [];
          for (const id of hosts) {
            try {
              const r = await wireMcp(hostById(id));
              written.push({ host: r.name, path: r.path });
            } catch (err) {
              failed.push({
                host: id,
                reason: err instanceof Error ? err.message : String(err),
              });
            }
          }
          if (failed.length > 0) {
            json(res, {
              ok: false,
              reason: failed.map((f) => `${f.host}：${f.reason}`).join("；"),
            });
            return;
          }
          json(res, { ok: true, written });
          resolveWait({ action: "submit", written });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/repair") {
          const results: WireResult[] = [];
          const failed: { host: string; reason: string }[] = [];
          for (const host of hostDefs()) {
            const st = await hostStatus(host);
            if (st.mcp === "wired") continue;
            try {
              results.push(await wireMcp(host));
            } catch (err) {
              failed.push({
                host: host.name,
                reason: err instanceof Error ? err.message : String(err),
              });
            }
          }
          json(res, { ok: failed.length === 0, fixed: results.map((r) => r.name), failed });
          return;
        }
        // 路由图可视化改配置：勾选的宿主接线，未勾选的摘除（config 仍是唯一真源）
        if (req.method === "POST" && url.pathname === "/api/wire") {
          const body = await readBody(req);
          const selected = new Set<string>((body.hosts as string[]) ?? []);
          const written: { host: string; path: string }[] = [];
          const failed: { host: string; reason: string }[] = [];
          for (const host of hostDefs()) {
            try {
              if (selected.has(host.id)) {
                const r = await wireMcp(host);
                written.push({ host: r.name, path: r.path });
              } else {
                await unwireMcp(host);
              }
            } catch (err) {
              failed.push({
                host: host.name,
                reason: err instanceof Error ? err.message : String(err),
              });
            }
          }
          json(res, { ok: failed.length === 0, written, failed });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/uninstall") {
          const report = await uninstallAll(paths.root);
          json(res, {
            ok: report.failed.length === 0,
            removed: report.removed,
            failed: report.failed,
            dataKept: report.dataKept,
          });
          resolveWait({ action: "uninstall" });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/autofix") {
          const raw = await readFile(paths.configFile, "utf8");
          // 兜底修复：截去最后一个顶层花括号之后的内容（常见半截写入）
          const cut = raw.lastIndexOf("}");
          if (cut > 0) {
            await rename(paths.configFile, `${paths.configFile}.bak-${Date.now()}`);
            const { writeFile } = await import("node:fs/promises");
            await writeFile(paths.configFile, raw.slice(0, cut + 1), "utf8");
            json(res, { ok: true });
            return;
          }
          json(res, { ok: false, reason: "无法定位可修复片段，建议重新初始化" });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/reinit") {
          try {
            await rename(paths.configFile, `${paths.configFile}.bak-${Date.now()}`);
          } catch {
            /* 文件可能已不存在 */
          }
          json(res, { ok: true });
          return;
        }
        /* ── dynamic-skill-management P2.3：订阅 / 同步 / 经验库 ── */
        if (req.method === "POST" && url.pathname === "/api/subscriptions/add") {
          const body = await readBody(req);
          const topic = String(body.topic ?? "").trim();
          if (!topic) {
            json(res, { ok: false, reason: "分区名不能为空" }, 400);
            return;
          }
          const loaded = await loadConfig(paths);
          if (!loaded) {
            json(res, { ok: false, reason: "配置不存在，请先初始化" }, 400);
            return;
          }
          if (loaded.config.sync.subscriptions.some((s) => s.topic === topic)) {
            json(res, { ok: false, reason: "该订阅已存在" }, 400);
            return;
          }
          const mv = String(body.min_validation ?? "none");
          loaded.config.sync.subscriptions.push({
            topic,
            min_validation: mv === "self-tested" || mv === "battle-tested" ? mv : "none",
          });
          await writeConfigAtomic(loaded.config, paths);
          json(res, { ok: true });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/subscriptions/remove") {
          const body = await readBody(req);
          const topic = String(body.topic ?? "").trim();
          const loaded = await loadConfig(paths);
          if (!loaded) {
            json(res, { ok: false, reason: "配置不存在" }, 400);
            return;
          }
          loaded.config.sync.subscriptions = loaded.config.sync.subscriptions.filter(
            (s) => s.topic !== topic,
          );
          await writeConfigAtomic(loaded.config, paths);
          json(res, { ok: true });
          return;
        }
        // 按需 pull 一次（无常驻进程）；进度以结果报告一次性回报
        if (req.method === "POST" && url.pathname === "/api/sync") {
          const body = await readBody(req);
          const topic = String(body.topic ?? "").trim();
          const loaded = await loadConfig(paths);
          const entry = loaded?.config.sync.subscriptions.find((s) => s.topic === topic);
          if (!entry) {
            json(res, { ok: false, reason: "订阅不存在" }, 404);
            return;
          }
          const { base: base_url } = await readPlatformCredentials();
          if (!base_url) {
            json(res, {
              ok: false,
              reason: "未配置来源站点：先在本机设置 AGENTSIGNAL_BASE，或完成 register",
            });
            return;
          }
          const report = await syncSubscription(entry, { baseUrl: base_url, paths });
          json(res, { ok: true, report });
          return;
        }
        if (req.method === "POST" && url.pathname === "/api/library/delete") {
          const body = await readBody(req);
          const id = String(body.id ?? "").trim();
          const existed = await deleteSkill(id, paths);
          json(
            res,
            existed ? { ok: true } : { ok: false, reason: "条目不存在" },
            existed ? 200 : 404,
          );
          return;
        }
        json(res, { error: "not found" }, 404);
      } catch (err) {
        json(res, { error: err instanceof Error ? err.message : String(err) }, 500);
      }
    })();
  });

  // E-3：随机端口绑定失败重试 3 次
  let attempt = 0;
  while (true) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
          server.removeListener("error", reject);
          resolve();
        });
      });
      break;
    } catch (err) {
      attempt++;
      if (attempt >= 3) throw err;
    }
  }
  const addr = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}/`;

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    resolveWait({ action: "closed" });
  };

  if (options.open !== false) openBrowser(url);
  return { url, wait, close };
}

async function buildState(paths: AgentSignalPaths) {
  const detected = detectHosts();
  const hosts: (WireResult & { detected: boolean })[] = [];
  for (const host of hostDefs()) {
    hosts.push({
      ...(await hostStatus(host)),
      detected: detected.find((d) => d.id === host.id)?.detected ?? false,
    });
  }
  const { skills, errors } = await scanSkills(paths);
  let config: EngineConfig | null = null;
  let state: "wizard" | "manage" | "corrupt" = "wizard";
  let corrupt: string | undefined;
  try {
    const loaded = await loadConfig(paths);
    if (loaded) {
      config = loaded.config;
      state = "manage";
    }
  } catch (err) {
    if (err instanceof ConfigError && err.code === CONFIG_INVALID) {
      state = "corrupt";
      corrupt = err.message;
    } else {
      throw err;
    }
  }
  let index_rebuilt_at: string | null = null;
  try {
    index_rebuilt_at = (await stat(paths.indexDumpFile)).mtime.toISOString();
  } catch {
    index_rebuilt_at = null;
  }
  // dynamic-skill-management P2.3：订阅 + 经验库（来源/状态/裁决聚合）
  const library = skills.map((s) => ({
    id: s.id,
    name: s.name,
    bytes: s.bodyBytes,
    status: (s.lifecycle.provenance?.sig_id ? "active" : "local") as "active" | "local",
    source: s.lifecycle.provenance
      ? {
          topic: s.lifecycle.provenance.topic ?? null,
          validation: s.lifecycle.provenance.validation ?? null,
          synced_at: s.lifecycle.provenance.synced_at ?? null,
        }
      : null,
    verify: s.lifecycle.metrics,
  }));
  let sync: {
    subscriptions: EngineConfig["sync"]["subscriptions"];
    max_skills: number;
    base_url: string | null;
  } | null = null;
  if (config) {
    sync = {
      subscriptions: config.sync.subscriptions,
      max_skills: config.sync.max_skills,
      base_url: (await readPlatformCredentials()).base ?? null,
    };
  }
  return {
    state,
    corrupt,
    hosts,
    config,
    stats: {
      skill_count: skills.length,
      error_count: errors.length,
      bytes_total: skills.reduce((acc, s) => acc + s.bodyBytes, 0),
      index_rebuilt_at,
    },
    metrics: await readMetrics(paths),
    layout: { root: paths.root },
    options: { domains: DEFAULT_DOMAINS, stacks: STACK_OPTIONS },
    library,
    sync,
  };
}
