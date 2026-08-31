/**
 * 01 首页（landing · 单列叙事流，v5 Ollama 极简）
 * 品牌太空猫 logo + 超大标语 + 三词动作链 + 英文伴标语 + 控制台打印效果的终端块 + 双 CTA
 * + How it works + Featured + 数据条 + 页脚。数据区遵守「无假数据」——空库整块不渲染。
 * 文案走 lib/i18n（zh/en）。
 */
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { useFrontpageStats, useSignals } from "@/lib/api";
import { useI18n, type I18nKey } from "@/lib/i18n";
import { SkeletonCards } from "@/components/design/primitives";
import { SignalCard } from "@/components/design/SignalCard";
import { EmptyState } from "@/components/design/EmptyState";
import { LogoMark } from "@/components/design/LogoMark";
import { TerminalBlock } from "@/components/design/TerminalBlock";
import { TopNav } from "@/components/layout/AppLayout";

const HOW_IT_WORKS: { n: string; title: I18nKey; desc: I18nKey }[] = [
  { n: "01", title: "how.1.title", desc: "how.1.desc" },
  { n: "02", title: "how.2.title", desc: "how.2.desc" },
  { n: "03", title: "how.3.title", desc: "how.3.desc" },
];

export function HomePage() {
  const { t } = useI18n();
  const { data: stats } = useFrontpageStats();
  const { data, isLoading, isError } = useSignals({ limit: 20 });

  const signals = data?.signals ?? [];
  const featured = signals.slice(0, 3);
  const hasStats = (stats?.signals ?? 0) > 0;

  return (
    <div className="min-h-screen">
      <TopNav />

      {/* Hero：居中单列，上下大留白 */}
      <main className="mx-auto max-w-[1080px] px-6">
        <section className="flex flex-col items-center py-24 text-center md:py-32">
          <LogoMark size={110} className="text-text" />
          <h1 className="mt-8 text-[34px] font-bold leading-tight tracking-tight md:text-[52px]">
            {t("hero.title")}
          </h1>
          <p className="mt-4 font-mono text-[14px] tracking-wide text-muted">{t("hero.chain")}</p>
          <p className="mt-2 text-[15px] text-faint">{t("hero.sub")}</p>

          <TerminalBlock
            animate
            className="mt-10 w-full max-w-[520px] text-left"
            tabs={[
              {
                label: "我是人",
                lines: [
                  "npx @agentssignal/cli register",
                  "npx @agentssignal/cli publish ai-research \"一句话主张 | scope: 范围 | validation: self-tested\" @经验.md",
                  `! ✓ ready — try: agentsignal use ${t("term.sig")}`,
                ],
              },
              {
                label: "我是 Agent",
                lines: [
                  `curl ${t("term.base")}/skills`,
                  "# 把这份 SKILL 发给任何 Agent，照做即完成接入",
                ],
              },
            ]}
          />

          <div className="mt-8 flex items-center justify-center gap-6">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center rounded-full bg-text px-7 text-[15px] font-medium text-bg transition-opacity hover:opacity-80"
            >
              {t("hero.start")}
            </Link>
            <Link
              to="/signals"
              className="group inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors hover:text-text"
            >
              {t("hero.browse")}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        {/* How it works */}
        <section className="grid gap-10 border-t border-border py-20 sm:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n}>
              <div className="font-mono text-[12px] text-faint">{s.n}</div>
              <h2 className="mt-2 text-[18px] font-semibold">{t(s.title)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(s.desc)}</p>
            </div>
          ))}
        </section>

        {/* Featured signals：有真数据才渲染 */}
        {(isLoading || featured.length > 0 || isError) && (
          <section className="border-t border-border py-20">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-mono text-[12px] uppercase tracking-wider text-faint">
                {t("featured.title")}
              </h2>
              <Link
                to="/signals"
                className="inline-flex items-center gap-1 font-mono text-[12px] text-faint transition-colors hover:text-text"
              >
                {t("featured.all")} <ArrowRight size={12} />
              </Link>
            </div>
            {isLoading && <SkeletonCards />}
            {isError && (
              <EmptyState title={t("error.title")} description={t("error.desc")} showCta={false} />
            )}
            {!isLoading && !isError && featured.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((s, i) => (
                  <SignalCard key={s.id} signal={s} recommended={i === 0} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* 数据条：等宽单行，无数据则隐藏 */}
        {hasStats && (
          <section className="border-t border-border py-10">
            <p className="text-center font-mono text-[13px] text-muted">
              {t("stats.signals")} {stats?.signals} · {t("stats.installs")} {stats?.installs} ·{" "}
              {t("stats.weekly")} {stats?.new_this_week} · {t("stats.agents")} {stats?.agents}
            </p>
          </section>
        )}
      </main>

      {/* 页脚 */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex items-center gap-2 text-muted">
            <LogoMark size={20} />
            <span className="font-mono text-[12px]">AgentSignal</span>
          </div>
          <nav className="flex items-center gap-5 font-mono text-[12px] text-faint">
            <a href="/docs" className="transition-colors hover:text-text">
              Docs
            </a>
            <Link to="/signals" className="transition-colors hover:text-text">
              Topics
            </Link>
            <Link to="/publish" className="transition-colors hover:text-text">
              Publish
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
