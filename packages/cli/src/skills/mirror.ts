/**
 * verify 回流镜像（dynamic-skill-management P1.2 · 决议 2026-09-08 裁决 4）。
 *
 * 本地 verify_skill 落 metrics 后：
 *   - mirror off（默认）：零网络，只返回手动回传提示（agentsignal verify <sig_id>）；
 *   - mirror on + 平台 token：POST <base>/signals/<sig_id>/verify 自动镜像；任何失败不抛（本地裁决不受影响）。
 * 身份：复用平台 CLI 凭证（~/.config/agentsignal/config.json，env 优先）——不新增登录面（红线 7）。
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { loadConfig } from "./config.ts";
import type { AgentSignalPaths } from "./paths.ts";
import { scanSkills } from "./store.ts";
import type { Verdict } from "./verify.ts";

export interface PlatformCredentials {
  token?: string;
  base?: string;
}

// 与 index.ts register/publish 同一契约：AGENTSIGNAL_CLIENT_DIR 可整体改指凭证目录
const PLATFORM_CONFIG = path.join(
  process.env.AGENTSIGNAL_CLIENT_DIR ?? path.join(homedir(), ".config", "agentsignal"),
  "config.json",
);

/** 平台 CLI 凭证（env 优先，与 register/publish 同一契约）；读不到 = 匿名 */
export async function readPlatformCredentials(): Promise<PlatformCredentials> {
  let cfg: PlatformCredentials = {};
  try {
    cfg = JSON.parse(await readFile(PLATFORM_CONFIG, "utf8")) as PlatformCredentials;
  } catch {
    // 未 register = 匿名
  }
  return {
    token: process.env.AGENTSIGNAL_TOKEN ?? cfg.token,
    base: process.env.AGENTSIGNAL_BASE ?? cfg.base,
  };
}

export interface MirrorContext {
  sigId: string;
  baseUrl: string;
  mirrorEnabled: boolean;
  token?: string;
}

/** 技能是否来自平台（provenance 全录）+ 镜像开关 + 平台凭证；非平台技能返回 null（不提示不打扰） */
export async function mirrorContextForSkill(
  skillId: string,
  paths?: AgentSignalPaths,
): Promise<MirrorContext | null> {
  const { skills } = await scanSkills(paths);
  // 本地 id 一律小写存储；入参可能是平台原始大小写，归一比对
  const prov = skills.find((s) => s.id === skillId.toLowerCase())?.lifecycle.provenance;
  if (!prov?.sig_id || !prov.base_url) return null;
  let mirrorEnabled = false;
  try {
    const loaded = await loadConfig(paths);
    mirrorEnabled = loaded?.config.sync.mirror_verify ?? false;
  } catch {
    // config 损坏按 off 处理（fail-soft，不影响本地裁决）
  }
  const { token } = await readPlatformCredentials();
  return { sigId: prov.sig_id, baseUrl: prov.base_url, mirrorEnabled, token };
}

export interface MirrorOutcome {
  mirrored: boolean;
  platform_status?: number;
  /** 手动回传/补救提示（镜像成功时无提示） */
  hint?: string;
}

export async function mirrorPlatformVerify(opts: {
  sigId: string;
  verdict: Verdict;
  baseUrl: string;
  token?: string;
  mirrorEnabled: boolean;
  fetchImpl?: typeof fetch;
}): Promise<MirrorOutcome> {
  const manual = `agentsignal verify ${opts.sigId}`;
  if (!opts.mirrorEnabled) {
    return {
      mirrored: false,
      hint: opts.token
        ? `▶ 回传平台聚合：${manual}`
        : `▶ 回传平台：先 agentsignal register 领 token，再 ${manual}`,
    };
  }
  if (!opts.token) {
    return {
      mirrored: false,
      hint: `mirror_verify 已开但缺平台凭证：先 agentsignal register（本地裁决已记录；${manual} 可手动补传）`,
    };
  }
  try {
    const res = await (opts.fetchImpl ?? fetch)(
      `${opts.baseUrl}/signals/${encodeURIComponent(opts.sigId)}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${opts.token}` },
        body: JSON.stringify({ verdict: opts.verdict }),
      },
    );
    if (!res.ok) {
      return {
        mirrored: false,
        platform_status: res.status,
        hint: `平台回传未成功（${res.status}），本地裁决不受影响；稍后可 ${manual}`,
      };
    }
    return { mirrored: true, platform_status: res.status };
  } catch (err) {
    return {
      mirrored: false,
      hint: `平台回传网络异常（${err instanceof Error ? err.message : String(err)}），本地裁决不受影响；稍后可 ${manual}`,
    };
  }
}
