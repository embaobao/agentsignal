/**
 * 本地技能引擎 schema 真源（skill-engine 提案 · 1.2）。
 *
 * 两个文件共用本文件：
 *   1. skill.json5 —— 技能信封（内部形式，不进用户心智；见 docs/decisions/2026-09-02-skill-envelope.md）
 *      位于 ~/.agentsignal/skills/<id>/skill.json5，正文在同级 SKILL.md（content.path 可覆写）。
 *   2. config.json5 —— ~/.agentsignal/config.json5，web 向导的输出（不是用户入口）。
 *
 * 纪律：
 *   - zod v4：不使用 transform+pipe（unknown 输入下类型不收敛），解析逻辑归引擎层；
 *   - 必收字段 = Frontmatter 六字段：id / name / description / domains / layers / triggers；
 *   - 其余 AgentSignal 扩展全部 optional 且带安全默认（.default），引擎读取永不判空；
 *   - lifecycle.provenance：sig_id/digest/origin/published_at 为 skill-envelope 裁决 4 留位；
 *     2026-09-08 起订阅落库填充并扩展 base_url/topic/validation/synced_at
 *     （[dynamic-skill-management 决议](../../../docs/decisions/2026-09-08-dynamic-skill-management.md) 裁决 2）。
 */

import { z } from "zod";
import { ValidationLevelSchema, validationLevels } from "./schemas.ts";

/* ------------------------------- 枚举与常量 ------------------------------- */

/** validation 三档：真源在 schemas.ts（线上信封 v0.2 同词表），此处显式再导出消桶文件歧义 */
export { ValidationLevelSchema, validationLevels };

/** 技能生命周期状态（Zep 机制：孵化 → 沉淀 → 归档） */
export const skillStatuses = ["incubating", "solidified", "archived"] as const;

/** 层加载语义（config.layers[].auto_load 与技能分层共用同一词表） */
export const autoLoadModes = ["true", "detect_stack", "trigger_match", "false"] as const;

/** trigger 规则可用字段（检索上下文的来源） */
export const triggerFields = ["task", "stack", "domain", "keyword"] as const;

/** trigger 规则操作符 */
export const triggerOperators = ["contains_any", "includes", "equals"] as const;

/** 参数类型（mustache 渲染前的解析口径） */
export const parameterTypes = ["string", "number", "boolean", "duration"] as const;

/** 技能 id：目录名 + 引用键，小写 slug（下划线/连字符），如 skill_auth_jwt */
export const SKILL_ID_PATTERN = /^[a-z][a-z0-9_-]*$/;

/** 内置分层 id（自定义层允许，但引擎按 config.layers 数组索引序处理） */
export const builtinLayerIds = ["base", "domain", "task", "session"] as const;

/** 层 token 预算上限（防止误配把上下文打爆） */
export const LAYER_MAX_TOKENS_CEILING = 8192;

/* ------------------------------- trigger 规则 ------------------------------- */

export const TriggerRuleSchema = z.object({
  field: z.enum(triggerFields),
  operator: z.enum(triggerOperators),
  values: z.array(z.string().min(1)).min(1),
  weight: z.number().min(0).max(1).default(1),
});

/* ------------------------------- skill.json5 ------------------------------- */

export const SkillParametersSchema = z.record(
  z.string(),
  z.object({
    type: z.enum(parameterTypes),
    description: z.string().optional(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  }),
);

export const SkillDependenciesSchema = z
  .object({
    /** 环境变量名（存在性预检，不读值） */
    env: z.array(z.string()).default([]),
    /** 可执行文件（PATH 预检） */
    bins: z.array(z.string()).default([]),
    /** 包名声明（仅提示，不做安装） */
    packages: z.array(z.string()).default([]),
  })
  .default({ env: [], bins: [], packages: [] });

export const SkillProvenanceSchema = z.object({
  /** 源 sig_<ulid>（订阅 kind=solution 落盘时写入） */
  sig_id: z.string().optional(),
  digest: z.string().optional(),
  origin: z.object({ kind: z.string(), ref: z.string(), path: z.string().optional() }).optional(),
  published_at: z.string().optional(),
  // === 2026-09-08 dynamic-skill-management 扩展（订阅落库溯源全录，全部 optional）===
  /** 技能来源站点（回流镜像 verify 时据此回传） */
  base_url: z.string().optional(),
  topic: z.string().optional(),
  validation: z.enum(validationLevels).optional(),
  /** 最近一次同步时间（ISO 8601） */
  synced_at: z.string().optional(),
});

export const skillSyncStates = ["active", "outdated", "revoked"] as const;

export const SkillLifecycleSchema = z
  .object({
    status: z.enum(skillStatuses).default("incubating"),
    provenance: SkillProvenanceSchema.optional(),
    metrics: z
      .object({
        use_count: z.number().int().min(0).default(0),
        worked: z.number().int().min(0).default(0),
        partial: z.number().int().min(0).default(0),
        failed: z.number().int().min(0).default(0),
      })
      .default({ use_count: 0, worked: 0, partial: 0, failed: 0 }),
    /** 订阅同步状态（dynamic-skill-management P3：源信号有更新/失效时由同步器改写） */
    sync_state: z.enum(skillSyncStates).default("active"),
    /** 锚定到本技能的平台更新记录（更新正文在同目录 UPDATES.md 附加层） */
    updates: z
      .array(z.object({ sig_id: z.string(), digest: z.string(), synced_at: z.string() }))
      .default([]),
  })
  .default({
    status: "incubating",
    metrics: { use_count: 0, worked: 0, partial: 0, failed: 0 },
    sync_state: "active",
    updates: [],
  });

/** skill.json5 —— Frontmatter 六字段必收 + 扩展 optional 安全默认 */
export const SkillFrontmatterSchema = z.object({
  // === 必收六字段 ===
  id: z.string().regex(SKILL_ID_PATTERN, "id 须为小写 slug（[a-z][a-z0-9_-]*）"),
  name: z.string().min(1),
  description: z.string().min(1),
  /** 业务域；含 "common" 表示全域可见 */
  domains: z.array(z.string().min(1)).min(1),
  /** 归属分层 id（须存在于 config.layers） */
  layers: z.array(z.string().min(1)).min(1),
  /** 触发规则：检索主路径（weighted 求和过 match_threshold） */
  triggers: z.array(TriggerRuleSchema),

  // === AgentSignal 扩展（optional 安全默认）===
  /** keywords：trigger 缺省时的 fallback 规则源 */
  keywords: z.array(z.string()).default([]),
  version: z.string().default("0.1.0"),
  dependencies: SkillDependenciesSchema,
  /** mustache 参数声明（四来源链解析） */
  parameters: SkillParametersSchema.default({}),
  /** verify_target：verify_skill 的可核验目标清单 */
  verify_target: z.array(z.string()).default([]),
  /** 正文引用（正文存储在同级 SKILL.md） */
  content: z
    .object({
      format: z.string().default("markdown"),
      path: z.string().default("./SKILL.md"),
      tokens_est: z.number().int().min(0).optional(),
    })
    .default({ format: "markdown", path: "./SKILL.md" }),
  lifecycle: SkillLifecycleSchema,
});

/* ------------------------------- 产物 frontmatter（local-capability-plane P0） ------------------------------- */

/**
 * 产物 frontmatter —— 落到宿主技能目录的 SKILL.md 首部，**零工具可读**
 * （APM / skills-manager 等外部工具直接消费，D3 保留 APM 原则 P1「不发明私有 frontmatter」）。
 *
 * 与内部形式 SkillFrontmatterSchema 的边界：
 *   - 标准字段仅 name / description，均必填；name 须等于落装目录名（parseArtifactFrontmatter 校验）；
 *   - 私有层字段（id/domains/layers/triggers/keywords/verify_target/lifecycle 等检索与
 *     分层元数据）**不进产物 schema**，只存内部形式 skill.json5；产物侧出现时按 zod
 *     未知键默认行为剥离（零泄漏语义，S10 同款）。
 */
export const ArtifactFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

/** 产物 frontmatter 校验入口：schema 解析 + 可选目录名一致性（不一致即抛错，错误含目录名） */
export function parseArtifactFrontmatter(raw: unknown, expectedDirName?: string) {
  const parsed = ArtifactFrontmatterSchema.parse(raw);
  if (expectedDirName !== undefined && parsed.name !== expectedDirName) {
    throw new Error(
      `产物 frontmatter name（${parsed.name}）≠ 落装目录名（${expectedDirName}）——产物 name 必须等于目录名`,
    );
  }
  return parsed;
}

/* ------------------------------- 订阅（dynamic-skill-management） ------------------------------- */

/** 单条订阅：pull 式同步的最小声明（无常驻进程，游标 = 最后同步的 sig id） */
export const SubscriptionSchema = z.object({
  topic: z.string().min(1),
  /** 游标（sig_<ulid>）；缺省 = 从头同步 */
  cursor: z.string().optional(),
  /** 同步过滤阈值：validation 低于阈值的 solution 不落库 */
  min_validation: z.enum(validationLevels).default("none"),
});

/** config.json5 sync 段：订阅 + 回流镜像开关 + 容量上限（安全默认，旧 config 零破坏） */
export const SyncStateSchema = z.object({
  subscriptions: z.array(SubscriptionSchema).default([]),
  /** verify_skill 本地裁决后自动镜像平台 verify（默认 false，手动优先——决议裁决 4） */
  mirror_verify: z.boolean().default(false),
  /** 本地技能库容量上限（超限只告警 + 管理界面列清理候选，不自动删） */
  max_skills: z.number().int().min(1).default(200),
});

/* ------------------------------- config.json5 ------------------------------- */

/** config.layers[] 元素：数组即顺序（order 双写的 fail-fast 由引擎加载器检查原始 JSON5 键——zod object 默认剥离未知键，schema 层探测不到） */
export const ConfigLayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  auto_load: z.enum(autoLoadModes),
  max_tokens: z.number().int().min(0).max(LAYER_MAX_TOKENS_CEILING),
  /** trigger_match 层的过阈值 */
  match_threshold: z.number().min(0).max(1).default(0.8),
  /** detect_stack 层的栈规则组（MVP 只内置 Next.js+TS） */
  stack_rules: z
    .array(
      z.object({
        name: z.string().min(1),
        /** 全部命中才加载该组 */
        match: z.array(
          z.object({
            file: z.string().min(1),
            exists: z.boolean().optional(),
            contains: z.string().optional(),
          }),
        ),
      }),
    )
    .default([]),
});

/** 宿主接线声明（wiring 探测/写入的产物，config 是唯一真源） */
export const HostBindingSchema = z.object({
  /** 宿主标识：claude-code | cursor | codex | cline | gemini | hermes（host-matrix-alignment Phase 1 起） */
  host: z.enum(["claude-code", "cursor", "codex", "cline", "gemini", "hermes"]),
  wired: z.boolean().default(false),
  /** 实际写入的配置文件绝对路径 */
  config_path: z.string().optional(),
});

/** ~/.agentsignal/config.json5 —— web 向导的输出 */
export const ConfigSchema = z.object({
  version: z.string().default("1.0.0"),
  domains: z
    .object({
      /** 当前激活域；空 = 通用 */
      current: z.string().default("common"),
      available: z.array(z.string().min(1)).default(["common"]),
    })
    .default({ current: "common", available: ["common"] }),
  /** 分层：数组即顺序，即优先级，即加载链 */
  layers: z.array(ConfigLayerSchema).min(1),
  hosts: z.array(HostBindingSchema).default([]),
  arbitration: z
    .object({
      strategy: z.enum(["lru"]).default("lru"),
      fallback: z.enum(["compress"]).default("compress"),
    })
    .default({ strategy: "lru", fallback: "compress" }),
  /** 订阅落库 × 回流闭环（dynamic-skill-management；缺省安全默认） */
  sync: SyncStateSchema.default({ subscriptions: [], mirror_verify: false, max_skills: 200 }),
});

/* ------------------------------- 类型导出 ------------------------------- */

export type TriggerRule = z.infer<typeof TriggerRuleSchema>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
export type ArtifactFrontmatter = z.infer<typeof ArtifactFrontmatterSchema>;
export type SkillParameters = z.infer<typeof SkillParametersSchema>;
export type ConfigLayer = z.infer<typeof ConfigLayerSchema>;
export type HostBinding = z.infer<typeof HostBindingSchema>;
export type EngineConfig = z.infer<typeof ConfigSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type SyncState = z.infer<typeof SyncStateSchema>;
