/**
 * apm.yml 导出器（local-capability-plane P4 · 4.1，S10 互操作往返的出口侧）。
 *
 * 本地技能 → apm.yml（对齐 APM 语义的标准清单，零工具可读）+ .apm/skills/<id>/SKILL.md
 * （产物格式复用 renderArtifactSkillMd——首部 name/description + 正文）。
 * 铁律（S10）：私有元数据（layers/triggers/domains/provenance/溯源站点）**零泄漏进产物**。
 * 确定性：同输入两次导出字节级一致（无时间戳/无序化噪声——按传入 id 序输出）。
 * 未知 id 结构化跳过（不抛不阻塞整体，对齐降级纪律）。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { type AgentSignalPaths, resolvePaths } from "../skills/paths.ts";
import { type SkillRecord, scanSkills } from "../skills/store.ts";
import { renderArtifactSkillMd } from "../skills/transcoder.ts";

/** 导出结果：实际写出的文件绝对路径清单 */
export async function exportApm(
  ids: readonly string[],
  outDir: string,
  paths?: AgentSignalPaths,
): Promise<string[]> {
  const p = paths ?? resolvePaths();
  const { skills } = await scanSkills(p);
  const byId = new Map(skills.map((s) => [s.id, s]));
  const picked: SkillRecord[] = [];
  for (const id of ids) {
    const s = byId.get(id.toLowerCase());
    if (s) picked.push(s); // 未知 id 结构化跳过（导出清单是尽力而为，不阻塞整体）
  }

  const written: string[] = [];
  // .apm/skills/<id>/SKILL.md（产物零工具可读）
  for (const s of picked) {
    const raw = await readFile(s.bodyFile, "utf8");
    // 正文剥内部首部（若有）再按产物格式重渲染——导出物永远干净
    const body = raw.replace(
      /^---\nname: ("(?:[^"\\]|\\.)*")\ndescription: ("(?:[^"\\]|\\.)*")\n---\n\n/,
      "",
    );
    const dir = path.join(outDir, ".apm", "skills", s.id);
    await mkdir(dir, { recursive: true });
    const tmp = path.join(dir, `SKILL.md.tmp-${process.pid}`);
    await writeFile(tmp, renderArtifactSkillMd(s.id, s.description, body), "utf8");
    await rename(tmp, path.join(dir, "SKILL.md"));
    written.push(path.join(dir, "SKILL.md"));
  }

  // apm.yml（标准段：name/version/skills——零私有键；确定性输出）
  const lines = [
    "name: agentsignal-export",
    "version: 0.1.0",
    ...(picked.length > 0 ? ["skills:"] : ["skills: []"]),
  ];
  for (const s of picked) {
    lines.push(`  - name: ${s.id}`);
    lines.push(`    path: .apm/skills/${s.id}/SKILL.md`);
  }
  await mkdir(outDir, { recursive: true });
  const ytmp = path.join(outDir, `apm.yml.tmp-${process.pid}`);
  await writeFile(ytmp, `${lines.join("\n")}\n`, "utf8");
  await rename(ytmp, path.join(outDir, "apm.yml"));
  written.push(path.join(outDir, "apm.yml"));
  return written;
}
