/**
 * 本地 verify（裁决 5/10）：verdict 只写本地 lifecycle.metrics，不回传平台。
 * 用户域暂缓（不做登录/token 鉴权）；Phase 3 接 creds 后回传聚合。
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { SkillFrontmatterSchema } from "@agentssignal/protocol";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";
import { scanSkills } from "./store.ts";

export type Verdict = "worked" | "partial" | "failed";

export interface VerifyResult {
  id: string;
  verdict: Verdict;
  metrics: { use_count: number; worked: number; partial: number; failed: number };
}

export async function verifySkill(
  skillId: string,
  verdict: Verdict,
  paths?: AgentSignalPaths,
): Promise<VerifyResult> {
  const p = paths ?? resolvePaths();
  const { skills } = await scanSkills(p);
  const skill = skills.find((s) => s.id === skillId);
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
  return { id: skillId, verdict, metrics: next };
}
