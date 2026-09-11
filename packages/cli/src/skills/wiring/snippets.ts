/**
 * 接线片段生成与写入（wiring/snippets）。
 *
 * 铁律：只写 agentsignal 自己的条目，不覆盖用户已有配置；宿主配置文件无法合并时
 * 返回结构化失败（规范 E-04），由 UI 提示「备份该文件后重试」。
 * 写盘一律 tmp + rename 原子写（多宿主并发口径）。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import type { HostDef, HostId } from "./hosts.ts";
import { injectSoulBlock, removeSoulBlock } from "./soul.ts";

export type WireStatus = "wired" | "drift" | "absent";

export interface WireResult {
  host: HostId;
  name: string;
  path: string;
  /** MCP 接线状态 */
  mcp: WireStatus;
  /** hook/rules 兜底写入情况 */
  extra?: "hook" | "rules" | "none";
  error?: string;
}

const MCP_NAME = "agentsignal";

export function mcpEntry(): { command: string; args: string[] } {
  return { command: "agentsignal", args: ["mcp"] };
}

/** Claude Code UserPromptSubmit hook 片段（推通道，用户无感） */
export function hookSnippet(): Record<string, unknown> {
  return {
    hooks: [
      {
        type: "command",
        command: "agentsignal context",
      },
    ],
  };
}

export const RULES_LINE =
  "- 开工前先调用 `search_skills` 查本地已有经验，命中后用 `load_skill_detail` 取全文。\n";

async function readJson(file: string): Promise<Record<string, unknown>> {
  try {
    return JSON5.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw new WireError(`宿主配置格式异常：${file}`, "E-04");
  }
}

export class WireError extends Error {
  readonly code: "E-01" | "E-02" | "E-03" | "E-04" | "E-05";
  constructor(message: string, code: "E-01" | "E-02" | "E-03" | "E-04" | "E-05" = "E-05") {
    super(message);
    this.name = "WireError";
    this.code = code;
  }
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

function statusOf(entry: unknown): WireStatus {
  if (!entry || typeof entry !== "object") return "absent";
  const e = entry as { command?: string; args?: string[] };
  if (e.command?.includes(MCP_NAME) && (e.args ?? []).includes("mcp")) return "wired";
  return "drift";
}

/** 读取某宿主的当前 MCP 接线状态 */
export async function hostStatus(host: HostDef): Promise<WireResult> {
  // D1/D7：mcpPath=null 宿主（Hermes）无 MCP 语义，状态恒 absent，零文件触碰
  if (host.mcpPath === null) {
    return { host: host.id, name: host.name, path: host.soulPath ?? "", mcp: "absent" };
  }
  if (host.toml) return tomlStatus(host);
  const json = await readJson(host.mcpPath);
  const servers = (json.mcpServers ?? {}) as Record<string, unknown>;
  return {
    host: host.id,
    name: host.name,
    path: host.mcpPath,
    mcp: statusOf(servers[MCP_NAME]),
  };
}

/* ------------------------------- JSON 宿主 ------------------------------- */

export async function wireMcp(host: HostDef): Promise<WireResult> {
  // mcpPath=null 宿主跳过 MCP 同步（不建目录不写文件，零垃圾）；rules/hook 兜底照走
  if (host.mcpPath === null) {
    return {
      host: host.id,
      name: host.name,
      path: host.soulPath ?? "",
      mcp: "absent",
      extra: await writeExtra(host),
    };
  }
  if (host.toml) return wireToml(host);
  const json = await readJson(host.mcpPath);
  const servers = (json.mcpServers ?? {}) as Record<string, unknown>;
  servers[MCP_NAME] = mcpEntry();
  json.mcpServers = servers;
  await writeJsonAtomic(host.mcpPath, json);
  return {
    host: host.id,
    name: host.name,
    path: host.mcpPath,
    mcp: "wired",
    extra: await writeExtra(host),
  };
}

/** hooks（Claude Code）或 rules 一行兜底（无 hooks 宿主） */
async function writeExtra(host: HostDef): Promise<"hook" | "rules" | "none"> {
  if (host.hooks) {
    // hooks 宿主（Claude Code）mcpPath 恒非 null（settings.json 与 mcpPath 同根）
    if (host.mcpPath === null) return "none";
    const settingsPath = path.join(path.dirname(host.mcpPath), ".claude", "settings.json");
    const json = await readJson(settingsPath);
    const hooks = (json.hooks ?? {}) as Record<string, unknown[]>;
    const list = (hooks.UserPromptSubmit ?? []) as Record<string, unknown>[];
    const mark = "agentsignal-context";
    if (!list.some((h) => JSON.stringify(h).includes(mark))) {
      list.push({ ...hookSnippet(), matcher: "", id: mark });
    }
    hooks.UserPromptSubmit = list;
    json.hooks = hooks;
    await writeJsonAtomic(settingsPath, json);
    return "hook";
  }
  // Hermes 等无 rules 文件位宿主：rules 一行兜底注入 SOUL.md 标记段（1.3）
  if (host.soulPath) {
    await injectSoulBlock(host.soulPath, RULES_LINE);
    return "rules";
  }
  if (host.rulesPath) {
    await mkdir(path.dirname(host.rulesPath), { recursive: true });
    let existing = "";
    try {
      existing = await readFile(host.rulesPath, "utf8");
    } catch {
      existing = "";
    }
    if (!existing.includes("search_skills")) {
      await writeFile(host.rulesPath, `${existing}${existing ? "\n" : ""}${RULES_LINE}`, "utf8");
    }
    return "rules";
  }
  return "none";
}

export async function unwireMcp(host: HostDef): Promise<WireResult> {
  // mcpPath=null 宿主无 MCP 可摘，直接 absent（摘除兜底片段照走）
  if (host.mcpPath === null) {
    return {
      host: host.id,
      name: host.name,
      path: host.soulPath ?? "",
      mcp: "absent",
      extra: await removeExtra(host),
    };
  }
  if (host.toml) return unwireToml(host);
  const json = await readJson(host.mcpPath);
  const servers = (json.mcpServers ?? {}) as Record<string, unknown>;
  delete servers[MCP_NAME];
  if (Object.keys(servers).length > 0) {
    json.mcpServers = servers;
  } else {
    delete json.mcpServers;
  }
  await writeJsonAtomic(host.mcpPath, json);
  return {
    host: host.id,
    name: host.name,
    path: host.mcpPath,
    mcp: "absent",
    extra: await removeExtra(host),
  };
}

async function removeExtra(host: HostDef): Promise<"none"> {
  if (host.hooks) {
    if (host.mcpPath === null) return "none";
    const settingsPath = path.join(path.dirname(host.mcpPath), ".claude", "settings.json");
    try {
      const json = await readJson(settingsPath);
      const hooks = (json.hooks ?? {}) as Record<string, Record<string, unknown>[]>;
      const list = (hooks.UserPromptSubmit ?? []).filter(
        (h) => !JSON.stringify(h).includes("agentsignal-context"),
      );
      if (list.length > 0) hooks.UserPromptSubmit = list;
      else delete hooks.UserPromptSubmit;
      if (Object.keys(hooks).length > 0) json.hooks = hooks;
      else delete json.hooks;
      await writeJsonAtomic(settingsPath, json);
    } catch {
      /* 摘除阶段不因兜底片段失败而中断 */
    }
    return "none";
  }
  // Hermes 等宿主：摘除 SOUL.md 标记段（用户原有内容保留）
  if (host.soulPath) {
    try {
      await removeSoulBlock(host.soulPath);
    } catch {
      /* 摘除阶段不因兜底片段失败而中断 */
    }
    return "none";
  }
  if (host.rulesPath) {
    try {
      const text = await readFile(host.rulesPath, "utf8");
      const kept = text
        .split("\n")
        .filter((l) => !l.includes("search_skills"))
        .join("\n");
      await writeFile(host.rulesPath, kept, "utf8");
    } catch {
      /* 忽略 */
    }
  }
  return "none";
}

/* ------------------------------- Codex（TOML） ------------------------------- */

const TOML_SECTION = "[mcp_servers.agentsignal]";

function stripTomlSection(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (line.trim().startsWith(TOML_SECTION)) {
      skipping = true;
      continue;
    }
    if (skipping && line.trim().startsWith("[")) skipping = false;
    if (!skipping) out.push(line);
  }
  return out.join("\n").trimEnd();
}

async function tomlStatus(host: HostDef): Promise<WireResult> {
  if (host.mcpPath === null) return { host: host.id, name: host.name, path: "", mcp: "absent" };
  let text = "";
  try {
    text = await readFile(host.mcpPath, "utf8");
  } catch {
    return { host: host.id, name: host.name, path: host.mcpPath, mcp: "absent" };
  }
  return {
    host: host.id,
    name: host.name,
    path: host.mcpPath,
    mcp: text.includes(TOML_SECTION) && text.includes('"mcp"') ? "wired" : "drift",
  };
}

async function wireToml(host: HostDef): Promise<WireResult> {
  if (host.mcpPath === null) {
    return { host: host.id, name: host.name, path: "", mcp: "absent", extra: "none" };
  }
  let text = "";
  try {
    text = await readFile(host.mcpPath, "utf8");
  } catch {
    text = "";
  }
  const body = stripTomlSection(text);
  const section = `${TOML_SECTION}\ncommand = "agentsignal"\nargs = ["mcp"]\n`;
  await mkdir(path.dirname(host.mcpPath), { recursive: true });
  const tmp = `${host.mcpPath}.tmp-${process.pid}`;
  await writeFile(tmp, `${body}\n\n${section}`, "utf8");
  await rename(tmp, host.mcpPath);
  return {
    host: host.id,
    name: host.name,
    path: host.mcpPath,
    mcp: "wired",
    extra: await writeExtra(host),
  };
}

async function unwireToml(host: HostDef): Promise<WireResult> {
  if (host.mcpPath === null) {
    return { host: host.id, name: host.name, path: "", mcp: "absent", extra: "none" };
  }
  let text = "";
  try {
    text = await readFile(host.mcpPath, "utf8");
  } catch {
    return { host: host.id, name: host.name, path: host.mcpPath, mcp: "absent", extra: "none" };
  }
  const tmp = `${host.mcpPath}.tmp-${process.pid}`;
  await writeFile(tmp, `${stripTomlSection(text)}\n`, "utf8");
  await rename(tmp, host.mcpPath);
  return {
    host: host.id,
    name: host.name,
    path: host.mcpPath,
    mcp: "absent",
    extra: await removeExtra(host),
  };
}
