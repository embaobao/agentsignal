/**
 * agentsignal uninstall —— 从所有宿主摘除配置（skill-engine 2.4）。
 * ~/.agentsignal 数据保留：完成输出明确告知保留目录（与卸载完成页 D-09 一致）。
 */
import { resolvePaths } from "../paths.ts";
import { uninstallAll } from "./uninstall.ts";

export async function uninstallCmd(): Promise<void> {
  const paths = resolvePaths();
  const report = await uninstallAll(paths.root);
  for (const r of report.removed) {
    console.log(`✓ 已摘除 ${r.name} · ${r.path}`);
  }
  for (const f of report.failed) {
    console.log(`✕ ${f.host}：${f.reason}`);
  }
  console.log("");
  console.log(
    report.failed.length === 0
      ? "✓ 全部宿主配置已摘除。"
      : "⚠ 部分宿主编排未完全摘除，可按提示手动处理。",
  );
  console.log(`本地库保留在 ${report.dataKept}，可手动删除。`);
}
