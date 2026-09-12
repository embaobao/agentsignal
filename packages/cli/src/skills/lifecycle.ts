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
import { loadConfig } from "./config.ts";
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
  // 本地 id 一律小写存储；平台 ULID 含大写，比对统一归一
  return skills.some((s) => s.id === anchor.toLowerCase());
}

/** 信号是否已装（sync 源失效判定用；anchor 缺省 = false） */
export async function isInstalled(
  sigId: string | null | undefined,
  paths?: AgentSignalPaths,
): Promise<boolean> {
  if (!sigId) return false;
  const { skills } = await scanSkills(paths);
  return skills.some((s) => s.id === sigId.toLowerCase());
}

/** 源失效（404/hidden）：标 revoked 降权置灰，不物理删；返回 false = 技能不存在 */
export async function markRevoked(sigId: string, paths?: AgentSignalPaths): Promise<boolean> {
  const p = paths ?? resolvePaths();
  const id = sigId.toLowerCase(); // 平台 ULID 含大写，本地目录一律小写
  if (!/^[a-z][a-z0-9_-]*$/.test(id)) return false;
  const metaFile = path.join(p.skillsDir, id, "skill.json5");
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
  const anchor = anchorSigId.toLowerCase(); // 平台 ULID 含大写，本地目录一律小写
  if (!/^[a-z][a-z0-9_-]*$/.test(anchor)) return false; // 目录名白名单，防路径穿越
  const dir = path.join(p.skillsDir, anchor);
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

export interface CapacityCandidate {
  id: string;
  name: string;
  use_count: number;
  verify_total: number;
}

export interface CapacityReport {
  count: number;
  max: number;
  over: boolean;
  /** LRU 清理候选：未验证（worked+partial+failed=0）按 use_count 升序；确认后手动清理，不自动删 */
  candidates: CapacityCandidate[];
}

/** 容量盘点（status 告警 + 管理界面候选列表共用口径） */
export async function capacityReport(paths?: AgentSignalPaths): Promise<CapacityReport> {
  const p = paths ?? resolvePaths();
  const { skills } = await scanSkills(p);
  let max = 200;
  try {
    const loaded = await loadConfig(p);
    max = loaded?.config.sync.max_skills ?? 200;
  } catch {
    // config 异常按默认上限
  }
  const candidates = skills
    .filter(
      (s) =>
        s.lifecycle.metrics.worked + s.lifecycle.metrics.partial + s.lifecycle.metrics.failed === 0,
    )
    .sort((a, b) => a.lifecycle.metrics.use_count - b.lifecycle.metrics.use_count)
    .map((s) => ({
      id: s.id,
      name: s.name,
      use_count: s.lifecycle.metrics.use_count,
      verify_total: 0,
    }));
  return { count: skills.length, max, over: skills.length > max, candidates };
}

/* ------------------------------- 三计数分立（P5 5.3） ------------------------------- */

/** 可埋点计数键：retrieved（检索命中）/ injected（注入上下文）；used = use_count（verify 加） */
export type BumpableMetric = "retrieved" | "injected";

/**
 * 技能级计数 +1（批量多 id 一次会话只逐个写回，本地库小、原子性优先）。
 * 检索埋点（search_skills 命中）与注入埋点（loadDetail 成功）调用；
 * 旧库无该键由 schema default(0) 兜底，零破坏。
 */
export async function bumpSkillMetrics(
  ids: readonly string[],
  key: BumpableMetric,
  paths?: AgentSignalPaths,
): Promise<void> {
  if (ids.length === 0) return;
  const p = paths ?? resolvePaths();
  const { skills } = await scanSkills(p);
  const wanted = new Set(ids.map((id) => id.toLowerCase()));
  for (const skill of skills) {
    if (!wanted.has(skill.id)) continue;
    const raw = await readFile(skill.metaFile, "utf8");
    const parsed = SkillFrontmatterSchema.parse(JSON5.parse(raw));
    parsed.lifecycle.metrics[key] += 1;
    const tmp = `${skill.metaFile}.tmp-${process.pid}`;
    await writeFile(tmp, JSON5.stringify(parsed, null, 2), "utf8");
    await rename(tmp, skill.metaFile);
  }
}
