/**
 * 基础组件（设计规范 §2 组件清单）。
 * 浅色唯一主题；无 emoji，图标全部内联 SVG；可交互元素键盘可达 + :focus-visible 描边。
 */
import type { ReactNode } from "react";
import { G } from "./copy.ts";
import { LOGO_DATA_URL } from "./generated/logo.ts";

/* ------------------------------- Header ------------------------------- */

export function Header(): ReactNode {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="wordmark">
          <img src={LOGO_DATA_URL} alt="" className="logo" />
          <span>{G.wordmark}</span>
        </div>
        <span className="badge badge-success">
          <i className="dot dot-success" aria-hidden="true" />
          {G.badge}
        </span>
      </div>
    </header>
  );
}

/* ------------------------------- Button ------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-solid";

export function Button(props: {
  variant?: Variant;
  size?: "md" | "sm";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: ReactNode;
}): ReactNode {
  const { variant = "primary", size = "md", disabled, loading, onClick, children } = props;
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled ?? loading}
      onClick={onClick}
    >
      {loading ? <Spinner size={12} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function Spinner({ size = 12 }: { size?: 12 | 20 }): ReactNode {
  return <i className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

/* ------------------------------- StepIndicator ------------------------------- */

export function StepIndicator({ current, total = 3 }: { current: number; total?: number }): ReactNode {
  return (
    <div className="steps">
      <div
        className="steps-bars"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={`step-${i + 1}`}
            className={`step-bar ${i + 1 <= current ? "is-done" : ""} ${i + 1 === current ? "is-current" : ""}`}
          />
        ))}
      </div>
      <span className="steps-label">第 {current} 步，共 {total} 步</span>
    </div>
  );
}

/* ------------------------------- Panel / Section ------------------------------- */

export function Panel({
  title,
  desc,
  children,
  tone,
}: { title?: string; desc?: string; children: ReactNode; tone?: "danger" }): ReactNode {
  return (
    <section className={`panel ${tone === "danger" ? "panel-danger" : ""}`}>
      {title ? <h2 className="panel-title">{title}</h2> : null}
      {desc ? <p className="panel-desc">{desc}</p> : null}
      {children}
    </section>
  );
}

/* ------------------------------- Chip ------------------------------- */

export function Chip({
  label,
  selected,
  onToggle,
  onRemove,
}: {
  label: string;
  selected: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}): ReactNode {
  return (
    <span className={`chip ${selected ? "is-selected" : ""}`}>
      <button type="button" aria-pressed={selected} onClick={onToggle}>
        {label}
      </button>
      {onRemove ? (
        <button type="button" className="chip-x" aria-label={`删除 ${label}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </span>
  );
}

export function ChipInput({
  value,
  onChange,
  onSubmit,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error?: string;
}): ReactNode {
  return (
    <div className="chip-input-wrap">
      <input
        className={`chip-input ${error ? "is-error" : ""}`}
        value={value}
        placeholder="输入领域，回车添加"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

/* ------------------------------- CheckboxRow ------------------------------- */

export function CheckboxRow({
  title,
  desc,
  checked,
  onToggle,
  badge,
  disabled,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  disabled?: boolean;
}): ReactNode {
  return (
    <div
      className={`row ${checked ? "is-checked" : ""} ${disabled ? "is-disabled" : ""}`}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => !disabled && onToggle()}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (!disabled) onToggle();
        }
      }}
    >
      <span className={`checkbox ${checked ? "is-checked" : ""}`} aria-hidden="true">
        {checked ? (
          <svg viewBox="0 0 16 16" width="12" height="12">
            <path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : null}
      </span>
      <span className="row-main">
        <span className="row-title">{title}</span>
        {desc ? <span className="row-desc">{desc}</span> : null}
      </span>
      {badge ? <span className="row-badge">{badge}</span> : null}
    </div>
  );
}

/* ------------------------------- StatusRow ------------------------------- */

export type WireState = "wired" | "unwired" | "drift";

export function StatusRow({
  title,
  path,
  state,
  onFix,
}: { title: string; path?: string; state: WireState; onFix?: () => void }): ReactNode {
  const label = state === "wired" ? "已接线" : state === "drift" ? "配置漂移" : "未接线";
  return (
    <div className="row row-status">
      <span className="row-main">
        <span className="row-title">{title}</span>
        {path ? (
          <span className="row-desc mono ellipsis" title={path}>
            {path}
          </span>
        ) : null}
      </span>
      <span className="row-badge">
        <StatusDot state={state} />
        <span className="status-text">{label}</span>
        {state === "drift" && onFix ? (
          <button type="button" className="btn btn-secondary btn-sm inline-fix" onClick={onFix}>
            修复此行
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function StatusDot({ state }: { state: WireState }): ReactNode {
  const cls = state === "wired" ? "dot-success" : state === "drift" ? "dot-warning" : "dot-neutral";
  return <i className={`dot ${cls}`} aria-hidden="true" />;
}

/* ------------------------------- MetricCard / Alert ------------------------------- */

export function MetricCards({
  throughput,
  residual,
}: { throughput: number; residual: number }): ReactNode {
  return (
    <div className="metrics">
      <MetricCard title="吞吐节省" value={throughput} desc="估算在进入上下文前被省掉的 token 数量" />
      <MetricCard title="残留占用" value={residual} desc="会话结束时仍占用上下文窗口的部分" />
      <p className="metrics-note">
        按 bytes ÷ 4 估算 token 数，仅为量级参考，不代表账单金额。
      </p>
    </div>
  );
}

function MetricCard({ title, value, desc }: { title: string; value: number; desc: string }): ReactNode {
  return (
    <div className="metric">
      <span className="metric-name">{title}</span>
      <span className="metric-value mono">{value.toLocaleString("en-US")}</span>
      <span className="metric-unit">tokens（估算）</span>
      <span className="metric-desc">{desc}</span>
    </div>
  );
}

export function Alert({
  tone,
  children,
  action,
}: { tone: "info" | "success" | "error"; children: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <span className="alert-body">{children}</span>
      {action ? <span className="alert-action">{action}</span> : null}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "success" | "neutral" | "warning"; children: ReactNode }): ReactNode {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}

/* ------------------------------- SubmitOverlay ------------------------------- */

export function SubmitOverlay({
  phase,
  error,
  onRetry,
  onBack,
}: { phase: "loading" | "error"; error?: string; onRetry?: () => void; onBack?: () => void }): ReactNode {
  return (
    <div className="overlay">
      <div className="overlay-card">
        {phase === "loading" ? (
          <div className="overlay-loading">
            <Spinner size={20} />
            <span>正在写入配置…</span>
          </div>
        ) : (
          <div className="overlay-error">
            <Alert tone="error">{error ?? "发生未知错误，请重试"}</Alert>
            <div className="overlay-actions">
              <Button variant="primary" size="sm" onClick={onRetry}>
                重试
              </Button>
              <Button variant="ghost" size="sm" onClick={onBack}>
                返回修改
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
