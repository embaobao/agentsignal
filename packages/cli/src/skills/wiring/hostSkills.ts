/**
 * 宿主 skills 目录式落盘（host-matrix-alignment 1.2，Hermes 首个消费方）。
 *
 * 产物语义（P0 契约延续）：宿主侧只有 SKILL.md（首部产物 frontmatter + 正文，
 * 零工具可读），渲染复用 transcoder.renderArtifactSkillMd——内部形式 skill.json5
 * 不出本地库（零泄漏）。id 白名单 = SKILL_ID_PATTERN（防路径穿越，与本地库同规）。
 * 写盘 tmp+rename 原子写；卸载只删自己条目、零残留（对账五态的 missing 由 P2 对账器判定）。
 */
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SKILL_ID_PATTERN } from "@agentssignal/protocol";
import { renderArtifactSkillMd } from "../transcoder.ts";

function assertLegalId(id: string): void {
  if (!SKILL_ID_PATTERN.test(id)) {
    throw new Error(`非法宿主技能 id："${id}"——须为小写 slug（${SKILL_ID_PATTERN.source}）`);
  }
}

/** 落盘单个技能到宿主 skills 目录：返回技能目录绝对路径（同 id 幂等覆盖） */
export async function writeHostSkill(
  hostSkillsDir: string,
  id: string,
  description: string,
  body: string,
): Promise<string> {
  assertLegalId(id);
  const dir = path.join(hostSkillsDir, id);
  await mkdir(dir, { recursive: true });
  const md = renderArtifactSkillMd(id, description, body);
  const tmp = path.join(dir, `SKILL.md.tmp-${process.pid}`);
  await writeFile(tmp, md, "utf8");
  await rename(tmp, path.join(dir, "SKILL.md"));
  return dir;
}

/** 从宿主 skills 目录卸载单个技能：只删自己条目、零残留；不存在返回 false */
export async function removeHostSkill(hostSkillsDir: string, id: string): Promise<boolean> {
  assertLegalId(id);
  const dir = path.join(hostSkillsDir, id);
  try {
    const entries = await readdir(dir);
    if (!entries.includes("SKILL.md")) return false; // 非我方落盘形态（foreign），不动
    await rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
