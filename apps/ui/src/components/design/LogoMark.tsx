/**
 * LogoMark —— 品牌太空猫（logo.png 抠底白稿），CSS mask + currentColor 染色，明暗主题自适应。
 * variant 支持语义徽标（原线稿机器人四态的语义延续）：flag=空态 · question=404 · lock=401。
 * 资产 public/logo-mark.png 由根 logo.png 经 PIL 抠底生成（黑点 6 / 白点 34 / gamma 0.6）。
 */
import { Flag, HelpCircle, Lock } from "lucide-react";

export type LogoVariant = "default" | "flag" | "question" | "lock";

const BADGE = {
  flag: Flag,
  question: HelpCircle,
  lock: Lock,
} as const;

export function LogoMark({
  size = 110,
  className,
  variant = "default",
}: {
  size?: number;
  className?: string;
  /** 语义变体：非 default 时在右下角叠小徽标，保留原机器人的场景语义 */
  variant?: LogoVariant;
}) {
  const Badge = variant === "default" ? null : BADGE[variant];
  const badgeSize = Math.max(12, Math.round(size * 0.34));
  const iconSize = Math.max(8, Math.round(badgeSize * 0.6));
  return (
    <span
      className={`relative inline-block ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="block h-full w-full"
        style={{
          backgroundColor: "currentColor",
          WebkitMaskImage: "url(/logo-mark.png)",
          maskImage: "url(/logo-mark.png)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
      {Badge && (
        <span
          className="absolute flex items-center justify-center rounded-full border border-border bg-paper"
          style={{ width: badgeSize, height: badgeSize, right: 0, bottom: 0 }}
        >
          <Badge size={iconSize} strokeWidth={2} className="text-muted" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
