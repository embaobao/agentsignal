/**
 * 模型供应商注册表（local-capability-plane P7 · 7.1）。
 *
 * **数据驱动，不硬编码**：内置打底（国产端点 GLM/DeepSeek/Moonshot）+ 用户区
 * `~/.agentsignal/providers.json5` 覆盖/追加——**新增厂商 = 只改数据文件**（社区可补）。
 * 加载 fail-soft：非法条目跳过并收集 errors（scanSkills 同款）。
 * 消费方：7.2 包 providers 段（provider ref + model 映射 + token 引用）、
 * 7.3 env 写入器（接管确认 + 快照回滚 + 归属锁）。
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSON5 from "json5";
import { z } from "zod";
import { type AgentSignalPaths, resolvePaths } from "../skills/paths.ts";

/** 供应商条目 schema（token 永不进注册表——token 引用属 7.2 包模型/7.3 env 写入器） */
export const ProviderSchema = z.object({
  /** 厂商 id（小写 slug，如 glm/deepseek/moonshot） */
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  name: z.string().min(1),
  /** OpenAI 兼容端点（国产供应商普遍兼容） */
  base_url: z.string().url(),
  /** 建议模型（按厂商当前主力线维护） */
  models: z.array(z.string().min(1)).min(1),
  /** 文档链接（可选） */
  docs_url: z.string().url().optional(),
});

export type Provider = z.infer<typeof ProviderSchema>;

/** 内置打底：国产端点优先（G-E 门验证对象）；社区经用户区数据文件补充 */
const BUILTIN: Provider[] = [
  {
    id: "glm",
    name: "智谱 GLM",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4.7", "glm-4.7-air"],
    docs_url: "https://docs.bigmodel.cn",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    base_url: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    docs_url: "https://api-docs.deepseek.com",
  },
  {
    id: "moonshot",
    name: "月之暗面 Kimi",
    base_url: "https://api.moonshot.cn/v1",
    models: ["kimi-k2-0905-preview"],
    docs_url: "https://platform.moonshot.cn/docs",
  },
];

export interface ProvidersLoadResult {
  providers: Provider[];
  /** 非法条目（fail-soft 收集，含 id 与原因） */
  errors: string[];
}

/** 合并加载：内置打底 + 用户区 providers.json5 覆盖（同 id）/追加（新 id）；非法条目跳过收集 */
export async function loadProviders(paths?: AgentSignalPaths): Promise<ProvidersLoadResult> {
  const p = paths ?? resolvePaths();
  const errors: string[] = [];
  const byId = new Map<string, Provider>(BUILTIN.map((x) => [x.id, x]));
  let userRaw = "";
  try {
    userRaw = await readFile(path.join(p.root, "providers.json5"), "utf8");
  } catch {
    userRaw = "";
  }
  if (userRaw.trim()) {
    try {
      const parsed = JSON5.parse(userRaw) as { providers?: unknown[] };
      for (const raw of parsed.providers ?? []) {
        const r = ProviderSchema.safeParse(raw);
        if (!r.success) {
          const id = (raw as { id?: string }).id ?? "(无 id)";
          errors.push(`${id}：${r.error.issues[0]?.message ?? "schema 不合规"}`);
          continue;
        }
        byId.set(r.data.id, r.data);
      }
    } catch (err) {
      errors.push(`providers.json5 解析失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { providers: [...byId.values()], errors };
}
