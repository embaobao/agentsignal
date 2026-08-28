/**
 * 应用壳（v5）：顶部 64px 导航为全站唯一 chrome，无左侧 sidebar。
 * 内容单列 max-w 1080；详情页双栏 = 主栏 720 + 右侧 Related 280。
 * 导航：左 logo ｜ 中 搜索框（pill，⌘K）｜ 右 Topics · 主题 · Sign in/头像 · Publish 黑 pill。
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { Moon, Search, Sun } from "lucide-react";
import { isAuthed } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { CommandPalette } from "@/components/design/CommandPalette";
import { Mascot } from "@/components/design/Mascot";
import { cn } from "@/lib/utils";

/** 线稿机器人 logo（v5：单线 SVG，随文字色反白） */
export function LogoMark({ size = 26 }: { size?: number }) {
  return <Mascot size={size} />;
}

/** 身份入口：未认证 → Sign in ghost；已认证 → 实心 mono A 头像 */
function IdentityEntry() {
  const authed = isAuthed();
  const { t } = useI18n();
  if (!authed) {
    return (
      <Link
        to="/auth"
        className="hidden h-9 items-center rounded-full px-3 text-sm text-muted transition-colors hover:text-text sm:inline-flex"
      >
        {t("nav.signin")}
      </Link>
    );
  }
  return (
    <Link
      to="/auth"
      aria-label="身份"
      title="身份"
      className="grid h-8 w-8 place-items-center rounded-full bg-text font-mono text-[12px] font-semibold text-bg"
    >
      A
    </Link>
  );
}

export function AppLayout({ children, related }: { children: ReactNode; related?: ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <div className="mx-auto flex max-w-[1080px] gap-10 px-6 py-10">
        <main className={cn("min-w-0 flex-1", related && "lg:max-w-[720px]")}>{children}</main>
        {related && (
          <aside className="hidden w-[280px] shrink-0 lg:block">{related}</aside>
        )}
      </div>
    </div>
  );
}

/** 全站唯一 chrome：64px 顶部导航（landing 与应用内页共用） */
export function TopNav() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [q, setQ] = useState("");

  // 全局 ⌘K / Ctrl+K 唤起命令面板
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 路由变化时同步搜索框
  useEffect(() => {
    setQ(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.pathname, location.search]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/signals?q=${encodeURIComponent(term)}` : "/signals");
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center gap-6 px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <LogoMark />
            <span className="text-[15px] font-semibold tracking-tight">AgentSignal</span>
          </Link>

          <form
            onSubmit={onSearch}
            className="relative hidden w-full max-w-[320px] md:block"
          >
            <Search
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("nav.search")}
              className="h-9 w-full rounded-full border border-border bg-surface pl-9 pr-11 text-sm outline-none transition-colors placeholder:text-faint focus:border-text"
            />
            <button
              type="button"
              aria-label="打开命令面板"
              onClick={() => setPaletteOpen(true)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-faint transition-colors hover:text-text"
            >
              ⌘K
            </button>
          </form>

          <nav className="ml-auto flex items-center gap-1.5">
            <Link
              to="/signals"
              className={cn(
                "hidden h-9 items-center rounded-full px-3 text-sm transition-colors sm:inline-flex",
                location.pathname.startsWith("/signals") || location.pathname.startsWith("/topics/")
                  ? "text-text"
                  : "text-muted hover:text-text",
              )}
            >
              {t("nav.topics")}
            </Link>
            <button
              type="button"
              aria-label="切换语言"
              onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
              className="grid h-9 place-items-center rounded-full px-2 font-mono text-[11px] text-muted transition-colors hover:text-text"
            >
              {locale === "zh" ? "EN" : "中"}
            </button>
            <button
              type="button"
              aria-label="打开命令面板"
              onClick={() => setPaletteOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-text md:hidden"
            >
              <Search size={15} />
            </button>
            <button
              type="button"
              aria-label="切换主题"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="grid h-9 w-9 place-items-center rounded-full text-muted transition-colors hover:text-text"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <IdentityEntry />
            <Link
              to="/publish"
              className="inline-flex h-9 shrink-0 items-center rounded-full bg-text px-4 text-sm font-medium text-bg transition-opacity hover:opacity-80"
            >
              {t("nav.publish")}
            </Link>
          </nav>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
