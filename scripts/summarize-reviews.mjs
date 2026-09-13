#!/usr/bin/env node
/**
 * 汇总席辅助脚本（local-capability-plane 轨道 C · C6）。
 *
 * 三份审查报告（reviews/<date>-{dod,test,redline}.md）→ 汇总清单：
 *   - 每份报告的总结论行（首个含「✅通过 / 🟡 / 🔴」关键词的行）；
 *   - 全文中的 🔴/🟡 项行（驳回与警告清零用）。
 *
 * 用法：node scripts/summarize-reviews.mjs <change名> [date=YYYY-MM-DD，缺省取最新一份]
 * 退出码恒 0（只汇总不裁决——裁决权在汇总席会话）。
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const change = process.argv[2] ?? "local-capability-plane";
const date = process.argv[3];
const reviewsDir = path.join(ROOT, "openspec", "changes", change, "reviews");

if (!existsSync(reviewsDir)) {
  console.log(`无审查报告目录：${reviewsDir}`);
  process.exit(0);
}

const kinds = ["dod", "test", "redline"];
const files = kinds.map((k) => {
  if (date) return path.join(reviewsDir, `${date}-${k}.md`);
  const found = readdirSync(reviewsDir)
    .filter((f) => f.endsWith(`-${k}.md`))
    .sort();
  return found.length ? path.join(reviewsDir, found.at(-1)) : null;
});

console.log(`# 汇总清单 · ${change}${date ? ` · ${date}` : "（各席最新一份）"}\n`);

let openItems = 0;
for (let i = 0; i < kinds.length; i++) {
  const kind = kinds[i];
  const file = files[i];
  console.log(`## ${kind}`);
  if (!file || !existsSync(file)) {
    console.log(`  （缺报告：${kind}）\n`);
    continue;
  }
  const text = readFileSync(file, "utf8");
  // 总结论：含结论关键词的行（✅通过/🟡 警告通过/🔴 驳回/✅/🟡/🔴 开头或加粗形态）
  const lines = text.split("\n");
  // 总结论启发式：① 「结论」+ 结论符同行 ② 「警告通过/不驳回/驳回」独立行 ③ 加粗结论符行
  const verdictLine =
    lines.find((l) => /结论/.test(l) && /[✅🟡🔴]/.test(l) && !/\|/.test(l)) ??
    lines.find((l) => /(警告通过|不驳回|驳回)/.test(l) && !/\|/.test(l)) ??
    lines.find((l) => /[✅🟡🔴]/.test(l) && !/\|/.test(l)) ??
    "（未找到总结论行）";
  console.log(`  总结论：${verdictLine.trim().slice(0, 160)}`);
  // 驳回与警告项
  const items = text
    .split("\n")
    .filter((l) => /🔴|🟡/.test(l) && !/✅/.test(l) && l.trim().length > 8);
  if (items.length) {
    openItems += items.length;
    for (const it of items) console.log(`  ${it.trim().slice(0, 200)}`);
  } else {
    console.log("  （零驳回零警告）");
  }
  console.log("");
}

console.log(openItems ? `待汇总席处置项：${openItems} 行（逐条裁定：修复/排期/豁免）` : "三席零待办，可直接定稿");
