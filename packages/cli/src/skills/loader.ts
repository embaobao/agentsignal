/**
 * 懒加载器：SKILL.md 读取 + 依赖预检 + 参数四来源链 + mustache 渲染。
 *
 * 参数四来源链（优先级从高到低）：
 *   项目级 .agentsignal/params.json5 > ~/.agentsignal/params.json5 > 环境变量 > skill.parameters[].default
 *
 * 依赖预检独立于参数解析：env 存在性 / bins 在 PATH / packages 仅声明提示。
 * required 落空 → 显式报错列出参数名与已查层级（结构化清单，模型可读可重试）。
 */
import { access, constants, readFile } from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import mustache from "mustache";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";
import { type SkillRecord, scanSkills } from "./store.ts";

export interface MissingReport {
  env: string[];
  bins: string[];
  packages: string[];
  params: { name: string; sources_tried: string[] }[];
}

export type LoadResult =
  | { ok: true; id: string; name: string; body: string }
  | {
      ok: false;
      id: string;
      code: "DEPENDENCIES_MISSING" | "PARAMETERS_MISSING";
      missing: MissingReport;
    };

async function readJson5File(file: string): Promise<Record<string, unknown>> {
  try {
    return JSON5.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function binOnPath(bin: string): Promise<boolean> {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    try {
      await access(path.join(dir, bin), constants.X_OK);
      return true;
    } catch {
      /* 继续 */
    }
  }
  return false;
}

/** 参数四来源链；返回解析值与各参数实际来源（缺省时 sources_tried 全链） */
export async function resolveParameters(
  skill: SkillRecord,
  paths: AgentSignalPaths,
  projectRoot?: string,
): Promise<{
  values: Record<string, string | number | boolean>;
  missing: { name: string; sources_tried: string[] }[];
}> {
  const projectFile = path.join(projectRoot ?? process.cwd(), ".agentsignal", "params.json5");
  const [project, home] = await Promise.all([
    readJson5File(projectFile),
    readJson5File(paths.paramsFile),
  ]);
  const values: Record<string, string | number | boolean> = {};
  const missing: { name: string; sources_tried: string[] }[] = [];
  for (const [name, spec] of Object.entries(skill.params ?? {})) {
    const chain: [string, () => string | number | boolean | undefined][] = [
      ["project", () => (name in project ? (project[name] as never) : undefined)],
      ["home", () => (name in home ? (home[name] as never) : undefined)],
      ["env", () => process.env[name]],
      ["default", () => spec?.default],
    ];
    let resolved: string | number | boolean | undefined;
    for (const [, get] of chain) {
      const v = get();
      if (v !== undefined) {
        resolved = v;
        break;
      }
    }
    if (resolved !== undefined) {
      values[name] = resolved;
    } else if (spec?.required) {
      missing.push({
        name,
        sources_tried: [projectFile, paths.paramsFile, `env:${name}`, "default"],
      });
    }
  }
  return { values, missing };
}

export async function loadDetail(
  skillId: string,
  paths?: AgentSignalPaths,
  projectRoot?: string,
): Promise<LoadResult> {
  const p = paths ?? resolvePaths();
  const { skills } = await scanSkills(p);
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) {
    throw new Error(`SKILL_NOT_FOUND: ${skillId}`);
  }

  // 依赖预检（独立）
  const missing: MissingReport = { env: [], bins: [], packages: [], params: [] };
  for (const envName of skill.dependencies.env) {
    if (process.env[envName] === undefined) missing.env.push(envName);
  }
  for (const bin of skill.dependencies.bins) {
    if (!(await binOnPath(bin))) missing.bins.push(bin);
  }
  missing.packages = skill.dependencies.packages; // 仅声明提示，不做安装

  // 参数四来源链
  const { values, missing: missingParams } = await resolveParameters(skill, p, projectRoot);
  missing.params = missingParams;

  if (missing.env.length > 0 || missing.bins.length > 0) {
    return { ok: false, id: skill.id, code: "DEPENDENCIES_MISSING", missing };
  }
  if (missingParams.length > 0) {
    return { ok: false, id: skill.id, code: "PARAMETERS_MISSING", missing };
  }

  const raw = await readFile(skill.bodyFile, "utf8");
  const body = mustache.render(raw, values);
  return { ok: true, id: skill.id, name: skill.name, body };
}
