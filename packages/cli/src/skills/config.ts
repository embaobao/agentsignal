/**
 * config.json5 加载器（zod fail-fast + AGENTSIGNAL_CONFIG 覆盖）。
 *
 * config 是 web 向导的输出，不是用户入口；高级用户可手改，此处负责：
 *   1. 原始键检查：layers[] 双写 order = P0 配置错误，fail-fast（zod 会剥离未知键，schema 层探测不到）；
 *   2. zod 校验 fail-fast，错误信息含路径与行内语义；
 *   3. 原子写（tmp + rename）。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { type ConfigLayer, ConfigSchema, type EngineConfig } from "@agentssignal/protocol";
import JSON5 from "json5";
import { type AgentSignalPaths, resolvePaths } from "./paths.ts";

export const CONFIG_MISSING = "CONFIG_MISSING";
export const CONFIG_INVALID = "CONFIG_INVALID";

export class ConfigError extends Error {
  readonly code: typeof CONFIG_MISSING | typeof CONFIG_INVALID;
  constructor(code: typeof CONFIG_MISSING | typeof CONFIG_INVALID, message: string) {
    super(message);
    this.name = "ConfigError";
    this.code = code;
  }
}

/** 默认 config（FooterBar 直通 / CI --yes 与之等价；裁决 12） */
export function defaultConfig(): EngineConfig {
  const nextjsTs: ConfigLayer = {
    id: "domain",
    name: "领域模式",
    description: "按项目技术栈自动检测",
    auto_load: "detect_stack",
    max_tokens: 2000,
    match_threshold: 0.8,
    stack_rules: [
      {
        name: "Next.js + TypeScript",
        match: [
          { file: "package.json", contains: "next" },
          { file: "tsconfig.json", exists: true },
        ],
      },
    ],
  };
  return ConfigSchema.parse({
    layers: [
      {
        id: "base",
        name: "基础规范",
        description: "所有项目所有任务都遵循",
        auto_load: "true",
        max_tokens: 800,
      },
      nextjsTs,
      {
        id: "task",
        name: "任务方案",
        description: "按当前任务动态匹配",
        auto_load: "trigger_match",
        max_tokens: 1500,
        match_threshold: 0.8,
      },
      {
        id: "session",
        name: "临时会话",
        description: "本次对话专用",
        auto_load: "false",
        max_tokens: 1000,
      },
    ],
  });
}

function zodMessage(err: unknown): string {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues: { path: (string | number)[]; message: string }[] }).issues;
    return issues
      .map((i) => `${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`)
      .join("；");
  }
  return err instanceof Error ? err.message : String(err);
}

/** 读取 + fail-fast 校验；文件不存在返回 null（调用方决定是否拉向导） */
export async function loadConfig(
  paths?: AgentSignalPaths,
): Promise<{ config: EngineConfig; raw: string } | null> {
  const p = paths ?? resolvePaths();
  let raw: string;
  try {
    raw = await readFile(p.configFile, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON5.parse(raw);
  } catch (err) {
    throw new ConfigError(CONFIG_INVALID, `config.json5 无法解析：${zodMessage(err)}`);
  }
  // 原始键检查：zod object 默认剥离未知键，order 双写必须在这里抓
  const layers = (parsed as { layers?: { order?: unknown }[] })?.layers;
  if (Array.isArray(layers) && layers.some((l) => l && "order" in l)) {
    throw new ConfigError(CONFIG_INVALID, "P0 配置错误：layers 数组即顺序，禁止双写 order 字段");
  }
  const result = ConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigError(CONFIG_INVALID, `config.json5 校验失败：${zodMessage(result.error)}`);
  }
  return { config: result.data, raw };
}

/** 原子写（tmp + rename；多宿主并发口径） */
export async function writeConfigAtomic(
  config: EngineConfig,
  paths?: AgentSignalPaths,
): Promise<string> {
  const p = paths ?? resolvePaths();
  await mkdir(p.root, { recursive: true });
  const tmp = `${p.configFile}.tmp-${process.pid}`;
  await writeFile(tmp, JSON5.stringify(config, null, 2), "utf8");
  await rename(tmp, p.configFile);
  return p.configFile;
}

/** 一次性建齐 ~/.agentsignal 布局 */
export async function ensureLayout(paths: AgentSignalPaths): Promise<void> {
  for (const dir of [paths.root, paths.skillsDir, paths.sessionsDir, paths.indexDir]) {
    await mkdir(dir, { recursive: true });
  }
}
