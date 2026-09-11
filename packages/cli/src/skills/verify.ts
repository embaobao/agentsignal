/**
 * 本地 verify（裁决 5/10）：verdict 只写本地 lifecycle.metrics，不回传平台。
 * 用户域暂缓（不做登录/token 鉴权）；Phase 3 接 creds 后回传聚合。
 * P5 5.1：verify_target 三态判定可关联——结果带归一目标（新 {statement, checks[]}），
 * 历史 null / 字符串数组形态零破坏（归一在此引擎层，schema 收宽不拒旧数据）。
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { SkillFrontmatterSchema, type SkillVerifyTarget } from "@agentssignal/protocol";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";
import { scanSkills } from "./store.ts";

export type Verdict = "worked" | "partial" | "failed";

/** 历史/新形态 → 统一 SkillVerifyTarget | null（引擎层归一，schema 不做 transform） */
export function normalizeVerifyTarget(raw: unknown): SkillVerifyTarget | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw)) {
    const checks = raw.filter((c): c is string => typeof c === "string" && c.length > 0);
    if (checks.length === 0) return null;
    return { statement: checks[0] ?? "", checks };
  }
  if (typeof raw === "object" && typeof (raw as SkillVerifyTarget).statement === "string") {
    const t = raw as SkillVerifyTarget;
    return { statement: t.statement, checks: Array.isArray(t.checks) ? t.checks : [] };
  }
  return null;
}

export interface VerifyResult {
  id: string;
  verdict: Verdict;
  metrics: { use_count: number; worked: number; partial: number; failed: number };
  /** 归一后的核验目标（判定依据；历史 null/空形态为 null） */
  verify_target: SkillVerifyTarget | null;
}

export async function verifySkill(
  skillId: string,
  verdict: Verdict,
  paths?: AgentSignalPaths,
): Promise<VerifyResult> {
  const p = paths ?? resolvePaths();
  const { skills } = await scanSkills(p);
  // 本地 id 一律小写存储；入参可能是平台原始大小写，归一比对
  const skill = skills.find((s) => s.id === skillId.toLowerCase());
  if (!skill) throw new Error(`SKILL_NOT_FOUND: ${skillId}`);

  const raw = await readFile(skill.metaFile, "utf8");
  const parsed = SkillFrontmatterSchema.parse(JSON5.parse(raw));
  const m = parsed.lifecycle.metrics;
  const next = {
    use_count: m.use_count + 1,
    worked: m.worked + (verdict === "worked" ? 1 : 0),
    partial: m.partial + (verdict === "partial" ? 1 : 0),
    failed: m.failed + (verdict === "failed" ? 1 : 0),
  };
  parsed.lifecycle.metrics = next;

  const tmp = `${skill.metaFile}.tmp-${process.pid}`;
  await writeFile(tmp, JSON5.stringify(parsed, null, 2), "utf8");
  await rename(tmp, skill.metaFile);
  return {
    id: skill.id,
    verdict,
    metrics: next,
    verify_target: normalizeVerifyTarget(parsed.verify_target),
  };
}
