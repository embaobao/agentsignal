/**
 * 全量摘除（wiring/uninstall）：摘除全部宿主的 MCP 配置 / hooks / rules 条目。
 * ~/.agentsignal 数据保留（卸载完成页 D-09 明确告知库目录路径）。
 */
import { hostDefs } from "./hosts.ts";
import { unwireMcp, type WireResult } from "./snippets.ts";

export interface UninstallReport {
  removed: WireResult[];
  failed: { host: string; reason: string }[];
  /** 保留的数据目录（供完成页展示） */
  dataKept: string;
}

export async function uninstallAll(dataKept: string): Promise<UninstallReport> {
  const removed: WireResult[] = [];
  const failed: { host: string; reason: string }[] = [];
  for (const host of hostDefs()) {
    try {
      removed.push(await unwireMcp(host));
    } catch (err) {
      failed.push({
        host: host.name,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return { removed, failed, dataKept };
}
