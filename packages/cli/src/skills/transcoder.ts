/**
 * 信封(solution) → 技能二元组 转换器（dynamic-skill-management P0.3）。
 *
 * 纯函数、零 IO、零 LLM（Zero-LLM 纪律）；映射表见
 * [决议 2026-09-08](../../../../docs/decisions/2026-09-08-dynamic-skill-management.md) 裁决 2：
 *   digest 三段式 → frontmatter（主张→name/description · scope→domains · validation→provenance）
 *   experience.body（四节正文）→ SKILL.md 全文（逐字保留，不重写）
 *   信封头 → lifecycle.provenance（sig_id/digest/base_url/topic/validation/published_at/synced_at）
 * kind≠solution 拒转（update 走更新链，锚定用 extractAnchorSigId 提取）。
 */
import {
  parseArtifactFrontmatter,
  type SkillFrontmatter,
  SkillFrontmatterSchema,
  validationLevels,
} from "@agentssignal/protocol";

export const TRANSCODE_CODES = [
  "KIND_NOT_SOLUTION",
  "NO_BODY",
  "FORMAT_UNSUPPORTED",
  "SCHEMA_INVALID",
] as const;

export type TranscodeCode = (typeof TRANSCODE_CODES)[number];

export class TranscodeError extends Error {
  readonly code: TranscodeCode;
  constructor(code: TranscodeCode, message: string) {
    super(message);
    this.name = "TranscodeError";
    this.code = code;
  }
}

/** 转换输入 = 拉取侧信封的结构子集（不耦合完整 envelope 类型） */
export interface TranscodeInput {
  id: string;
  topic: string;
  kind: string;
  digest: string;
  created_at?: string;
  experience?: { format: string; body: string };
}

export interface TranscodeContext {
  /** 技能来源站点（回流镜像 verify 时据此回传） */
  base_url: string;
  /** 最近一次同步时间（ISO 8601，sync 侧注入） */
  synced_at: string;
}

export interface TranscodeResult {
  /** skill.json5 内容（已过 SkillFrontmatterSchema，转出即合法技能信封） */
  frontmatter: SkillFrontmatter;
  /** SKILL.md 全文（= experience.body 逐字保留） */
  body: string;
}

/** digest 三段式解析：`<主张> | scope: <适用范围> | validation: <档>`（缺段安全回退） */
export function parseDigest(digest: string): {
  claim: string;
  domains: string[];
  validation: (typeof validationLevels)[number];
} {
  const segs = digest.split("|").map((s) => s.trim());
  const claim = (segs[0] ?? "").trim();
  const scopeSeg = segs.find((s) => s.startsWith("scope:"));
  const valSeg = segs.find((s) => s.startsWith("validation:"));
  const domains = (scopeSeg?.slice("scope:".length).trim() ?? "")
    .split("/")
    .map((t) => t.trim())
    .filter(Boolean);
  const rawVal = valSeg?.slice("validation:".length).trim();
  const validation = (validationLevels as readonly string[]).includes(rawVal ?? "")
    ? (rawVal as (typeof validationLevels)[number])
    : "none";
  return { claim, domains: domains.length ? domains : ["common"], validation };
}

/** 从 update digest 提取锚定源信号 id（`anchor: sig_x`；更新链 P3 的输入） */
export function extractAnchorSigId(digest: string): string | null {
  const m = /anchor:\s*(sig_[a-z0-9]+)/i.exec(digest);
  return m?.[1] ?? null;
}

/**
 * 产物 SKILL.md 渲染（local-capability-plane P0.3）：首部产物 frontmatter（零工具可读，
 * 仅 name/description 标准两字段）+ 正文逐字保留。私有增强（layers/triggers/domains 等）
 * 只进内部形式 skill.json5，本函数不收不写。
 * 值用 JSON.stringify 序列化——YAML 1.2 是 JSON 超集，引号/换行/冒号天然安全。
 * 写前过 parseArtifactFrontmatter 校验（含 name = 目录名一致性）。
 */
export function renderArtifactSkillMd(dirName: string, description: string, body: string): string {
  const fm = parseArtifactFrontmatter({ name: dirName, description }, dirName);
  return `---\nname: ${JSON.stringify(fm.name)}\ndescription: ${JSON.stringify(fm.description)}\n---\n\n${body}`;
}

/**
 * 产物首部剥离（renderArtifactSkillMd 的对偶）：注入/MCP 消费侧读正文前剥掉
 * 产物 frontmatter（Token Firewall——name/description 已在工具元信息，正文不重复付费）。
 * 精确匹配本函数族的输出形态（name/description 两行 JSON 值）；旧技能无首部、
 * 正文以 `---` 水平线开头等情形一律原样返回（零破坏，D10 约束 3 语义不变）。
 */
const ARTIFACT_FM_PREFIX =
  /^---\nname: ("(?:[^"\\]|\\.)*")\ndescription: ("(?:[^"\\]|\\.)*")\n---\n\n/;

export function stripArtifactFrontmatter(raw: string): string {
  return raw.replace(ARTIFACT_FM_PREFIX, "");
}

export function transcodeSignal(input: TranscodeInput, ctx: TranscodeContext): TranscodeResult {
  if (input.kind !== "solution") {
    throw new TranscodeError("KIND_NOT_SOLUTION", `kind=${input.kind} 不落技能库（仅 solution）`);
  }
  const body = input.experience?.body ?? "";
  if (!body.trim()) throw new TranscodeError("NO_BODY", `signal ${input.id} 无正文，无法落库`);
  if (input.experience?.format !== "markdown") {
    throw new TranscodeError("FORMAT_UNSUPPORTED", `format=${input.experience?.format} 不支持`);
  }

  const { claim, domains, validation } = parseDigest(input.digest);
  const description = claim || input.digest.trim();
  const triggerValues = [input.topic, ...domains.filter((d) => d !== "common")].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  try {
    const frontmatter = SkillFrontmatterSchema.parse({
      // 本地 id 一律小写（平台 ULID 含大写，技能 id 白名单只收小写 slug）；provenance 保留原始大小写
      id: input.id.toLowerCase(),
      name: description,
      description,
      domains,
      layers: ["base"],
      triggers: [{ field: "keyword", operator: "contains_any", values: triggerValues, weight: 1 }],
      keywords: [input.topic],
      content: { tokens_est: Math.max(1, Math.round(Buffer.byteLength(body) / 4)) },
      lifecycle: {
        provenance: {
          sig_id: input.id,
          digest: input.digest,
          base_url: ctx.base_url,
          topic: input.topic,
          validation,
          ...(input.created_at ? { published_at: input.created_at } : {}),
          synced_at: ctx.synced_at,
        },
      },
    });
    return { frontmatter, body };
  } catch (err) {
    throw new TranscodeError(
      "SCHEMA_INVALID",
      `signal ${input.id} 转出物未过 schema：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
