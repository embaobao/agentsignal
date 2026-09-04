/**
 * 引擎工厂：createEngine = CLI 内部唯一引擎单例入口（MCP 九工具与推通道共享）。
 *
 *   createEngine(root?) → { config, skills, search, buildContext, loadDetail, verify, stats }
 *
 * config 缺失时抛 ConfigError(CONFIG_MISSING)，由调用方决定进 WAITING_CONFIG 拉向导
 * 或 --yes 直通（MCP 状态机 BOOTING 分支）。
 */

import type { EngineConfig } from "@agentssignal/protocol";
import {
  CONFIG_MISSING,
  ConfigError,
  defaultConfig,
  ensureLayout,
  loadConfig,
  writeConfigAtomic,
} from "./config.ts";
import { buildContext as buildContextImpl, domainFilter } from "./layers.ts";
import { type LoadResult, loadDetail as loadDetailImpl } from "./loader.ts";
import { type AgentSignalPaths, resolvePaths, tokensEst } from "./paths.ts";
import { type SearchHit, type SearchInput, searchSkills as searchImpl } from "./retriever.ts";
import type { SkillDb } from "./store.ts";
import { ensureIndex, type SkillRecord, scanSkills } from "./store.ts";
import { type Verdict, type VerifyResult, verifySkill as verifyImpl } from "./verify.ts";

export interface EngineStats {
  skill_count: number;
  error_count: number;
  index_rebuilt: boolean;
  /** 吞吐/残留双指标的数据源（bytes/4 口径，裁决 9） */
  bytes_total: number;
}

export interface Engine {
  paths: AgentSignalPaths;
  config: EngineConfig;
  skills: SkillRecord[];
  index: SkillDb;
  /** 本次启动是否整库重建（DEGRADED 旁路） */
  indexRebuilt: boolean;
  scanErrors: { dir: string; message: string }[];
  search(input: SearchInput): Promise<SearchHit[]>;
  buildContext(search?: SearchInput, projectRoot?: string): ReturnType<typeof buildContextImpl>;
  loadDetail(id: string, projectRoot?: string): Promise<LoadResult>;
  verify(id: string, verdict: Verdict): Promise<VerifyResult>;
  stats(): EngineStats;
  /** Domain Filter 出口（推通道/session 层复用） */
  scopedSkills(): SkillRecord[];
}

export async function createEngine(
  rootOverride?: string,
  options: { reindex?: boolean } = {},
): Promise<Engine> {
  const paths = resolvePaths(rootOverride);
  const loaded = await loadConfig(paths);
  if (!loaded) {
    throw new ConfigError(
      CONFIG_MISSING,
      `config 不存在：${paths.configFile}（首次使用请运行 agentsignal init）`,
    );
  }
  const { skills, errors } = await scanSkills(paths);
  const { db, rebuilt } = options.reindex
    ? { ...(await ensureIndex(skills, paths)), rebuilt: true }
    : await ensureIndex(skills, paths);

  return {
    paths,
    config: loaded.config,
    skills,
    index: db,
    indexRebuilt: rebuilt,
    scanErrors: errors,
    search(input) {
      return searchImpl(db, skills, input);
    },
    buildContext(search, projectRoot) {
      return buildContextImpl({
        paths,
        config: loaded.config,
        skills,
        db,
        search,
        projectRoot,
      });
    },
    loadDetail(id, projectRoot) {
      return loadDetailImpl(id, paths, projectRoot);
    },
    verify(id, verdict) {
      return verifyImpl(id, verdict, paths);
    },
    stats() {
      return {
        skill_count: skills.length,
        error_count: errors.length,
        index_rebuilt: rebuilt,
        bytes_total: skills.reduce((acc, s) => acc + s.bodyBytes, 0),
      };
    },
    scopedSkills() {
      return domainFilter(skills, loaded.config);
    },
  };
}

export { tokensEst };

/** --yes 直通：建布局 + 写默认 config（全默认值 + 探测宿主全接由 wiring 层补） */
export async function bootstrapWithDefaults(
  rootOverride?: string,
): Promise<{ configFile: string; config: EngineConfig }> {
  const paths = resolvePaths(rootOverride);
  await ensureLayout(paths);
  const config = defaultConfig();
  const configFile = await writeConfigAtomic(config, paths);
  return { configFile, config };
}
