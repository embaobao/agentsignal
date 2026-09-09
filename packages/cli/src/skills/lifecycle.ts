/**
 * 生命周期治理（dynamic-skill-management P3 · 决议 2026-09-08 裁决 3）。
 *
 * 更新链：update 信号 digest 锚定（`anchor: sig_x`）命中本地技能 →
 *   lifecycle.sync_state = outdated + updates 追加记录 + 更新正文写同目录 UPDATES.md
 *   附加层（原 SKILL.md 逐字不动，loadDetail 时附于正文之后）。
 * 失效降权（revoked）见 3.2；本模块只做纯本地路径，网络在 sync.ts。
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { SkillFrontmatterSchema } from "@agentssignal/protocol";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";
import { scanSkills } from "./store.ts";

export interface SignalUpdate {
  sig_id: string;
  digest: string;
  synced_at: string;
  body: string;
}

/** update 信号是否锚中已装技能（列表 digest 即可判定，不必拉详情） */
export async function updateTargetsInstalledSkill(
  anchor: string | null,
  paths?: AgentSignalPaths,
): Promise<boolean> {
  if (!anchor) return false;
  const { skills } = await scanSkills(paths);
  return skills.some((s) => s.id === anchor);
}

/** 信号是否已装（sync 源失效判定用；anchor 缺省 = false） */
export async function isInstalled(
  sigId: string | null | undefined,
  paths?: AgentSignalPaths,
): Promise<boolean> {
  if (!sigId) return false;
  const { skills } = await scanSkills(paths);
  return skills.some((s) => s.id === sigId);
}

/** 源失效（404/hidden）：标 revoked 降权置灰，不物理删；返回 false = 技能不存在 */
export async function markRevoked(sigId: string, paths?: AgentSignalPaths): Promise<boolean> {
  const p = paths ?? resolvePaths();
  if (!/^[a-z][a-z0-9_-]*$/.test(sigId)) return false;
  const metaFile = path.join(p.skillsDir, sigId, "skill.json5");
  let raw: string;
  try {
    raw = await readFile(metaFile, "utf8");
  } catch {
    return false;
  }
  const fm = SkillFrontmatterSchema.parse(JSON5.parse(raw));
  fm.lifecycle.sync_state = "revoked";
  const tmp = `${metaFile}.tmp-${process.pid}`;
  await writeFile(tmp, JSON5.stringify(fm, null, 2), "utf8");
  await rename(tmp, metaFile);
  return true;
}

/** 把一条平台 update 应用到锚定的本地技能；返回 false = 技能不存在 */
export async function applySignalUpdate(
  anchorSigId: string,
  update: SignalUpdate,
  paths?: AgentSignalPaths,
): Promise<boolean> {
  const p = paths ?? resolvePaths();
  if (!/^[a-z][a-z0-9_-]*$/.test(anchorSigId)) return false; // 目录名白名单，防路径穿越
  const dir = path.join(p.skillsDir, anchorSigId);
  const metaFile = path.join(dir, "skill.json5");
  let raw: string;
  try {
    raw = await readFile(metaFile, "utf8");
  } catch {
    return false;
  }
  const fm = SkillFrontmatterSchema.parse(JSON5.parse(raw));
  fm.lifecycle.sync_state = "outdated";
  fm.lifecycle.updates.push({
    sig_id: update.sig_id,
    digest: update.digest,
    synced_at: update.synced_at,
  });
  const tmp = `${metaFile}.tmp-${process.pid}`;
  await writeFile(tmp, JSON5.stringify(fm, null, 2), "utf8");
  await rename(tmp, metaFile);

  // 更新正文 = UPDATES.md 附加层（追加段落，不触碰 SKILL.md）
  const updatesFile = path.join(dir, "UPDATES.md");
  let existing = "";
  try {
    existing = await readFile(updatesFile, "utf8");
  } catch {
    // 首次创建
  }
  const section = `${existing ? "\n\n" : "# 平台更新\n"}## 更新 ${update.sig_id}\n\ndigest：${update.digest}\n\n${update.body.trimEnd()}\n`;
  const tmpU = `${updatesFile}.tmp-${process.pid}`;
  await writeFile(tmpU, existing + section, "utf8");
  await rename(tmpU, updatesFile);
  return true;
}
