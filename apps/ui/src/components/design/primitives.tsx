/**
 * 设计层原子组件 —— btn / chip / kind-badge / skeleton / verify-mark。
 *
 * 分层纪律：
 *   components/ui/     ← shadcn 生成的基础设施（可整目录重生成，禁手改）
 *   components/design/ ← 本目录，设计稿命名层，套前者换肤（业务改动只写这里）
 *
 * 视觉纪律：单色（黑/白/灰），无渐变、无发光；层级靠排版与灰度。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, formatTokens, relativeTime } from "@/lib/utils";
import type { Envelope, SignalKind } from "@/types/api";

/* ---------------- Button ---------------- */

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-ctl px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text",
  {
    variants: {
      variant: {
        // solid：黑底白字 pill（浅色）/ 白底黑字（深色），hover 仅降透明度
        solid: "bg-text text-bg hover:opacity-80",
        ghost: "border border-border text-text hover:border-border-hi hover:bg-surface-2",
        link: "text-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...props} />;
}

/* ---------------- Chip（等宽 · pill · 单色） ---------------- */

export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  /** 兼容旧调用：单色体系下所有 tone 均渲染为中性描边 */
  tone?: "default" | "green" | "blue" | "purple" | "muted";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip border border-border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide",
        tone === "muted" ? "text-faint" : "text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- KindBadge（单色描边 pill + 线稿图标：对勾/上箭头/气泡） ---------------- */

const KIND_LABEL: Record<SignalKind, string> = {
  solution: "SOLUTION",
  update: "UPDATE",
  discussion: "DISCUSSION",
};

function KindIcon({ kind }: { kind: SignalKind }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  if (kind === "solution") {
    return (
      <svg {...common}>
        <path d="M2 6.5l2.5 2.5L10 3.5" />
      </svg>
    );
  }
  if (kind === "update") {
    return (
      <svg {...common}>
        <path d="M6 10V2M3 5l3-3 3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M1.5 2.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4l-2.5 2.5z" />
    </svg>
  );
}

export function KindBadge({ kind, className }: { kind: SignalKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-border px-2.5 py-1 font-mono text-[12px] font-medium uppercase tracking-wider text-muted",
        className,
      )}
    >
      <KindIcon kind={kind} />
      {KIND_LABEL[kind] ?? KIND_LABEL.solution}
    </span>
  );
}

/* ---------------- MetadataChipRow ---------------- */

export function MetadataChipRow({
  priority,
  tokensEst,
  senderName,
  senderNumber,
  createdAt,
}: {
  priority: number;
  tokensEst: number;
  senderName: string | null;
  senderNumber: number | null;
  createdAt: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip tone="muted">P{priority}</Chip>
      <Chip tone="muted">{formatTokens(tokensEst)} tok</Chip>
      {senderNumber !== null && <Chip tone="muted">#{senderNumber}</Chip>}
      {senderName && <Chip tone="muted">{senderName}</Chip>}
      <Chip tone="muted">{relativeTime(createdAt)}</Chip>
    </div>
  );
}

/* ---------------- VerifyMark（对勾开关，选中=实心） ---------------- */

export function VerifyMark({
  checked,
  onClick,
  count,
}: {
  checked: boolean;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 font-mono text-[12px] transition-colors",
        checked
          ? "border-success text-success"
          : "border-border text-faint hover:border-border-hi hover:text-text",
      )}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2.5 6.5l2.2 2.2 4.8-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count !== undefined ? `✓ ${count} 次验证` : "Verify"}
    </button>
  );
}

/* ---------------- Skeleton / Loading ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-[8px] bg-surface-2 shimmer", className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton-list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface p-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-3 h-3 w-1/2" />
        </div>
      ))}
      <LoadingBar />
    </div>
  );
}

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" data-testid="skeleton-cards">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="rounded-card border border-border bg-surface p-5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-4 h-5 w-full" />
            <Skeleton className="mt-2 h-5 w-2/3" />
            <Skeleton className="mt-4 h-3 w-1/3" />
          </div>
        ))}
      </div>
      <LoadingBar />
    </div>
  );
}

export function LoadingBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("loading-bar h-1 w-full rounded-chip", className)}
      role="progressbar"
      aria-label="加载中"
    />
  );
}

/* ---------------- SectionTabs（激活=底部实线下划线） ---------------- */

export const SECTIONS = ["Why", "What worked", "Evidence", "Caveats"] as const;

export function SectionTabs({
  active,
  onChange,
  sections,
}: {
  active: string;
  onChange: (s: string) => void;
  sections?: readonly string[];
}) {
  const items = sections ?? SECTIONS;
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-border">
      {items.map((s) => (
        <button
          key={s}
          role="tab"
          aria-selected={active === s}
          onClick={() => onChange(s)}
          className={cn(
            "relative px-4 py-2.5 text-sm transition-colors",
            active === s ? "text-text" : "text-muted hover:text-text",
          )}
        >
          {s}
          {active === s && (
            <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-t bg-text" />
          )}
        </button>
      ))}
    </div>
  );
}

export type { Envelope };
