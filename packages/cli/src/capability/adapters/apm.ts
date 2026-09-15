/**
 * APM 适配器（local-capability-plane P1 · 1.6，决议 D2/D5）。
 *
 * 外部生态作可插拔适配器：spawn `apm` 命令（**`-g` 用户级**），不 Fork 不复刻。
 * 规则一实测反例落地：APM **没有 remove**（删依赖 = 手改 apm.yml + apm prune）——
 * capabilities() 不声明 remove，remove() 调用经门控抛 UnsupportedCapability。
 * probe 经 spawn 探测：缺席返回 {available:false, reason}（S6 前半——降级信号非错误）。
 * deploy/reconcile 的完整实现待 G-B 门（站长 APM 真机三方法实跑）后按实测补齐；
 * 本文件先交付 probe/capabilities/hosts/remove 门控（DoD 范围）。
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  Availability,
  Cap,
  CapabilityAdapter,
  DeployResult,
  PackageItem,
  ReconcileReport,
  RemoveResult,
} from "../types.ts";
import { UnsupportedCapability } from "../types.ts";

const execFileAsync = promisify(execFile);

const DECLARED_CAPS: ReadonlySet<Cap> = new Set<Cap>([
  "skill",
  "mcp",
  "prompt",
  "rule",
  "deploy",
  // "remove" 刻意不声明——APM 实测无此命令（规则一反例）
]);

/** APM 适配器（id="apm"；broker 排序中让位 native——决议 D5 用户声明 > 原生） */
export const apmAdapter: CapabilityAdapter = {
  id: "apm",

  async probe(): Promise<Availability> {
    try {
      const { stdout } = await execFileAsync("apm", ["--version"], { timeout: 5000 });
      return { available: true, version: stdout.trim() };
    } catch (err) {
      return {
        available: false,
        reason:
          err instanceof Error && "code" in err && (err as { code?: string }).code === "ENOENT"
            ? "未安装 APM（apm 不在 PATH）——native 适配器接管（S6）"
            : `APM 探测失败：${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },

  capabilities: () => DECLARED_CAPS,

  hosts: () => ["claude-code", "cursor", "codex", "cline", "gemini"],

  async deploy(items: PackageItem[], host: string): Promise<DeployResult> {
    // G-B 门后按 APM 真机三方法实测补齐（apm install -g 用户级）；当前结构占位
    return {
      host: host as never,
      ladder: "L1",
      written: [],
      skipped: items.map((i) => ({
        target: host as never,
        reason: `APM deploy 待 G-B 真机联调（1.6 DoD 范围外）：${i.id}`,
      })),
    };
  },

  async remove(): Promise<RemoveResult> {
    // 规则一：remove 未声明——永不到达此处的正常路径（契约套件锁死抛错行为）
    throw new UnsupportedCapability({ adapter: "apm", cap: "remove" });
  },

  async reconcile(): Promise<ReconcileReport> {
    // APM 侧无对账命令——账本自足（1.3 快照）+ 账本侧对账归 P2 2.3 对账器
    return { entries: [], at: new Date().toISOString() };
  },
};
