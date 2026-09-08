/**
 * use --install 单条装载（dynamic-skill-management P1.1）。
 *
 * 信封 → transcode → 落库 skills/<sig_id>/（skill.json5 + SKILL.md，tmp+rename 原子写）
 * → 重建本地索引（本地库小，全量重建即落库后最低风险的索引刷新路径）。
 * 纯本地路径零网络——网络发生在 index.ts use 分支，此处只收已取回的信号对象。
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";
import { buildIndex, saveIndex, scanSkills } from "./store.ts";
import { type TranscodeContext, type TranscodeInput, transcodeSignal } from "./transcoder.ts";

export interface InstallResult {
  /** 技能目录绝对路径（skills/<sig_id>/） */
  dir: string;
  /** 落库后本地库技能总数 */
  count: number;
}

export async function installSignal(
  input: TranscodeInput,
  ctx: TranscodeContext,
  paths?: AgentSignalPaths,
): Promise<InstallResult> {
  const { frontmatter, body } = transcodeSignal(input, ctx);
  const p = paths ?? resolvePaths();
  const dir = path.join(p.skillsDir, frontmatter.id);
  await mkdir(dir, { recursive: true });

  const metaTmp = path.join(dir, `skill.json5.tmp-${process.pid}`);
  await writeFile(metaTmp, JSON5.stringify(frontmatter, null, 2), "utf8");
  await rename(metaTmp, path.join(dir, "skill.json5"));
  const bodyTmp = path.join(dir, `SKILL.md.tmp-${process.pid}`);
  await writeFile(bodyTmp, body, "utf8");
  await rename(bodyTmp, path.join(dir, "SKILL.md"));

  const { skills } = await scanSkills(p);
  await saveIndex(await buildIndex(skills), p);
  return { dir, count: skills.length };
}
