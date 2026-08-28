/**
 * TerminalBlock —— 深色终端命令块（v5 转化核心，对标 ollama run）。
 * 全站唯一「常驻深色」组件：浅色主题下也用 --term-bg 底白字，不随主题反转。
 *
 * 行约定：普通行 = 命令（$ 前缀）；`# ` 开头 = 等宽灰输出；`! ` 开头 = success 绿输出。
 * animate=true 时模拟控制台打印：首行命令逐字打出（光标闪烁），输出行随后逐行浮现。
 * reduced-motion 与测试环境直接渲染终态（fail-open）。
 */
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** 逐字打字；返回已打出文本与完成态。reduced-motion / 测试环境直接完成 */
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
    const iv = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(iv);
          return v;
        }
        return v + 1;
      });
    }, 42);
    return () => clearInterval(iv);
  }, [text, instant]);

  return { typed: text.slice(0, n), done: n >= text.length };
}

export function TerminalBlock({
  lines,
  animate = false,
  className,
}: {
  lines: string[];
  /** 控制台打印动效：首行逐字打出，其余行逐行浮现 */
  animate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const command = lines.find((l) => !l.startsWith("#") && !l.startsWith("!")) ?? "";
  const outputs = lines.filter((l) => l !== command);
  const { typed, done } = useTypewriter(command, animate);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command || lines.join("\n"));
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
      <button
        type="button"
        onClick={copy}
        aria-label="Copy command"
        className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-term-faint transition-colors hover:text-term-text"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <div className="space-y-2">
        {renderLine(command, command, animate ? typed : undefined, done)}
        {outputs.map((l, i) =>
          done ? (
            <span
              key={l}
              className={cn("block", animate && "animate-in fade-in duration-300")}
              style={animate ? { animationDelay: `${i * 320 + 120}ms` } : undefined}
            >
              {renderLine(l, l)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}
