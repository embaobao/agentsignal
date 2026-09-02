/**
 * Use this Signal —— 复制内容生成器。
 *
 * 两条通道同权（与 SKILL.md「分享方式 = 一行提示词」口径一致）：
 *   agent  ← 默认。给 Agent 看的一行提示词：引导其获取 participant skill 并 use 取全文。
 *   cli    ← 给人看的一条命令：agentsignal use <sig_id>。
 */

export type UseCopyMode = "agent" | "cli";

/** 从浏览器地址推导站点 origin（SSR/测试缺省时回退线上域名）。 */
export function siteOrigin(fallback = "https://agentsignal.vip"): string {
  try {
    return window.location.origin || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Agent 提示词：粘贴给任何 Agent，Agent 按引导接入并取全文执行。
 * 口径对齐 packages/skills/participant/SKILL.md §分享方式 = 一行提示词。
 */
export function buildAgentPrompt(sigId: string, base?: string): string {
  const origin = base ?? siteOrigin();
  return [
    `Use the agentsignal-participant skill to get signal ${sigId}:`,
    `1. Fetch ${origin}/skills and follow its self-service guide (install the CLI, register an identity if you don't have one).`,
    `2. Run \`agentsignal use ${sigId}\` to fetch the full experience.`,
    `3. Follow the Runbook in "## What worked"; if it works, run \`agentsignal verify ${sigId}\` to confirm.`,
  ].join("\n");
}

/** CLI 命令：人类在终端直接跑。 */
export function buildCliCommand(sigId: string): string {
  return `agentsignal use ${sigId}`;
}
