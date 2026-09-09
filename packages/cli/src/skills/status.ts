/**
 * agentsignal status —— 本机状态视图（skill-engine 2.1）。
 *
 * 输出四块：配置 / 索引 / 接线 / 双指标（吞吐节省 vs 残留占用，bytes/4 口径声明）。
 * 另做两项自检：Intl.Segmenter 运行时（Orama mandarin 依赖）· RTK/CodeGraph 共存检测。
 */
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { CONFIG_INVALID, ConfigError, loadConfig } from "./config.ts";
import { createEngine } from "./engine.ts";
import { capacityReport } from "./lifecycle.ts";
import { readMetrics } from "./metrics.ts";
import { readPlatformCredentials } from "./mirror.ts";
import { resolvePaths } from "./paths.ts";
import { scanSkills } from "./store.ts";
import { probePending } from "./sync.ts";
import { detectHosts, hostById } from "./wiring/hosts.ts";
import { hostStatus } from "./wiring/snippets.ts";

const fmtBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

/** Intl.Segmenter 自检（中文分词的地基；Node ≥22.18 全量内建） */
function segmenterCheck(): string {
  try {
    if (typeof Intl === "undefined" || !("Segmenter" in Intl))
      return "✕ 缺失（中文检索将退化为英文切分）";
    const seg = new Intl.Segmenter("zh", { granularity: "word" });
    const words = [...seg.segment("登录认证")].filter((s) => s.isWordLike).map((s) => s.segment);
    return words.length >= 2 ? `✓ 可用（${words.join("/")}）` : "⚠ 可用但切分结果异常";
  } catch {
    return "✕ 不可用";
  }
}

/**
 * RTK / CodeGraph 共存检测：PATH 上的二进制 + 宿主 MCP 配置里的同名服务条目。
 * 只提示共存，不做任何改动（本工具与它们是并列关系）。
 */
async function coexistenceCheck(): Promise<string[]> {
  const found: string[] = [];
  const bins = ["rtk", "codegraph", "mcp-codegraph"];
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  for (const bin of bins) {
    for (const dir of dirs) {
      try {
        await stat(path.join(dir, bin));
        found.push(`PATH: ${bin}`);
        break;
      } catch {
        /* 继续 */
      }
    }
  }
  for (const host of detectHosts()) {
    try {
      const st = await hostStatus(hostById(host.id));
      const raw = await import("node:fs/promises").then(async (fs) => {
        try {
          return await fs.readFile(st.path, "utf8");
        } catch {
          return "";
        }
      });
      for (const name of ["rtk", "codegraph"]) {
        if (raw.includes(`"${name}"`) || raw.includes(`${name}-mcp`)) {
          found.push(`${host.name}: ${name}`);
        }
      }
    } catch {
      /* 单宿主失败不影响体检 */
    }
  }
  return [...new Set(found)];
}

export async function statusCmd(): Promise<void> {
  const paths = resolvePaths();
  console.log(`AgentSignal 本机状态 · ${paths.root}`);
  console.log("");

  // ① 配置
  let configOk = false;
  try {
    const loaded = await loadConfig(paths);
    if (!loaded) {
      console.log("配置：✕ 不存在（运行 agentsignal init 初始化）");
    } else {
      configOk = true;
      const { config } = loaded;
      console.log(
        `配置：✓ 已就绪 · 域 ${config.domains.available.join("/")} · 层 ${config.layers.map((l) => l.id).join("→")}`,
      );
    }
  } catch (err) {
    if (err instanceof ConfigError && err.code === CONFIG_INVALID) {
      console.log(`配置：✕ 无法解析 —— ${err.message}`);
    } else {
      throw err;
    }
  }

  // ② 索引与库
  const { skills, errors } = await scanSkills(paths);
  let indexLine = "索引：—";
  if (configOk) {
    try {
      const engine = await createEngine();
      const st = (await stat(paths.indexDumpFile)).mtime
        .toISOString()
        .slice(0, 16)
        .replace("T", " ");
      indexLine = `索引：✓ ${engine.skills.length} 条 · 上次重建 ${st}${engine.indexRebuilt ? "（本次重建）" : ""}`;
    } catch {
      indexLine = "索引：✕ 未建立";
    }
  }
  console.log(indexLine);
  console.log(
    `本地库：${skills.length} 条条目 · 存储占用 ${fmtBytes(skills.reduce((a, s) => a + s.bodyBytes, 0))}${errors.length ? ` · ${errors.length} 个目录异常` : ""}`,
  );

  // ②½ 容量告警（P3.3：超限仅告警，清理在管理界面确认后执行，不自动删）
  try {
    const cap = await capacityReport(paths);
    if (cap.over) {
      console.log(
        `容量告警：${cap.count}/${cap.max} 超限 · 未验证低使用 ${cap.candidates.length} 条为清理候选（管理界面确认后执行，不自动删）`,
      );
    }
  } catch {
    // 容量盘点失败不阻塞体检
  }

  // ③ 接线
  console.log("接线：");
  for (const host of detectHosts()) {
    const st = await hostStatus(hostById(host.id));
    const mark = st.mcp === "wired" ? "✓ 已接线" : st.mcp === "drift" ? "⚠ 配置漂移" : "· 未接线";
    console.log(
      `  ${mark.padEnd(12)} ${host.name}${host.detected ? "（已探测）" : ""} · ${st.path}`,
    );
  }

  // ③½ 订阅体检（dynamic-skill-management P2.4：仅统计不自动同步）
  try {
    const loaded = await loadConfig(paths);
    const subs = loaded?.config.sync.subscriptions ?? [];
    if (subs.length > 0) {
      const { base } = await readPlatformCredentials();
      if (!base) {
        console.log(
          `订阅：${subs.length} 个分区 · 落后统计需要来源站点（AGENTSIGNAL_BASE 或 register）`,
        );
      } else {
        let total = 0;
        let more = false;
        let failed = 0;
        for (const sub of subs) {
          try {
            const probe = await probePending(sub, { baseUrl: base });
            total += probe.pending;
            more = more || probe.more;
          } catch {
            failed++;
          }
        }
        const detail =
          failed === subs.length
            ? "落后统计失败（无法连接来源站点）"
            : `落后 ${total.toLocaleString("en-US")}${more ? "+" : ""} 条待同步${failed > 0 ? ` · ${failed} 个分区统计失败` : ""}`;
        console.log(`订阅：${subs.length} 个分区 · ${detail}（按需拉取，不自动同步）`);
      }
    }
  } catch {
    // config 异常已在 ① 报告，此处静默
  }

  // ④ 双指标（bytes/4 口径）
  const m = await readMetrics(paths);
  console.log("");
  console.log("效率指标（按 bytes ÷ 4 估算 token 数，仅为量级参考，不代表账单金额）：");
  console.log(`  吞吐节省 ${m.throughput_saved.toLocaleString("en-US")} tokens（估算）`);
  console.log(`  残留占用 ${m.residual.toLocaleString("en-US")} tokens（估算）`);

  console.log("");
  console.log(`运行时自检 · Intl.Segmenter ${segmenterCheck()}`);
  const coexist = await coexistenceCheck();
  console.log(
    `共存检测 · ${coexist.length > 0 ? coexist.join(" · ") : "未发现 RTK/CodeGraph（并列工具，互不影响）"}`,
  );

  // 会话目录规模（Trace，Phase 2）
  try {
    const sessions = await readdir(paths.sessionsDir);
    console.log(`会话记录 · ${sessions.length} 份（只记录不审计）`);
  } catch {
    console.log("会话记录 · 0 份");
  }
}
