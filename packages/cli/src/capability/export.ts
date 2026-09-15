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
import { parseArtifactFrontmatter, SkillFrontmatterSchema } from "@agentssignal/protocol";
import JSON5 from "json5";
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
  // 扩展文件（P4 4.3）：私有增强独立文件，不污染标准清单——S10「往返无损」的私有侧载体
  const extensions: Record<string, Record<string, unknown>> = {};
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
    extensions[s.id] = {
      domains: s.domains,
      layers: s.layers,
      triggers: s.triggers,
      keywords: s.keywords,
      verify_target: s.verify_target,
    };
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
  await mkdir(path.join(outDir, ".apm"), { recursive: true });
  const extTmp = path.join(outDir, ".apm", `extensions.json5.tmp-${process.pid}`);
  await writeFile(extTmp, JSON5.stringify({ skills: extensions }, null, 2), "utf8");
  await rename(extTmp, path.join(outDir, ".apm", "extensions.json5"));
  written.push(path.join(outDir, ".apm", "extensions.json5"));
  await mkdir(outDir, { recursive: true });
  const ytmp = path.join(outDir, `apm.yml.tmp-${process.pid}`);
  await writeFile(ytmp, `${lines.join("\n")}\n`, "utf8");
  await rename(ytmp, path.join(outDir, "apm.yml"));
  written.push(path.join(outDir, "apm.yml"));
  return written;
}

/* ------------------------------- 导入器（P4 · 4.2） ------------------------------- */

/** 解析 4.1 输出形态的 apm.yml（行级最小操作——输入契约即自家导出，非通用 YAML 解析器） */
function parseApmYml(text: string): { name: string; skills: { name: string; path: string }[] } {
  const name = /^name: (.+)$/m.exec(text)?.[1] ?? "apm-import";
  const skills: { name: string; path: string }[] = [];
  let current: { name: string; path: string } | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("  - name: ")) {
      if (current) skills.push(current);
      current = { name: line.slice("  - name: ".length).trim(), path: "" };
    } else if (line.startsWith("    path: ") && current) {
      current.path = line.slice("    path: ".length).trim();
    }
  }
  if (current) skills.push(current);
  return { name, skills };
}

export interface ImportResult {
  imported: string[];
  skipped: { id: string; reason: string }[];
}

/**
 * 导入外部 apm 包目录（4.1 导出物或同构 APM 包）：产物 SKILL.md → 内部形式落库。
 * 溯源 origin={kind:"apm-import", ref: yml 包名}（4.2 DoD）；私有层字段（导出时已丢）
 * 以安全默认重建（domains common/layers base/triggers keyword 包名——不从产物回转，S10）。
 * 幂等：同 id 覆盖写。首部经 parseArtifactFrontmatter 校验（name=目录名）。
 */
export async function importApm(inDir: string, paths?: AgentSignalPaths): Promise<ImportResult> {
  const p = paths ?? resolvePaths();
  const ymlText = await readFile(path.join(inDir, "apm.yml"), "utf8");
  const manifest = parseApmYml(ymlText);
  // 扩展文件（4.3）：存在则恢复原始私有字段；不存在走安全默认（4.2 兼容）
  let extSkills: Record<string, Record<string, unknown>> = {};
  try {
    const ext = JSON5.parse(
      await readFile(path.join(inDir, ".apm", "extensions.json5"), "utf8"),
    ) as { skills?: Record<string, Record<string, unknown>> };
    extSkills = ext.skills ?? {};
  } catch {
    // 无扩展文件——安全默认
  }
  const imported: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const entry of manifest.skills) {
    const skillFile = path.join(inDir, entry.path);
    try {
      const raw = await readFile(skillFile, "utf8");
      // 产物首部校验（name=目录名，零工具可读两行 JSON 值形态）+ 正文剥离
      const nameM = /^name: ("(?:[^"\\]|\\.)*")$/m.exec(raw);
      const descM = /^description: ("(?:[^"\\]|\\.)*")$/m.exec(raw);
      if (!nameM || !descM) throw new Error(`产物首部缺失或不合规：${skillFile}`);
      const fm = parseArtifactFrontmatter(
        { name: JSON.parse(nameM[1] as string), description: JSON.parse(descM[1] as string) },
        entry.name,
      );
      const body = raw.replace(/^---\n[\s\S]*?\n---\n\n/, "");
      const dir = path.join(p.skillsDir, entry.name);
      await mkdir(dir, { recursive: true });
      const ext = extSkills[entry.name] ?? {};
      await writeFile(
        path.join(dir, "skill.json5"),
        JSON.stringify(
          SkillFrontmatterSchema.parse({
            id: entry.name,
            name: fm.name,
            description: fm.description,
            domains: (ext.domains as string[] | undefined) ?? ["common"],
            layers: (ext.layers as string[] | undefined) ?? ["base"],
            triggers: (ext.triggers as
              | { field: "keyword"; operator: "contains_any"; values: string[] }[]
              | undefined) ?? [
              { field: "keyword", operator: "contains_any", values: [entry.name, manifest.name] },
            ],
            keywords: (ext.keywords as string[] | undefined) ?? [manifest.name],
            verify_target: (ext.verify_target as string[] | undefined) ?? [],
            lifecycle: { provenance: { origin: { kind: "apm-import", ref: manifest.name } } },
          }),
          null,
          2,
        ),
        "utf8",
      );
      await writeFile(path.join(dir, "SKILL.md"), body, "utf8");
      imported.push(entry.name);
    } catch (err) {
      skipped.push({
        id: entry.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { imported, skipped };
}
