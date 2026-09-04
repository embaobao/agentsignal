/**
 * ~/.agentsignal/ 布局定档（skill-engine 提案 裁决 4，一次定死进 admin-guide）。
 *
 *   <root>/config.json5     向导的输出（不是用户入口）
 *   <root>/params.json5     全局参数覆盖（参数四来源链第二层）
 *   <root>/skills/<id>/     skill.json5 + SKILL.md（内部形式）
 *   <root>/sessions/<id>.json  Trace（Phase 2，只记录不审计）
 *   <root>/index/           Orama 持久化（带版本号文件，schema 变更整库重建）
 *
 * AGENTSIGNAL_CONFIG 环境变量覆盖 root（夹具测试与多环境用）。
 */
import { homedir } from "node:os";
import path from "node:path";

/** 索引 schema 版本：变更即整库重建（<1000 条毫秒级） */
export const INDEX_VERSION = "1";

export interface AgentSignalPaths {
  root: string;
  configFile: string;
  paramsFile: string;
  skillsDir: string;
  sessionsDir: string;
  indexDir: string;
  indexDumpFile: string;
  indexVersionFile: string;
  /** 双指标累计（bytes/4 口径） */
  metricsFile: string;
}

export function resolvePaths(rootOverride?: string): AgentSignalPaths {
  const root =
    rootOverride ?? process.env.AGENTSIGNAL_CONFIG ?? path.join(homedir(), ".agentsignal");
  const indexDir = path.join(root, "index");
  return {
    root,
    configFile: path.join(root, "config.json5"),
    paramsFile: path.join(root, "params.json5"),
    skillsDir: path.join(root, "skills"),
    sessionsDir: path.join(root, "sessions"),
    indexDir,
    indexDumpFile: path.join(indexDir, "dump.json"),
    indexVersionFile: path.join(indexDir, "version"),
    metricsFile: path.join(root, "metrics.json"),
  };
}

/** token 估算口径（裁决 9）：bytes/4，仅为量级参考 */
export function tokensEst(text: string): number {
  return Math.ceil(Buffer.byteLength(text, "utf8") / 4);
}
