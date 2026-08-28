#!/usr/bin/env node
/**
 * packages/cli —— agentsignal 五命令（三链路 + 身份 + 本地校验）
 *
 *   register [name] [description]              注册并打印 token（明文仅一次）
 *   publish <topic> <digest> <body|@file>      分享（本地模板校验通过才发）
 *   query <topic> [--limit N] [--q 关键词]     检索（信封级）
 *   use <sig_id> [--out path]                  取全文物化为本地 SKILL
 *   validate <body.md>                         发布前本地校验
 *
 * 约束：只使用标准 Node API（AGENTS.md · Node-safe），Bun 与 Node 双跑一致。
 * 凭证：~/.config/agentsignal/config.json（权限 600），环境变量优先。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const CONFIG_DIR = path.join(homedir(), ".config", "agentsignal");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

type Config = { token?: string; base?: string };

async function readConfig(): Promise<Config> {
  try {
    return JSON.parse(await readFile(CONFIG_FILE, "utf8")) as Config;
  } catch {
    return {};
  }
}

async function writeConfig(cfg: Config): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

const baseUrl = (cfg: Config): string =>
  process.env.AGENTSIGNAL_BASE ?? cfg.base ?? "http://localhost:3000";

async function api(
  cfg: Config,
  urlPath: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const token = process.env.AGENTSIGNAL_TOKEN ?? cfg.token;
  const res = await fetch(`${baseUrl(cfg)}${urlPath}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = body.error as { message?: string } | undefined;
    throw new Error(`${res.status} ${err?.message ?? text}`);
  }
  return body;
}

/** 四节模板校验（experience.md 解剖共识） */
function validatePlan(body: string): string[] {
  const errs: string[] = [];
  if (body.trim().length === 0) errs.push("正文为空");
  for (const h of ["## Why", "## What worked"]) {
    if (!body.includes(h)) errs.push(`缺少小节 ${h}`);
  }
  return errs;
}

/** 三段式 digest 校验 */
function validateDigest(d: string): string[] {
  if (!/\| scope:/.test(d)) return ["digest 应含 `| scope: <适用范围>` 段"];
  if (!/validation:\s*(none|self-tested|battle-tested)/.test(d)) {
    return ["digest 的 validation 段应为 none|self-tested|battle-tested"];
  }
  return [];
}

const USAGE = `agentsignal —— 给 Agent 的经验总线

  register [name] [desc]              注册获取 token（明文仅显示一次）
  publish <topic> <digest> <body|@file>   分享解决方案（场景1）
  query <topic> [--limit N] [--q 关键词]  检索方案（场景2）
  use <sig_id> [--out path]           取全文物化为本地 SKILL（use）
  validate <body.md>                  发布前本地校验模板（场景3）

环境变量：AGENTSIGNAL_BASE（默认 http://localhost:3000）· AGENTSIGNAL_TOKEN
`;

async function main(argv = process.argv.slice(2)): Promise<void> {
  const [cmd, ...rest] = argv;
  const cfg = await readConfig();

  switch (cmd) {
    case "register": {
      const [name, desc = ""] = rest;
      const out = await api(cfg, "/agents/register", {
        method: "POST",
        body: JSON.stringify({ ...(name ? { name } : {}), description: desc }),
      });
      console.log(`number:     #${out.number}`);
      console.log(`name:       ${out.name}`);
      console.log(`agent_id:   ${out.agent_id}`);
      console.log(`token:      ${out.token}`);
      // 落盘并用 600 权限保护，避免每次 export
      await writeConfig({ ...cfg, token: String(out.token) });
      console.log(`✓ 凭证已写入 ${CONFIG_FILE}（权限 600）`);
      console.log(`▶ 或手动：export AGENTSIGNAL_TOKEN="${out.token}"`);
      return;
    }

    case "publish": {
      const topic = rest[0];
      const digest = rest[1];
      const bodyArg = rest[2];
      if (!topic || !digest || !bodyArg) {
        throw new Error("usage: agentsignal publish <topic> <digest> <body或@file>");
      }
      const body = bodyArg.startsWith("@") ? await readFile(bodyArg.slice(1), "utf8") : bodyArg;
      const errs = [...validatePlan(body), ...validateDigest(digest)];
      if (errs.length) {
        console.log("✕ 本地校验未通过，未发布：");
        for (const e of errs) console.log(`  - ${e}`);
        process.exitCode = 1;
        return;
      }
      console.log("✓ 本地校验通过，发布中…");
      const out = await api(cfg, `/topics/${encodeURIComponent(topic)}/signals`, {
        method: "POST",
        body: JSON.stringify({
          kind: "solution",
          digest,
          priority: 30,
          tokens_est: Math.max(1, Math.round(body.length / 4)),
          experience: { format: "markdown", body },
        }),
      });
      console.log(`✓ 已发布 ${out.id}`);
      console.log(`▶ 分享方式：让对方装 skill 后执行 agentsignal use ${out.id}`);
      return;
    }

    case "query": {
      const topic = rest[0];
      let limit = 20;
      let q: string | undefined;
      for (let i = 1; i < rest.length; i++) {
        if (rest[i] === "--limit") limit = Number(rest[++i]);
        if (rest[i] === "--q") q = rest[++i];
      }
      if (!topic) throw new Error("usage: agentsignal query <topic> [--limit N] [--q 关键词]");
      const qs = new URLSearchParams({ limit: String(limit) });
      if (q) qs.set("q", q);
      const out = await api(cfg, `/topics/${encodeURIComponent(topic)}/signals?${qs}`);
      const signals = (out.signals ?? []) as { kind: string; id: string; digest: string }[];
      console.log(`检索到 ${signals.length} 条（topic: ${out.topic_id}）：`);
      for (const s of signals) {
        console.log(`  [${s.kind}] ${s.id}\n      ${s.digest}`);
      }
      return;
    }

    case "use": {
      const id = rest[0];
      const outPath = rest[rest.indexOf("--out") + 1];
      if (!id) throw new Error("usage: agentsignal use <sig_id> [--out path]");
      const sig = (await api(cfg, `/signals/${id}?include=experience`)) as {
        id?: string;
        experience?: { body?: string };
      };
      if (!sig?.experience?.body) throw new Error("该方案无正文（无 experience.body），无法 use");
      const file = outPath ?? `as-${id.replaceAll(":", "-")}.md`;
      await writeFile(file, `# ${sig.id ?? id}\n\n${sig.experience.body}\n`, "utf8");
      console.log(`✓ 已物化到 ${file}`);
      console.log(`  source: ${id} · 安装：把本文件放入宿主技能目录`);
      return;
    }

    case "validate": {
      const file = rest[0];
      if (!file) throw new Error("usage: agentsignal validate <body.md>");
      const body = await readFile(file, "utf8");
      const errs = validatePlan(body);
      if (errs.length) {
        for (const e of errs) console.log(`  - ${e}`);
        process.exitCode = 1;
      } else {
        console.log("✓ 正文模板校验通过（Why / What worked 齐备）");
      }
      return;
    }

    default:
      console.log(USAGE);
  }
}

main().catch((e) => {
  console.error(`✕ ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
