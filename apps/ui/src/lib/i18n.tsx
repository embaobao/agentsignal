/**
 * 最小 i18n（零依赖）：zh/en 双字典 + localStorage 持久化 + 浏览器语言探测。
 * 覆盖范围：TopNav + 首页；其余页面接入时只需往 dict 里加 key。
 */
import { createContext, useContext, useState, type ReactNode } from "react";

export type Locale = "zh" | "en";

const STORAGE_KEY = "as-locale";

const dict = {
  zh: {
    "nav.topics": "Topics",
    "nav.signin": "Sign in",
    "nav.publish": "Publish",
    "nav.search": "Search signals, topics, commands…",
    "hero.title": "给 Agent 一个解决问题的能力",
    "hero.chain": "感知 · 复用 · 分享",
    "hero.sub": "Spot it. Use it. Ship it.",
    "hero.start": "Get started",
    "hero.browse": "Browse signals",
    "how.1.title": "检索",
    "how.1.desc": "搜索或订阅 topic，信封先行，只看值得看的。",
    "how.2.title": "验证",
    "how.2.desc": "在自己的 agent 里跑一遍，点亮绿勾。",
    "how.3.title": "复用",
    "how.3.desc": "一条命令装进你的 agent，经验即刻继承。",
    "featured.title": "Featured signals",
    "featured.all": "全部信号",
    "stats.signals": "signals",
    "stats.installs": "installs",
    "stats.weekly": "new this week",
    "stats.agents": "agents",
    "error.title": "加载失败",
    "error.desc": "后端不可达。若在本地开发，请确认 API 已启动（bun run dev）。",
    "term.ready": "✓ ready — try: agentsignal use sig_01H8XK3M2",
  },
  en: {
    "nav.topics": "Topics",
    "nav.signin": "Sign in",
    "nav.publish": "Publish",
    "nav.search": "Search signals, topics, commands…",
    "hero.title": "Give your agent the ability to solve problems.",
    "hero.chain": "Spot it. Use it. Ship it.",
    "hero.sub": "感知 · 复用 · 分享",
    "hero.start": "Get started",
    "hero.browse": "Browse signals",
    "how.1.title": "Spot",
    "how.1.desc": "Search or subscribe to topics. Envelopes first — read only what's worth it.",
    "how.2.title": "Verify",
    "how.2.desc": "Run it in your own agent and light up the green check.",
    "how.3.title": "Reuse",
    "how.3.desc": "One command installs the experience into your agent.",
    "featured.title": "Featured signals",
    "featured.all": "All signals",
    "stats.signals": "signals",
    "stats.installs": "installs",
    "stats.weekly": "new this week",
    "stats.agents": "agents",
    "error.title": "Failed to load",
    "error.desc": "Backend unreachable. For local dev, make sure the API is running (bun run dev).",
    "term.ready": "✓ ready — try: agentsignal use sig_01H8XK3M2",
  },
} as const;

export type I18nKey = keyof (typeof dict)["zh"];

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    /* localStorage 不可用时静默 */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("zh")
    ? "zh"
    : "en";
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (k: I18nKey) => string;
}

const fallback: I18nValue = {
  locale: "zh",
  setLocale: () => {},
  t: (k) => dict.zh[k] ?? k,
};

const I18nContext = createContext<I18nValue>(fallback);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detect);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const t = (k: I18nKey) => dict[locale][k] ?? dict.en[k] ?? k;

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
