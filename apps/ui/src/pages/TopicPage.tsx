/**
 * 02 分区/浏览页（v5 搜索优先）—— 大搜索框 + topic tag 行 + Latest/Most verified tab + 列表默认
 */
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { useSignals, useTopics } from "@/lib/api";
import { Button, SkeletonCards, SkeletonList, SectionTabs } from "@/components/design/primitives";
import { SignalCard, SignalList } from "@/components/design/SignalCard";
import { EmptyState } from "@/components/design/EmptyState";
import { cn } from "@/lib/utils";

export function TopicPage() {
  const { slug: routeSlug } = useParams();
  const slug = routeSlug ?? "all";
  const basePath = slug === "all" ? "/signals" : `/topics/${slug}`;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [sort, setSort] = useState<"newest" | "verified">("newest");
  const [view, setView] = useState<"list" | "card">("list");

  const { data: topics } = useTopics();
  const topic = topics?.topics.find((t) => t.slug === slug);
  const { data, isLoading, isError } = useSignals({ topic: slug, q, sort, limit: 50 });

  const signals = data?.signals ?? [];
  const isAll = slug === "all";

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = input.trim();
    navigate(term ? `${basePath}?q=${encodeURIComponent(term)}` : basePath);
  };

  return (
    <div className="space-y-8">
      {/* 大搜索框（56px pill） */}
      <form onSubmit={onSearch} className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search signals, topics, commands…"
          className="h-14 w-full rounded-full border border-border bg-surface pl-12 pr-5 text-[15px] outline-none transition-colors placeholder:text-faint focus:border-text"
        />
      </form>

      {/* topic tag 行：单色 pill，选中黑底白字 */}
      <div className="flex flex-wrap items-center gap-2">
        {[{ slug: "all", signal_count: 0 }, ...(topics?.topics ?? [])].map((t) => (
          <Link
            key={t.slug}
            to={t.slug === "all" ? "/signals" : `/topics/${t.slug}`}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3.5 font-mono text-[12px] transition-colors",
              slug === t.slug
                ? "bg-text text-bg"
                : "border border-border text-muted hover:border-border-hi hover:text-text",
            )}
          >
            {t.slug}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">{isAll ? "全部经验" : slug}</h1>
          <p className="mt-1 font-mono text-[12px] text-faint">
            {topic?.signal_count ?? signals.length} signals
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 列表/卡片切换 */}
          <div className="flex gap-1 rounded-full border border-border p-0.5">
            {(["list", "card"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[11px] transition-colors",
                  view === v ? "bg-text text-bg" : "text-faint hover:text-text",
                )}
              >
                {v === "list" ? "列表" : "卡片"}
              </button>
            ))}
          </div>
          <Link to="/publish">
            <Button size="sm">去发布</Button>
          </Link>
        </div>
      </div>

      <SectionTabs
        sections={["Latest", "Most verified"]}
        active={sort === "newest" ? "Latest" : "Most verified"}
        onChange={(s) => setSort(s === "Latest" ? "newest" : "verified")}
      />

      {q && (
        <p className="text-sm text-muted">
          关键词：<span className="font-mono text-text">{q}</span>
        </p>
      )}

      {isLoading && (view === "card" ? <SkeletonCards /> : <SkeletonList />)}
      {isError && <EmptyState title="加载失败" description="请稍后重试。" showCta={false} />}
      {!isLoading && !isError && signals.length === 0 && (
        <EmptyState
          title={q ? `没有匹配「${q}」的经验` : "这个分区还没有经验"}
          description={q ? "换个关键词试试。" : "成为第一个分享者。"}
        />
      )}
      {!isLoading && !isError && signals.length > 0 && (
        <>
          {view === "card" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {signals.map((s) => (
                <SignalCard key={s.id} signal={s} />
              ))}
            </div>
          ) : (
            <SignalList signals={signals} />
          )}
        </>
      )}
    </div>
  );
}
