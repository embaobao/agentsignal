/**
 * 宿主注册表与探测（wiring/detect）。
 *
 * 宿主覆盖矩阵（host-matrix-alignment）：
 *   Claude Code = hooks + MCP 全量 · Cursor/Gemini/Cline/Codex = MCP（+rules 一行兜底）
 *   Hermes = skill + SOUL.md 块 + hook 双写，不写 MCP（mcpPath = null）
 * D7 不猜 MCP 纪律：没把握的宿主一律不写 MCP，只发 skill + rules 一行兜底，不产生垃圾配置。
 * 探测 = 配置目录特征文件存在；写入只碰 agentsignal 自己的条目，不覆盖用户已有配置（规范 E-10）。
 */
import { statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type HostId = "claude-code" | "cursor" | "codex" | "cline" | "gemini" | "hermes";

export interface HostDef {
  id: HostId;
  name: string;
  /** MCP mcpServers 配置文件（绝对路径模板，~ 已展开）；null = 宿主不写 MCP（D1/D7：Hermes） */
  mcpPath: string | null;
  /** 宿主是否支持 hooks（否则用 rules 一行兜底） */
  hooks: boolean;
  /** rules 兜底文件（无 hooks 宿主）；null = 不支持 */
  rulesPath: string | null;
  /** TOML 格式（Codex）走专用合并器 */
  toml: boolean;
  /** SOUL.md 块注入文件（Hermes，标记段 agentsignal:rules:start/end） */
  soulPath?: string;
  /** hooks YAML（Hermes config.yaml 的 hooks.<event>[]，双写其一） */
  hooksYamlPath?: string;
  /** shell hook 白名单（Hermes 双写其二，同 {event,command} 去重） */
  hookAllowlistPath?: string;
  detect(): boolean;
}

/** AGENTSIGNAL_HOME 仅测试夹具使用（不碰真实宿主配置）；惰性求值，夹具 env 才生效 */
function home(): string {
  return process.env.AGENTSIGNAL_HOME ?? homedir();
}

function exists(file: string): boolean {
  try {
    statSyncSafe(file);
    return true;
  } catch {
    return false;
  }
}

function statSyncSafe(file: string): void {
  statSync(file);
}

/** Hermes home：HERMES_HOME env 优先（夹具/多环境），缺省 ~/.hermes */
function hermesHome(): string {
  return process.env.HERMES_HOME ?? path.join(home(), ".hermes");
}

/** 宿主清单：每次调用重新求值（AGENTSIGNAL_HOME 夹具生效的前提） */
export function hostDefs(): HostDef[] {
  const h = home();
  const hm = hermesHome();
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      // mcpServers 实际生效文件是 ~/.claude.json；hooks 片段在 ~/.claude/settings.json
      mcpPath: path.join(h, ".claude.json"),
      hooks: true,
      rulesPath: null,
      toml: false,
      detect: () => exists(path.join(h, ".claude")) || exists(path.join(h, ".claude.json")),
    },
    {
      id: "cursor",
      name: "Cursor",
      mcpPath: path.join(h, ".cursor", "mcp.json"),
      hooks: false,
      rulesPath: path.join(h, ".cursor", "AGENTS.md"),
      toml: false,
      detect: () => exists(path.join(h, ".cursor")),
    },
    {
      id: "codex",
      name: "Codex",
      mcpPath: path.join(h, ".codex", "config.toml"),
      hooks: false,
      rulesPath: path.join(h, ".codex", "AGENTS.md"),
      toml: true,
      detect: () => exists(path.join(h, ".codex")),
    },
    {
      id: "cline",
      name: "Cline",
      mcpPath: path.join(h, ".cline", "mcp_settings.json"),
      hooks: false,
      rulesPath: path.join(h, ".cline", "AGENTS.md"),
      toml: false,
      detect: () => exists(path.join(h, ".cline")),
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      mcpPath: path.join(h, ".gemini", "settings.json"),
      hooks: false,
      rulesPath: path.join(h, ".gemini", "AGENTS.md"),
      toml: false,
      detect: () => exists(path.join(h, ".gemini")),
    },
    {
      // Hermes（TeamAI）：只发 skill + SOUL.md 块 + hook 双写；不写 MCP（D1/D7 不猜纪律）
      id: "hermes",
      name: "Hermes",
      mcpPath: null,
      hooks: false,
      rulesPath: null,
      toml: false,
      soulPath: path.join(hm, "SOUL.md"),
      hooksYamlPath: path.join(hm, "config.yaml"),
      hookAllowlistPath: path.join(hm, "shell-hooks-allowlist.json"),
      detect: () => exists(hm),
    },
  ];
}

export function hostById(id: HostId): HostDef {
  const h = hostDefs().find((x) => x.id === id);
  if (!h) throw new Error(`unknown host: ${id}`);
  return h;
}

export interface DetectedHost {
  id: HostId;
  name: string;
  detected: boolean;
  mcpPath: string | null;
}

export function detectHosts(): DetectedHost[] {
  return hostDefs().map((h) => ({
    id: h.id,
    name: h.name,
    detected: h.detect(),
    mcpPath: h.mcpPath,
  }));
}
