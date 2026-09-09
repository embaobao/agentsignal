/**
 * 检索器：双路并联（裁决 1/10）。
 *
 *   路 A —— Orama 全文（mandarin 分词，BM25 归一化到 0..1）
 *   路 B —— trigger_conditions 规则打分（weighted 求和过 match_threshold，主路径，中文可控性靠它）
 *   fallback —— keywords（trigger 缺省时的规则源）
 *
 * 并集取各技能最高分排序出 Top-K；source 标注命中路径（中文双路径用例的断言依据）。
 */
import type { SkillRecord } from "./store.ts";
import { oramaSearch, type SkillDb } from "./store.ts";

export interface SearchInput {
  /** 自由文本查询（「登录 认证」） */
  query: string;
  /** 当前任务描述（trigger field=task 的匹配面） */
  task?: string;
  /** 当前项目栈（trigger field=stack 的匹配面，如 ["nextjs","typescript"]） */
  stack?: string[];
  /** 当前激活域（trigger field=domain） */
  domain?: string;
  limit?: number;
  match_threshold?: number;
}

export interface SearchHit {
  id: string;
  name: string;
  description: string;
  score: number;
  source: "orama" | "trigger" | "keywords";
}

const HIT_LIMIT = 10;

/** 查询面分词：中文按 Intl.Segmenter 切，英文按非字母数字切 */
export function tokenizeText(text: string): string[] {
  const lower = text.toLowerCase();
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("zh", { granularity: "word" });
    return [...seg.segment(lower)].filter((s) => s.isWordLike).map((s) => s.segment);
  }
  return lower.split(/[^a-z0-9\u4e00-\u9fff]+/).filter(Boolean);
}

function ruleMatches(rule: SkillRecord["triggers"][number], input: SearchInput): boolean {
  const values = rule.values.map((v) => v.toLowerCase());
  switch (rule.field) {
    case "task": {
      const hay = tokenizeText(`${input.query ?? ""} ${input.task ?? ""}`);
      if (rule.operator === "contains_any") return values.some((v) => hay.includes(v));
      if (rule.operator === "includes") return values.every((v) => hay.includes(v));
      return values.some((v) => (input.task ?? "").toLowerCase() === v);
    }
    case "stack": {
      const stack = (input.stack ?? []).map((s) => s.toLowerCase());
      if (rule.operator === "includes") return values.every((v) => stack.includes(v));
      return values.some((v) => stack.includes(v));
    }
    case "domain":
      return values.includes((input.domain ?? "").toLowerCase());
    case "keyword": {
      const hay = tokenizeText(`${input.query ?? ""} ${input.task ?? ""}`);
      return values.some((v) => hay.some((t) => t === v || t.includes(v) || v.includes(t)));
    }
    default:
      return false;
  }
}

/** trigger 主路径打分：命中规则 weight 求和（可 >1，比较前封顶） */
export function triggerScore(skill: SkillRecord, input: SearchInput): number {
  let score = 0;
  if (skill.triggers.length > 0) {
    for (const rule of skill.triggers) {
      if (ruleMatches(rule, input)) score += rule.weight;
    }
    return score;
  }
  // keywords fallback：trigger 缺省时的规则源
  if (skill.keywords.length === 0) return 0;
  const hay = tokenizeText(`${input.query ?? ""} ${input.task ?? ""}`);
  const matched = skill.keywords.filter((k) => {
    const kw = k.toLowerCase();
    return hay.some((t) => t === kw || t.includes(kw) || kw.includes(t));
  });
  return matched.length > 0 ? 0.5 + (0.5 * matched.length) / skill.keywords.length : 0;
}

export async function searchSkills(
  db: SkillDb,
  skills: SkillRecord[],
  input: SearchInput,
): Promise<SearchHit[]> {
  const limit = input.limit ?? HIT_LIMIT;
  const threshold = input.match_threshold ?? 0.8;
  const byId = new Map(skills.map((s) => [s.id, s] as const));
  const best = new Map<string, SearchHit>();

  const put = (hit: SearchHit) => {
    const prev = best.get(hit.id);
    if (!prev || hit.score > prev.score) best.set(hit.id, hit);
  };

  // 路 A：Orama 全文
  if (input.query.trim()) {
    for (const r of await oramaSearch(db, input.query, limit)) {
      const s = byId.get(r.id);
      if (!s) continue;
      put({
        id: s.id,
        name: s.name,
        description: s.description,
        score: r.score,
        source: "orama",
      });
    }
  }

  // 路 B：trigger 主路径 + keywords fallback
  for (const s of skills) {
    const score = triggerScore(s, input);
    const isKeywordPath = s.triggers.length === 0;
    if (score >= threshold) {
      put({
        id: s.id,
        name: s.name,
        description: s.description,
        score: Math.min(score, 1),
        source: isKeywordPath ? "keywords" : "trigger",
      });
    }
  }

  // 失效降权（P3.2）：revoked 仍出现在结果中（置灰不隐藏）但分数乘罚沉底
  const penalty = (id: string): number =>
    byId.get(id)?.lifecycle.sync_state === "revoked" ? 0.05 : 1;

  return [...best.values()]
    .map((h) => ({ ...h, score: Math.round(h.score * penalty(h.id) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
