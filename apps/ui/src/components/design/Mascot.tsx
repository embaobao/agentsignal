/**
 * Mascot —— 单线 SVG 线稿机器人（v5 设计唯一装饰元素，对标 llama 线稿的克制）。
 * 2.5px 线宽、currentColor 描边、零填充、胸口圆圈内 A 字。深色模式随文字色自动反白。
 * variant：default（站立）/ flag（举旗·空态）/ question（头顶问号·404）/ lock（抱锁·401）
 */

export type MascotVariant = "default" | "flag" | "question" | "lock";

export function Mascot({
  variant = "default",
  size = 120,
  className,
}: {
  variant?: MascotVariant;
  size?: number;
  className?: string;
}) {
  const s = {
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    fill: "none",
  } as const;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={className}
      {...s}
    >
      {/* 天线 */}
      <path d="M60 18V8" />
      <circle cx="60" cy="6" r="2.5" />
      {/* 头 */}
      <rect x="38" y="18" width="44" height="30" rx="9" />
      <circle cx="52" cy="33" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="68" cy="33" r="2.2" fill="currentColor" stroke="none" />
      <path d="M53 41q7 5 14 0" />
      {/* 身体 + 胸口 A 徽章 */}
      <rect x="42" y="52" width="36" height="30" rx="9" />
      <circle cx="60" cy="67" r="7" />
      <text
        x="60"
        y="70"
        textAnchor="middle"
        fontSize="8"
        fontFamily="ui-monospace, monospace"
        fill="currentColor"
        stroke="none"
      >
        A
      </text>
      {/* 腿 */}
      <path d="M52 82v10M48 92h8M68 82v10M64 92h8" />
      {/* 手臂：随 variant 变化 */}
      {variant === "flag" ? (
        <>
          <path d="M42 58l-9 9" />
          <path d="M78 56l12-12" />
          <path d="M90 44V16" />
          <path d="M90 16h20l-7 8 7 8H90" />
        </>
      ) : variant === "lock" ? (
        <>
          <path d="M42 58l-9 9M78 58l9 9" />
          <rect x="86" y="66" width="22" height="18" rx="5" />
          <path d="M91 66v-6a6 6 0 0 1 12 0v6" />
        </>
      ) : (
        <>
          <path d="M42 58l-9 9M78 58l9 9" />
          {variant === "question" && (
            <text
              x="88"
              y="16"
              fontSize="22"
              fontFamily="ui-monospace, monospace"
              fill="currentColor"
              stroke="none"
            >
              ?
            </text>
          )}
        </>
      )}
    </svg>
  );
}
