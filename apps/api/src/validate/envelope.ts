/**
 * 软校验流水线 —— 不拦发布，只标记（digest_valid / section_rate / warnings）。
 *
 * 设计口径（backend-architecture §四 + web-ia 零假数据）：
 * 校验是「质量提示」而非「准入门禁」。真正的准入在 Token Firewall 的 Server Filter
 * （发布权 / TTL / 限频 / body 上限），这里是第二道软提示。
 */
import type { ValidateResponse } from "@agentsignal/protocol";

/** 四节模板（experience.md 解剖共识） */
export const FOUR_SECTIONS = ["Why", "What worked", "Evidence", "Caveats"] as const;

/** digest 三段式：<claim> | scope: <适用范围> | validation: <none|self-tested|battle-tested> */
const DIGEST_RE =
  /^(?<claim>[^|]+)\|\s*scope:\s*(?<scope>[^|]+)\|\s*validation:\s*(?<v>none|self-tested|battle-tested)\s*$/;

export function checkSections(body: string): { hits: string[]; rate: number } {
  const hits = FOUR_SECTIONS.filter((s) => new RegExp(`^##\\s+${s}\\b`, "im").test(body));
  return { hits, rate: hits.length / FOUR_SECTIONS.length };
}

export function checkDigest(digest: string): {
  valid: boolean;
  warnings: ValidateResponse["warnings"];
} {
  const warnings: ValidateResponse["warnings"] = [];
  const m = DIGEST_RE.exec(digest.trim());
  if (!m) {
    warnings.push({
      code: "digest_format",
      message:
        "digest 应为三段式：<claim> | scope: <适用范围> | validation: <none|self-tested|battle-tested>",
      level: "warn",
    });
    return { valid: false, warnings };
  }
  if ((m.groups?.claim ?? "").trim().length < 8) {
    warnings.push({
      code: "digest_claim_short",
      message: "claim 段过短，Agent 难以据此判断是否值得展开",
      level: "info",
    });
  }
  return { valid: true, warnings };
}

/** 完整校验入口（供 POST /validate/envelope 与 publish 流水线共用） */
export function validateEnvelope(input: {
  digest: string;
  body?: string;
  tokens_est?: number;
}): ValidateResponse {
  const digestRes = checkDigest(input.digest);
  const section = checkSections(input.body ?? "");
  const warnings = [...digestRes.warnings];

  if (input.body !== undefined) {
    if (section.rate < 0.5) {
      warnings.push({
        code: "sections_sparse",
        message: `四节模板命中 ${section.hits.length}/4，建议补齐：${FOUR_SECTIONS.filter((s) => !section.hits.includes(s)).join(" / ")}`,
        level: "warn",
      });
    }
    if (input.body.length > 20_000) {
      warnings.push({
        code: "body_long",
        message: "正文过长（>20k 字符），建议拆分或提炼摘要",
        level: "info",
      });
    }
  }
  if (input.tokens_est !== undefined && input.tokens_est > 8_000) {
    warnings.push({
      code: "tokens_high",
      message: "tokens_est 偏高，会抬高订阅方的过滤阈值",
      level: "info",
    });
  }

  return {
    valid: digestRes.valid && warnings.every((w) => w.level !== "warn"),
    digest_valid: digestRes.valid,
    section_hits: section.hits,
    section_rate: section.rate,
    warnings,
  };
}
