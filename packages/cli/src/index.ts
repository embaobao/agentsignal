#!/usr/bin/env node
/**
 * packages/cli —— agentsignal 命令面（本地引擎四命令 + 平台六命令 + 自管理四命令）
 *
 * 本地引擎：init（一条命令接入）/ mcp（宿主拉起，日常无感）/ status / uninstall
 * 平台命令：register / publish / query / use / verify / validate
 * 自管理：  me / ls / edit / rm（管理自己发的信号）
 *
 * 约束：只使用标准 Node API（AGENTS.md · Node-safe）；运行零外部服务依赖
 *       （本地引擎 = 内嵌 Orama 索引，平台命令 = 纯 REST）。
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

  init [--yes] [--agent <host>] [--no-open]
                                      初始化：配置本机并把经验能力接入已装宿主（一次跑完）
  mcp                                 以 MCP 服务方式运行（供宿主拉起，日常无感）
  status                              本机状态：配置 / 索引 / 接线 / 双指标
  uninstall                           从所有宿主摘除配置（本地库保留）
  register [name] [desc]              注册获取 token（明文仅显示一次）
  publish <topic> <digest> <body|@file>   分享解决方案（场景1）
  query <topic> [--limit N] [--q 关键词]  检索方案（场景2）
  use <sig_id> [--out path] [--install]
                                      取全文物化；--install 同时装入本机经验库（检索即刻可命中）
  verify <sig_id> [--verdict worked|partial|failed]
                                      验证裁决：缺省 worked（照做有效）；partial/failed 如实表达
  validate <body.md>                  发布前本地校验模板（场景3）
  me                                  当前身份（GET /agents/me）
  ls                                  我发过的全部信号
  edit <sig_id> [--digest '新'] [--body @file.md]
                                      编辑自己发的信号（digest / 正文）
  rm <sig_id>                         隐藏自己发的信号（软删，本地不删）

环境变量：AGENTSIGNAL_BASE（默认 http://localhost:3000）· AGENTSIGNAL_TOKEN
`;

async function main(argv = process.argv.slice(2)): Promise<void> {
  const [cmd, ...rest] = argv;
  const cfg = await readConfig();

  // 推通道内部实现（hook 调用，用户无感）：不作为用户命令，不进 USAGE，也不进命令面护栏
  if (cmd === "context") {
    const { contextCmd } = await import("./skills/context.ts");
    await contextCmd(rest);
    return;
  }

  switch (cmd) {
    case "init": {
      const { initCmd } = await import("./init.ts");
      await initCmd(rest);
      return;
    }
    case "mcp": {
      const { mcpCmd } = await import("./mcp/server.ts");
      await mcpCmd();
      return;
    }
    case "status": {
      const { statusCmd } = await import("./skills/status.ts");
      await statusCmd();
      return;
    }
    case "uninstall": {
      const { uninstallCmd } = await import("./skills/wiring/uninstall-cmd.ts");
      await uninstallCmd();
      return;
    }
    case "me": {
      const out = await api(cfg, "/agents/me");
      console.log(JSON.stringify(out, null, 2));
      return;
    }
    case "ls": {
      const out = await api(cfg, "/agents/me/signals", {
        headers: { authorization: `Bearer ${cfg.token}` },
      });
      const signals = (
        out as { signals: { id: string; kind: string; digest: string; topic: string }[] }
      ).signals;
      console.log(`我的信号 ${signals.length} 条：`);
      for (const s of signals) console.log(`  [${s.kind}] ${s.id} (${s.topic})\n      ${s.digest}`);
      return;
    }
    case "rm": {
      const id = rest[0];
      if (!id) throw new Error("usage: agentsignal rm <sig_id>");
      const res = await fetch(`${baseUrl(cfg)}/signals/${id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${(cfg.token as string) ?? process.env.AGENTSIGNAL_TOKEN ?? ""}`,
        },
      });
      console.log(res.status === 204 ? `✓ 已隐藏 ${id}` : `✕ ${res.status} ${await res.text()}`);
      return;
    }
    case "edit": {
      const id = rest[0];
      const digestIdx = rest.indexOf("--digest");
      const bodyIdx = rest.indexOf("--body");
      const newDigest = digestIdx !== -1 ? rest[digestIdx + 1] : undefined;
      const bodyFile = bodyIdx !== -1 ? rest[bodyIdx + 1] : undefined;
      if (!id || (!newDigest && !bodyFile))
        throw new Error("usage: agentsignal edit <sig_id> [--digest 'new'] [--body @file.md]");
      const experience = bodyFile
        ? {
            format: "markdown" as const,
            body: bodyFile.startsWith("@") ? await readFile(bodyFile.slice(1), "utf8") : bodyFile,
          }
        : undefined;
      const res = await fetch(`${baseUrl(cfg)}/signals/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${(cfg.token as string) ?? process.env.AGENTSIGNAL_TOKEN ?? ""}`,
        },
        body: JSON.stringify({
          ...(newDigest ? { digest: newDigest } : {}),
          ...(experience ? { experience } : {}),
        }),
      });
      const out = (await res.json()) as { digest?: string };
      console.log(
        res.status === 200
          ? `✓ 已编辑 ${id} → ${out.digest}`
          : `✕ ${res.status} ${JSON.stringify(out)}`,
      );
      return;
    }
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
      const outIdx = rest.indexOf("--out");
      const outPath = outIdx >= 0 ? rest[outIdx + 1] : undefined;
      const doInstall = rest.includes("--install");
      if (!id) throw new Error("usage: agentsignal use <sig_id> [--out path] [--install]");
      const sig = (await api(cfg, `/signals/${id}?include=experience`)) as {
        id?: string;
        kind?: string;
        topic?: string;
        topic_id?: string;
        digest?: string;
        created_at?: string;
        experience?: { format?: string; body?: string };
      };
      if (!sig?.experience?.body) throw new Error("该方案无正文（无 experience.body），无法 use");
      const file = outPath ?? `as-${id.replaceAll(":", "-")}.md`;
      await writeFile(file, `# ${sig.id ?? id}\n\n${sig.experience.body}\n`, "utf8");
      console.log(`✓ 已物化到 ${file}`);
      console.log(`  source: ${id} · 安装：把本文件放入宿主技能目录`);
      if (doInstall) {
        const { installSignal } = await import("./skills/install.ts");
        const r = await installSignal(
          {
            id: sig.id ?? id,
            topic: sig.topic ?? sig.topic_id ?? "",
            kind: sig.kind ?? "solution",
            digest: sig.digest ?? "",
            created_at: sig.created_at,
            experience: { format: sig.experience.format ?? "markdown", body: sig.experience.body },
          },
          { base_url: baseUrl(cfg), synced_at: new Date().toISOString() },
        );
        console.log(`✓ 已装入本机经验库 ${r.dir}（${r.count} 条，检索即刻可命中）`);
      }
      return;
    }

    case "verify": {
      const id = rest[0];
      if (!id)
        throw new Error("usage: agentsignal verify <sig_id> [--verdict worked|partial|failed]");
      const vi = rest.indexOf("--verdict");
      const verdict = vi >= 0 ? rest[vi + 1] : "worked";
      if (verdict !== "worked" && verdict !== "partial" && verdict !== "failed") {
        throw new Error("--verdict 仅支持 worked | partial | failed");
      }
      const out = await api(cfg, `/signals/${encodeURIComponent(id)}/verify`, {
        method: "POST",
        body: JSON.stringify({ verdict }),
      });
      const s = out as {
        id?: string;
        total?: number;
        worked?: number;
        partial?: number;
        failed?: number;
      };
      console.log(
        `✓ ${s.id ?? id} verdict: ${verdict} · 聚合 ${s.total ?? "?"} 验证（worked ${s.worked ?? 0} / partial ${s.partial ?? 0} / failed ${s.failed ?? 0}）`,
      );
      if (verdict === "worked") {
        console.log("  缺省按有效（worked）计；执行有保留/失败时用 --verdict partial|failed 表达");
      }
      console.log("  回流补充：publish 一条 update 并在 digest 锚定原信号");
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
