/**
 * skills/ 扫描 + Orama 索引（store）。
 *
 *   - 扫描 <root>/skills/<id>/：skill.json5（zod 校验，坏目录跳过并收集错误）+ SKILL.md 字节数；
 *   - Orama 索引：mandarin 分词（Intl.Segmenter），schema 留向量位；
 *   - 持久化：dump.json + version 文件，tmp+rename 原子写；版本不符 → 整库重建。
 */
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type SkillFrontmatter,
  SkillFrontmatterSchema,
  type TriggerRule,
} from "@agentssignal/protocol";
import { type AnyOrama, create, insert, load, save, search } from "@orama/orama";
import { createTokenizer } from "@orama/tokenizers/mandarin";
import JSON5 from "json5";
import { type AgentSignalPaths, INDEX_VERSION, resolvePaths } from "./paths.ts";

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  domains: string[];
  layers: string[];
  keywords: string[];
  triggers: TriggerRule[];
  dependencies: { env: string[]; bins: string[]; packages: string[] };
  /** mustache 参数声明（四来源链解析用） */
  params: SkillFrontmatter["parameters"];
  verify_target: string[];
  lifecycle: SkillFrontmatter["lifecycle"];
  /** skill.json5 绝对路径 */
  metaFile: string;
  /** SKILL.md 绝对路径 */
  bodyFile: string;
  bodyBytes: number;
}

export interface ScanErrors {
  dir: string;
  message: string;
}

/** 扫描本地技能库；单目录损坏不阻塞整体（错误列表上报 status） */
export async function scanSkills(paths?: AgentSignalPaths): Promise<{
  skills: SkillRecord[];
  errors: ScanErrors[];
}> {
  const p = paths ?? resolvePaths();
  let dirs: string[];
  try {
    dirs = await readdir(p.skillsDir);
  } catch {
    return { skills: [], errors: [] };
  }
  const skills: SkillRecord[] = [];
  const errors: ScanErrors[] = [];
  for (const dir of dirs) {
    const metaFile = path.join(p.skillsDir, dir, "skill.json5");
    try {
      const raw = await readFile(metaFile, "utf8");
      const parsed = SkillFrontmatterSchema.parse(JSON5.parse(raw));
      const bodyFile = path.join(p.skillsDir, dir, path.basename(parsed.content.path));
      let bodyBytes = 0;
      try {
        bodyBytes = (await stat(bodyFile)).size;
      } catch {
        errors.push({ dir, message: `正文缺失：${path.basename(parsed.content.path)}` });
        continue;
      }
      skills.push({
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        domains: parsed.domains,
        layers: parsed.layers,
        keywords: parsed.keywords,
        triggers: parsed.triggers,
        dependencies: parsed.dependencies,
        params: parsed.parameters,
        verify_target: parsed.verify_target,
        lifecycle: parsed.lifecycle,
        metaFile,
        bodyFile,
        bodyBytes,
      });
    } catch (err) {
      errors.push({
        dir,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { skills, errors };
}

/* ------------------------------- Orama 索引 ------------------------------- */

// embedding: "vector[1536]" 留位：向量检索启用时解注释（裁决 1）
export const ORAMA_SCHEMA = {
  id: "string",
  name: "string",
  description: "string",
  keywords: "string[]",
  domain: "string",
  layer: "string",
} as const;

export type SkillDb = AnyOrama;

async function newDb(): Promise<SkillDb> {
  return create({
    schema: ORAMA_SCHEMA,
    components: { tokenizer: await createTokenizer({ language: "mandarin" }) },
  });
}

export async function buildIndex(skills: SkillRecord[]): Promise<SkillDb> {
  const db = await newDb();
  for (const s of skills) {
    await insert(db, {
      id: s.id,
      name: s.name,
      description: s.description,
      keywords: s.keywords,
      domain: s.domains[0] ?? "common",
      layer: s.layers[0] ?? "task",
    });
  }
  return db;
}

/** dump.json + version 双文件原子写（tmp+rename） */
export async function saveIndex(db: SkillDb, paths?: AgentSignalPaths): Promise<void> {
  const p = paths ?? resolvePaths();
  await mkdir(p.indexDir, { recursive: true });
  const dump = JSON.stringify(await save(db));
  const tmpDump = `${p.indexDumpFile}.tmp-${process.pid}`;
  const tmpVer = `${p.indexVersionFile}.tmp-${process.pid}`;
  await writeFile(tmpDump, dump, "utf8");
  await writeFile(tmpVer, INDEX_VERSION, "utf8");
  await rename(tmpDump, p.indexDumpFile);
  await rename(tmpVer, p.indexVersionFile);
}

/**
 * 启动加载：只读加载持久化索引；version 不符/损坏/条数漂移 → 整库重建（不阻塞 READY）。
 * 返回 rebuilt 供状态机 DEGRADED 旁路与 status 展示。
 */
export async function ensureIndex(
  skills: SkillRecord[],
  paths?: AgentSignalPaths,
): Promise<{ db: SkillDb; rebuilt: boolean }> {
  const p = paths ?? resolvePaths();
  try {
    const [version, dump] = await Promise.all([
      readFile(p.indexVersionFile, "utf8"),
      readFile(p.indexDumpFile, "utf8"),
    ]);
    if (version.trim() !== INDEX_VERSION) throw new Error("index version mismatch");
    const db = await newDb();
    await load(db, JSON.parse(dump));
    return { db, rebuilt: false };
  } catch {
    const db = await buildIndex(skills);
    await saveIndex(db, p);
    return { db, rebuilt: true };
  }
}

export async function oramaSearch(
  db: SkillDb,
  term: string,
  limit = 10,
): Promise<{ id: string; score: number }[]> {
  const result = await search(db, { term, limit });
  const max = Math.max(...result.hits.map((h) => h.score), 0);
  return result.hits.map((h) => ({
    id: String((h.document as { id: string }).id),
    score: max > 0 ? h.score / max : 0,
  }));
}
