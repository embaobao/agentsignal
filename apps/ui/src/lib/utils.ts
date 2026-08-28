import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn 生态的标准 cn()：clsx 拼条件类 + tailwind-merge 解决冲突 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 1000],
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
];

/** 相对时间：零依赖（Intl.RelativeTimeFormat），输出「3 分钟前」 */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = t - now;
  const abs = Math.abs(diff);
  const fmt = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const [unit, ms] = UNITS[i] as [Intl.RelativeTimeFormatUnit, number];
    if (abs >= ms || i === 0) return fmt.format(Math.round(diff / ms), unit);
  }
  return "刚刚";
}

/** token 数格式化（等宽展示口径统一） */
export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
