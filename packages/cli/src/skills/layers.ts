/**
 * 分层装配（skill-engine design §4.3，逐条可测）：
 *
 *   DomainFilter   scope = skills ∩ (common ∪ domains.current)
 *   LayerLoader    按 config.layers 数组索引序，四态加载：
 *                    true           → 全文直注入（L1/L2 正文段）
 *                    detect_stack   → stack_rules 全部命中才加载该组（MVP 只内置 Next.js+TS）
 *                    trigger_match  → Top-K 简表进 catalog 段，全文等 load_skill_detail
 *                    false          → 跳过（session 层显式加载）
 *   TokenArbitrator 逐层 max_tokens 预算：超限 LRU（按得分降序）→ digest 压缩
 *
 * 出口两个：context（推通道文本）/ catalog（人看视图）。
 */
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ConfigLayer, EngineConfig } from "@agentssignal/protocol";
import { type AgentSignalPaths, tokensEst } from "./paths.ts";
import { type SearchInput, searchSkills } from "./retriever.ts";
import type { SkillDb, SkillRecord } from "./store.ts";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  tokens_est: number;
}

export interface ContextResult {
  /** 推通道文本（L1/L2 正文段 + catalog 简表） */
  context: string;
  catalog: CatalogEntry[];
  /** 调试口径：每层实际注入的条目与字节数 */
  layers: { id: string; mode: ConfigLayer["auto_load"]; injected: string[]; tokens: number }[];
}

/** Domain Filter：common 全域可见；current=common 时全放行 */
export function domainFilter(skills: SkillRecord[], config: EngineConfig): SkillRecord[] {
  const current = config.domains.current;
  if (current === "common") return skills;
  return skills.filter((s) => s.domains.includes("common") || s.domains.includes(current));
}

/** detect_stack：stack_rules 组内条件全部命中才返回该组名 */
export async function detectStack(
  stackRules: ConfigLayer["stack_rules"],
  projectRoot: string,
): Promise<string[]> {
  const matched: string[] = [];
  for (const group of stackRules) {
    let ok = true;
    for (const cond of group.match) {
      const file = path.join(projectRoot, cond.file);
      try {
        if (cond.exists !== undefined) {
          if ((await stat(file)).isFile() !== cond.exists) {
            ok = false;
            break;
          }
        }
        if (cond.contains !== undefined) {
          const body = await readFile(file, "utf8");
          if (!body.includes(cond.contains)) {
            ok = false;
            break;
          }
        }
      } catch {
        ok = false;
        break;
      }
    }
    if (ok) matched.push(group.name);
  }
  return matched;
}

/** digest 压缩：保首段要点，≤ maxChars */
export function digestOf(body: string, maxChars = 200): string {
  const first = body.split(/\n{2,}/)[0]?.trim() ?? "";
  const text = first.replaceAll(/\s+/g, " ");
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`;
}

/** 逐层 TokenArbitrator：预算内 LRU（按给定顺序即得分序）+ digest 兜底 */
export function arbitrate(
  layer: ConfigLayer,
  items: { id: string; body: string; digest: string }[],
): { injected: { id: string; body: string }[]; tokens: number } {
  let used = 0;
  const injected: { id: string; body: string }[] = [];
  for (const item of items) {
    const full = tokensEst(item.body);
    if (used + full <= layer.max_tokens) {
      injected.push({ id: item.id, body: item.body });
      used += full;
      continue;
    }
    // 超限：先试 digest 压缩
    const budget = layer.max_tokens - used;
    const digestTokens = tokensEst(item.digest);
    if (budget > 0 && digestTokens <= budget) {
      injected.push({ id: item.id, body: item.digest });
      used += digestTokens;
    }
    // digest 也放不下：LRU 淘汰（跳过低分项，继续看下一项可能更小？——不，按得分降序直接截断更可测）
    break;
  }
  return { injected, tokens: used };
}

function renderLayer(layer: ConfigLayer, body: string): string {
  return `<layer id="${layer.id}" name="${layer.name}">\n${body.trimEnd()}\n</layer>`;
}

function renderCatalog(catalog: CatalogEntry[]): string {
  if (catalog.length === 0) return "";
  const lines = catalog
    .map((c) => `- ${c.id} | ${c.name} | ${c.description} | ~${c.tokens_est} tokens`)
    .join("\n");
  return [
    "<available_skills>",
    "以下为可用条目简表。需要完整步骤时，调用 load_skill_detail 获取全文，不要自行脑补。",
    lines,
    "</available_skills>",
  ].join("\n");
}

export interface BuildContextInput {
  paths: AgentSignalPaths;
  config: EngineConfig;
  skills: SkillRecord[];
  db: SkillDb;
  /** trigger_match 层的检索面（当前任务） */
  search?: SearchInput;
  projectRoot?: string;
}

export async function buildContext(input: BuildContextInput): Promise<ContextResult> {
  const { config, skills, db } = input;
  const scoped = domainFilter(skills, config);
  const byLayer = new Map<string, SkillRecord[]>();
  for (const s of scoped) {
    for (const l of s.layers) {
      byLayer.set(l, [...(byLayer.get(l) ?? []), s]);
    }
  }

  const sections: string[] = [];
  const catalog: CatalogEntry[] = [];
  const layerDebug: ContextResult["layers"] = [];

  for (const layer of config.layers) {
    const members = byLayer.get(layer.id) ?? [];
    const entries: { id: string; body: string; digest: string; catalog?: CatalogEntry }[] = [];

    if (layer.auto_load === "true" || layer.auto_load === "detect_stack") {
      if (layer.auto_load === "detect_stack") {
        const stacks = await detectStack(layer.stack_rules, input.projectRoot ?? process.cwd());
        // 组不命中则整层跳过
        if (stacks.length === 0) {
          layerDebug.push({ id: layer.id, mode: layer.auto_load, injected: [], tokens: 0 });
          continue;
        }
      }
      for (const s of members) {
        let body = "";
        try {
          body = await readFile(s.bodyFile, "utf8");
        } catch {
          continue;
        }
        entries.push({ id: s.id, body, digest: digestOf(body) });
      }
    } else if (layer.auto_load === "trigger_match") {
      const hits = await searchSkills(db, members.length ? members : scoped, {
        ...(input.search ?? { query: "" }),
        match_threshold: layer.match_threshold,
      });
      for (const hit of hits) {
        const s = members.find((m) => m.id === hit.id);
        if (!s) continue;
        let body = "";
        try {
          body = await readFile(s.bodyFile, "utf8");
        } catch {
          continue;
        }
        const entry: CatalogEntry = {
          id: s.id,
          name: s.name,
          description: s.description,
          tokens_est: Math.ceil(s.bodyBytes / 4),
        };
        entries.push({ id: s.id, body, digest: digestOf(body), catalog: entry });
        catalog.push(entry);
      }
    } else {
      // auto_load=false：session 层显式加载，跳过
      layerDebug.push({ id: layer.id, mode: layer.auto_load, injected: [], tokens: 0 });
      continue;
    }

    const { injected, tokens } = arbitrate(
      layer,
      entries.map(({ id, body, digest }) => ({ id, body, digest })),
    );
    for (const item of injected) {
      sections.push(renderLayer(layer, item.body));
    }
    layerDebug.push({
      id: layer.id,
      mode: layer.auto_load,
      injected: injected.map((i) => i.id),
      tokens,
    });
  }

  const catalogBlock = renderCatalog(catalog);
  if (catalogBlock) sections.push(catalogBlock);
  return { context: sections.join("\n\n"), catalog, layers: layerDebug };
}
