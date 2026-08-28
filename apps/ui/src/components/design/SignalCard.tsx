/**
 * SignalCard（信封卡）/ SignalList（列表行）—— 02/03 屏双形态。
 * 信封层与体验层的视觉分层是铁律：卡片上只出现信封字段，正文永不预览。
 * 悬浮操作：复制 use 命令 / 本地收藏。
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isFavorite, toggleFavorite } from "@/lib/favorites";
import type { Envelope } from "@/types/api";
import { KindBadge, MetadataChipRow } from "./primitives";

/** 右侧悬浮操作：+ 复制 `agentsignal use <id>`；☆ 本地收藏切换 */
function HoverActions({ signal }: { signal: Envelope }) {
  const [fav, setFav] = useState(() => isFavorite(signal.id));

  useEffect(() => {
    const sync = () => setFav(isFavorite(signal.id));
    window.addEventListener("as:favorites", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("as:favorites", sync);
      window.removeEventListener("storage", sync);
    };
  }, [signal.id]);

  const copyUse = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cmd = `agentsignal use ${signal.id}`;
    void navigator.clipboard.writeText(cmd).then(
      () => toast.success("已复制 Use 命令", { description: cmd }),
      () => toast.error("复制失败，请手动复制", { description: cmd }),
    );
  };

  const star = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavorite(signal.id);
    setFav(next);
    toast.success(next ? "已收藏" : "已取消收藏", { description: signal.id });
  };

  const btn =
    "grid h-7 w-7 place-items-center rounded-full border border-border bg-surface text-faint transition-colors hover:border-border-hi hover:text-text";

  return (
    <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <button type="button" aria-label="复制 Use 命令" title="复制 Use 命令" className={btn} onClick={copyUse}>
        <Plus size={13} />
      </button>
      <button
        type="button"
        aria-label={fav ? "取消收藏" : "收藏"}
        aria-pressed={fav}
        title={fav ? "取消收藏" : "收藏"}
        className={cn(btn, fav && "border-border-hi text-text")}
        onClick={star}
      >
        <Star size={13} fill={fav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export function SignalCard({
  signal,
  recommended = false,
  badge,
  className,
}: {
  signal: Envelope;
  /** 第一张推荐卡：左上角等宽 RECOMMENDED 小字 */
  recommended?: boolean;
  /** 排序理由角标 */
  badge?: string;
  className?: string;
}) {
  const corner = badge ?? (recommended ? "RECOMMENDED" : undefined);
  return (
    <Link
      to={`/signals/${signal.id}`}
      className={cn(
        "group relative block rounded-card bg-surface p-5 transition-colors",
        "hover:bg-surface-2",
        className,
      )}
    >
      <HoverActions signal={signal} />
      <div className="flex items-center justify-between gap-3">
        <KindBadge kind={signal.kind} />
        {corner && <span className="font-mono text-[11px] uppercase tracking-wider text-faint">{corner}</span>}
      </div>
      <p className="mt-3 line-clamp-3 text-[15px] font-medium leading-snug text-text">
        {signal.digest}
      </p>
      <div className="mt-4">
        <MetadataChipRow
          priority={signal.priority}
          tokensEst={signal.tokens_est}
          senderName={signal.sender_name}
          senderNumber={signal.sender_number}
          createdAt={signal.created_at}
        />
      </div>
    </Link>
  );
}

export function SignalRow({ signal }: { signal: Envelope }) {
  return (
    <Link
      to={`/signals/${signal.id}`}
      className="flex items-center gap-4 border-b border-border px-2 py-4 transition-colors last:border-0 hover:bg-surface"
    >
      <KindBadge kind={signal.kind} className="shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold leading-snug text-text">
          {signal.digest}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[12px] text-muted">
          {signal.topic}
        </span>
      </span>
      <span className="hidden shrink-0 font-mono text-[12px] text-muted sm:inline">
        {signal.tokens_est} tok
      </span>
      <span className="hidden shrink-0 font-mono text-[12px] text-muted md:inline">
        {signal.sender_number !== null ? `#${signal.sender_number}` : ""}
      </span>
      <span className="shrink-0 font-mono text-[12px] text-faint">
        {signal.created_at.slice(0, 10)}
      </span>
    </Link>
  );
}

export function SignalList({ signals }: { signals: Envelope[] }) {
  return (
    <div>
      {signals.map((s) => (
        <SignalRow key={s.id} signal={s} />
      ))}
    </div>
  );
}
