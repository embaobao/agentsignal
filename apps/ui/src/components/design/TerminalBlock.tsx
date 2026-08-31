/**
 * TerminalBlock —— 深色终端命令块（v5 转化核心，对标 ollama run）。
 * 全站唯一「常驻深色」组件：浅色主题下也用 --term-bg 底白字，不随主题反转。
 *
 * 行约定：普通行 = 命令（$ 前缀）；`# ` 开头 = 等宽灰输出；`! ` 开头 = success 绿输出。
 * animate=true 时模拟控制台打印：首行命令逐字打出（光标闪烁），输出行随后逐行浮现。
 * reduced-motion 与测试环境直接渲染终态（fail-open）。
 *
 * tabs：可选身份分标签（我是人 → npx CLI / 我是 Agent → SKILL 直发），
 * 单标签时不渲染 tab 栏。切 tab 重放打字动效；复制按钮复制当前 tab 全部行。
 */
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 逐字打字（motion-design Corporate 口径：snappy，总时长硬顶 1.2s）。
 * 长命令自动提速（interval = clamp(1200/len, 8, 24)ms），reduced-motion / 测试直接终态。
 */
function useTypewriter(text: string, enabled: boolean) {
  const instant =
    !enabled ||
    import.meta.env.MODE === "test" ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [n, setN] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setN(text.length);
      return;
    }
    setN(0);
    const interval = Math.min(24, Math.max(8, Math.round(1200 / Math.max(1, text.length))));
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(iv);
          return v;
        }
        return v + 1;
      });
    }, interval);
    return () => clearInterval(iv);
  }, [text, instant]);

  return { typed: text.slice(0, n), done: n >= text.length };
}

export interface TerminalTab {
  /** tab 名（我是人 / 我是 Agent） */
  label: string;
  lines: string[];
}

export function TerminalBlock({
  lines,
  tabs,
  animate = false,
  className,
}: {
  /** 单标签模式下的命令行（传 tabs 时可省） */
  lines?: string[];
  /** 双标签：传则忽略 lines，按身份切换命令组 */
  tabs?: TerminalTab[];
  /** 控制台打印动效：首行逐字打出，其余行逐行浮现 */
  animate?: boolean;
  className?: string;
}) {
  const groups = tabs ?? [{ label: "", lines: lines ?? [] }];
  const [tab, setTab] = useState(0);
  const active = groups[Math.min(tab, groups.length - 1)] ?? groups[0];
  const [copied, setCopied] = useState(false);
  const command = active.lines.find((l) => !l.startsWith("#") && !l.startsWith("!")) ?? "";
  const outputs = active.lines.filter((l) => l !== command);
  const { typed, done } = useTypewriter(command, animate);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command || active.lines.join("\n"));
      setCopied(true);
      toast.success("已复制命令");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const renderLine = (l: string, key: string, typedText?: string, typedDone = true) => {
    if (l.startsWith("#")) {
      return (
        <p key={key} className="text-term-faint">
          {l.slice(2)}
        </p>
      );
    }
    if (l.startsWith("!")) {
      return (
        <p key={key} className="text-success">
          {l.slice(2)}
        </p>
      );
    }
    return (
      <p key={key}>
        <span className="mr-2 text-term-faint">$</span>
        {typedText ?? l}
        {typedText !== undefined && !typedDone && (
          <span className="ml-0.5 inline-block h-[14px] w-[7px] translate-y-[2px] animate-pulse bg-term-text" />
        )}
      </p>
    );
  };

  return (
    <div
      className={cn(
        "relative rounded-card border border-[#262626] bg-term-bg px-5 py-4 font-mono text-[13px] leading-relaxed text-term-text",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {groups.length > 1 && (
          <div className="flex gap-1" role="tablist" aria-label="接入方式">
            {groups.map((g, i) => (
              <button
                key={g.label}
                type="button"
                role="tab"
                aria-selected={i === tab}
                onClick={() => {
                  setTab(i);
                  setCopied(false);
                }}
                className={cn(
                  "rounded-[4px] px-2 py-0.5 text-[11px] font-mono transition-colors",
                  i === tab
                    ? "bg-term-text/10 text-term-text"
                    : "text-term-faint hover:text-term-text",
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label="Copy command"
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full text-term-faint transition-colors hover:text-term-text",
            groups.length === 1 && "absolute right-3 top-3",
          )}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {renderLine(command, `${tab}:${command}`, animate ? typed : undefined, done)}
        {outputs.map((l, i) =>
          done ? (
            <span
              key={`${tab}:${l}`}
              className={cn("block", animate && "animate-in fade-in duration-300")}
              style={animate ? { animationDelay: `${i * 120 + 120}ms` } : undefined}
            >
              {renderLine(l, `${tab}:${l}`)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
