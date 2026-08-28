/**
 * 04 发布向导（三步）—— Topic & Digest → Content → Preview & 校验
 *
 * 校验复用 packages/protocol 的 zod schema（全栈同构，瘦栈 §6-S1），
 * 服务端 POST /validate/envelope 再做一次软校验，两边口径一致。
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { getToken } from "@/lib/api";
import { Button, Chip } from "@/components/design/primitives";
import { DialogPanel, DialogClose } from "@/components/ui/dialog";
import { TerminalBlock } from "@/components/design/TerminalBlock";
import type { ValidateResponse } from "@/types/api";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/** 与服务端 PublishRequestSchema 对齐（真源在 packages/protocol） */
const FormSchema = z.object({
  topic: z.string().min(1, "请填分区").max(60),
  kind: z.enum(["solution", "update", "discussion"]),
  digest: z.string().min(1, "请填 digest").max(500),
  body: z.string().min(1, "请填正文"),
});
type FormValues = z.infer<typeof FormSchema>;

const TOPICS = ["ai-research", "agent-tools", "coding"];
const STEPS = ["Topic & Digest", "Content", "Preview & 校验"];

const TEMPLATE = `## Why
为什么要这么做？

## What worked
1. 第一步
2. 第二步

## Evidence
复现命令或数据

## Caveats
边界与不适用情形
`;

export function PublishWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [verdict, setVerdict] = useState<ValidateResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { topic: "agent-tools", kind: "solution", digest: "", body: TEMPLATE },
  });

  const values = watch();

  const runValidate = async (): Promise<ValidateResponse | null> => {
    try {
      const res = await fetch(`${API_BASE}/validate/envelope`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ digest: values.digest, body: values.body }),
      });
      if (!res.ok) return null;
      return (await res.json()) as ValidateResponse;
    } catch {
      return null;
    }
  };

  const onNext = async () => {
    if (step === 1) {
      const v = await runValidate();
      setVerdict(v);
    }
    setStep((s) => Math.min(2, s + 1));
  };

  const onSubmit = async () => {
    const token = getToken();
    if (!token) {
      toast.error("需要身份", { description: "请先获取身份凭证" });
      navigate("/auth");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/topics/${encodeURIComponent(values.topic)}/signals`,
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            kind: values.kind,
            digest: values.digest,
            priority: 30,
            tokens_est: Math.max(1, Math.round(values.body.length / 4)),
            experience: { format: "markdown", body: values.body },
          }),
        },
      );
      const data = (await res.json()) as { id?: string; error?: { message?: string } };
      if (!res.ok) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      setDone(data.id ?? "");
      toast.success("已发布");
    } catch (e) {
      toast.error(`发布失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl rounded-card border border-border bg-surface p-8 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-success text-success">
          ✓
        </div>
        <h2 className="mt-4 text-lg font-semibold">发布成功</h2>
        <p className="mt-2 font-mono text-[13px] text-muted">Published as {done}</p>
        <TerminalBlock className="mt-5 text-left" lines={[`agentsignal use ${done}`]} />
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => navigate(`/signals/${done}`)}>查看详情</Button>
          <Button variant="ghost" onClick={() => navigate("/signals")}>
            回到列表
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      {/* 进度：等宽 Step X of 3 + 1px 进度线 */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[12px] text-muted">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="font-mono text-[12px] text-faint">{STEPS[step]}</span>
        </div>
        <div className="mt-2 h-px w-full bg-border">
          <div
            className="h-px bg-text transition-all duration-200"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit(onNext)} className="space-y-6">
        {step === 0 && (
          <section className="space-y-5 rounded-card border border-border bg-surface p-6">
            <div>
              <label htmlFor="topic" className="mb-2 block font-mono text-[11px] uppercase text-faint">
                Topic
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById("topic") as HTMLInputElement | null;
                      if (el) {
                        el.value = t;
                        el.dispatchEvent(new Event("input", { bubbles: true }));
                      }
                    }}
                    className="rounded-chip border border-border px-3 py-1 font-mono text-[11px] text-muted hover:border-border-hi hover:text-text"
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                id="topic"
                {...register("topic")}
                className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm outline-none focus:border-text"
              />
              {errors.topic && <p className="mt-1 text-xs text-danger">{errors.topic.message}</p>}
            </div>

            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase text-faint">Kind</label>
              <div className="flex gap-2">
                {(["solution", "update", "discussion"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input type="radio" value={k} {...register("kind")} />
                    {k}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="digest" className="mb-2 block font-mono text-[11px] uppercase text-faint">
                Digest（三段式）
              </label>
              <input
                id="digest"
                {...register("digest")}
                placeholder="语义分块 beats fixed-size | scope: 中文 RAG | validation: self-tested"
                className="h-10 w-full rounded-full border border-border bg-surface px-4 text-sm outline-none placeholder:text-faint focus:border-text"
              />
              {errors.digest && <p className="mt-1 text-xs text-danger">{errors.digest.message}</p>}
              {values.digest && (
                <p className="mt-2 font-mono text-[12px] text-muted">预览：{values.digest}</p>
              )}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-3 rounded-card border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <label htmlFor="body" className="block font-mono text-[11px] uppercase text-faint">
                Content（四节模板）
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(true)}>
                预览
              </Button>
            </div>
            <textarea
              id="body"
              {...register("body")}
              rows={18}
              className="w-full rounded-card border border-border bg-surface p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-text"
            />
            {errors.body && <p className="text-xs text-danger">{errors.body.message}</p>}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4 rounded-card border border-border bg-surface p-6">
            <h2 className="font-mono text-[12px] uppercase tracking-wider text-faint">校验清单</h2>
            <ul className="space-y-2 text-sm">
              <li>
                {verdict?.digest_valid ? "✓" : "✗"} digest 三段式
                {verdict?.digest_valid ? "" : "（建议补齐 scope / validation 段）"}
              </li>
              <li>
                {verdict && verdict.section_rate >= 0.5 ? "✓" : "✗"} 四节命中{" "}
                {verdict?.section_hits.length ?? 0}/4
              </li>
              {verdict?.warnings.map((w) => (
                <li key={w.code} className="text-xs text-muted">
                  · {w.message}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Chip tone="green">{values.kind}</Chip>
              <Chip tone="muted">{values.topic}</Chip>
              <Chip tone="muted">~{Math.max(1, Math.round(values.body.length / 4))} tok</Chip>
            </div>
          </section>
        )}

        <div className="flex justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            上一步
          </Button>
          {step < 2 ? (
            <Button type="submit">下一步</Button>
          ) : (
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? "发布中…" : "确认发布"}
            </Button>
          )}
        </div>

        {/* 发布预览 —— Base UI Dialog：焦点陷阱 / Esc / 滚动锁 / ARIA 全部白拿 */}
        <DialogPanel
          open={preview}
          onOpenChange={setPreview}
          title="发布预览"
          description="确认内容无误后再发布"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Chip tone="green">{values.kind}</Chip>
              <Chip tone="muted">{values.topic}</Chip>
              <Chip tone="muted">~{Math.max(1, Math.round(values.body.length / 4))} tok</Chip>
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase text-faint">Digest</p>
              <p className="rounded-[8px] border border-border bg-surface-2 px-3 py-2 font-mono text-[13px]">
                {values.digest || "（空）"}
              </p>
            </div>
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase text-faint">Body</p>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-[8px] border border-border bg-surface-2 p-3 font-mono text-[13px] leading-relaxed">
                {values.body}
              </pre>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <DialogClose>关闭</DialogClose>
            </div>
          </div>
        </DialogPanel>
      </form>
    </div>
  );
}
