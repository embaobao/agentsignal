/**
 * SOUL.md 块注入（host-matrix-alignment 1.3，Hermes 专用）。
 *
 * Hermes 无 rules 文件位，rules 一行兜底写进 SOUL.md 标记段：
 *   <!-- agentsignal:rules:start --> … <!-- agentsignal:rules:end -->
 * 幂等（重复注入不产生第二块）；摘除只删标记段，用户原有内容逐字保留（规范 E-10）。
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const SOUL_MARK_START = "<!-- agentsignal:rules:start -->";
export const SOUL_MARK_END = "<!-- agentsignal:rules:end -->";

function renderBlock(content: string): string {
  return `${SOUL_MARK_START}\n${content}${SOUL_MARK_END}\n`;
}

/** 注入 rules 块：文件不存在则创建；已有块则幂等跳过；否则追加在原文之后 */
export async function injectSoulBlock(soulPath: string, content: string): Promise<void> {
  await mkdir(path.dirname(soulPath), { recursive: true });
  let existing = "";
  try {
    existing = await readFile(soulPath, "utf8");
  } catch {
    existing = "";
  }
  if (existing.includes(SOUL_MARK_START)) return; // 幂等：已有块不重复注入
  const prefix = existing && !existing.endsWith("\n") ? `${existing}\n` : existing;
  await writeFile(soulPath, `${prefix}${renderBlock(content)}`, "utf8");
}

/** 摘除 rules 块：只删 start…end 整段（含标记行），其余内容原样；文件不存在为无操作 */
export async function removeSoulBlock(soulPath: string): Promise<void> {
  let existing: string;
  try {
    existing = await readFile(soulPath, "utf8");
  } catch {
    return;
  }
  if (!existing.includes(SOUL_MARK_START)) return;
  const start = existing.indexOf(SOUL_MARK_START);
  const end = existing.indexOf(SOUL_MARK_END);
  const kept =
    end >= 0
      ? existing.slice(0, start) + existing.slice(end + SOUL_MARK_END.length)
      : existing.slice(0, start);
  // 清掉摘除后残留的多余空行（块前无换行时保底一个换行）
  const cleaned = kept.replace(/\n{3,}/g, "\n\n");
  const tmp = `${soulPath}.tmp-${process.pid}`;
  await writeFile(tmp, cleaned, "utf8");
  await rename(tmp, soulPath);
}
