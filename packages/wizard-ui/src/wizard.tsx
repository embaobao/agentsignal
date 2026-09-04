/**
 * 状态 A · 初始化向导（3 步 + FooterBar 默认直通 + SubmitOverlay + 完成页）。
 * 跳过向导的直通按钮与 CI `--yes` 完全等价（规范 E-2）。
 */
import { useState, type ReactNode } from "react";
import { A, F } from "./copy.ts";
import { Chip, ChipInput, CheckboxRow, Button, SubmitOverlay, StepIndicator, Badge } from "./ui.tsx";

export interface HostOption {
  id: string;
  name: string;
  detected: boolean;
  path: string;
}

export interface StackOption {
  id: string;
  name: string;
}

export interface WizardProps {
  domainOptions: string[];
  stackOptions: StackOption[];
  hosts: HostOption[];
  defaults?: { domains: string[]; stacks: string[]; hosts: string[] };
  onSubmit: (payload: { domains: string[]; stacks: string[]; hosts: string[]; useDefaults?: boolean }) => Promise<{ ok: boolean; written?: { host: string; path: string }[]; reason?: string }>;
}

export function Wizard(props: WizardProps): ReactNode {
  const { domainOptions, stackOptions, hosts, defaults, onSubmit } = props;
  const [step, setStep] = useState(1);
  const [domains, setDomains] = useState<string[]>(defaults?.domains ?? []);
  const [stacks, setStacks] = useState<string[]>(defaults?.stacks ?? ["nextjs", "typescript"]);
  const [selectedHosts, setSelectedHosts] = useState<string[]>(
    defaults?.hosts ?? hosts.filter((h) => h.detected).map((h) => h.id),
  );
  const [custom, setCustom] = useState("");
  const [customError, setCustomError] = useState<string | undefined>();
  const [phase, setPhase] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | undefined>();
  const [written, setWritten] = useState<{ host: string; path: string }[] | undefined>();
  const [visited, setVisited] = useState<number[]>([1]);

  const addCustom = () => {
    const value = custom.trim();
    if (!value) return;
    if (domains.some((d) => d.toLowerCase() === value.toLowerCase())) {
      setCustom("");
      return;
    }
    if (value.length > 20) {
      setCustomError("单条领域不超过 20 字");
      return;
    }
    if (domains.filter((d) => !domainOptions.includes(d)).length >= 10) {
      setCustomError(A.chipLimit);
      return;
    }
    setCustomError(undefined);
    setDomains([...domains, value]);
    setCustom("");
  };

  const submit = async (useDefaults = false) => {
    setPhase("loading");
    setError(undefined);
    const result = await onSubmit({
      domains: useDefaults ? [] : domains,
      stacks: useDefaults ? ["nextjs", "typescript"] : stacks,
      hosts: useDefaults ? hosts.filter((h) => h.detected).map((h) => h.id) : selectedHosts,
      useDefaults,
    });
    if (result.ok) {
      setWritten(result.written ?? []);
      setPhase("idle");
    } else {
      setError(result.reason);
      setPhase("error");
    }
  };

  if (written) {
    return (
      <div className="container-wizard">
        <div className="done">
          <svg className="done-mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <h1 className="done-title">{F.title}</h1>
          <p className="done-sub">{F.subtitle}</p>
          {written.length > 0 ? (
            <div className="done-list">
              {written.map((w) => (
                <p key={`done-${w.host}`} className="mono">
                  {F.fileItem(w.host, w.path)}
                </p>
              ))}
            </div>
          ) : (
            <p className="done-sub">{F.noHosts}</p>
          )}
          <div className="done-next">
            <h2>{F.nextTitle}</h2>
            <p>{F.nextBody}</p>
          </div>
          <p className="page-foot">{F.footer}</p>
        </div>
      </div>
    );
  }

  const goNext = () => {
    const next = Math.min(step + 1, 3);
    setStep(next);
    if (!visited.includes(next)) setVisited([...visited, next]);
  };

  return (
    <div className="container-wizard">
      <StepIndicator current={step} />
      {step === 1 ? (
        <div className="step-panel">
          <h1 className="step-title">{A.step1Title}</h1>
          <p className="step-desc">{A.step1Desc}</p>
          <div className="chip-group">
            {domainOptions.map((d) => (
              <Chip
                key={`domain-${d}`}
                label={d}
                selected={domains.includes(d)}
                onToggle={() =>
                  setDomains(domains.includes(d) ? domains.filter((x) => x !== d) : [...domains, d])
                }
              />
            ))}
            {domains
              .filter((d) => !domainOptions.includes(d))
              .map((d) => (
                <Chip
                  key={`custom-${d}`}
                  label={d}
                  selected={true}
                  onRemove={() => setDomains(domains.filter((x) => x !== d))}
                />
              ))}
            <ChipInput value={custom} onChange={setCustom} onSubmit={addCustom} error={customError} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="step-panel">
          <h1 className="step-title">{A.step2Title}</h1>
          <p className="step-desc">{A.step2Desc}</p>
          <div className="row-list">
            {stackOptions.map((s) => (
              <CheckboxRow
                key={`stack-${s.id}`}
                title={s.name}
                checked={stacks.includes(s.id)}
                onToggle={() =>
                  setStacks(stacks.includes(s.id) ? stacks.filter((x) => x !== s.id) : [...stacks, s.id])
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="step-panel">
          <h1 className="step-title">{A.step3Title}</h1>
          <p className="step-desc">{A.step3Desc}</p>
          {hosts.every((h) => !h.detected) ? (
            <p className="empty-text">{A.emptyHosts}</p>
          ) : null}
          <div className="row-list">
            {[...hosts]
              .sort((a, b) => Number(b.detected) - Number(a.detected))
              .map((h) => (
                <CheckboxRow
                  key={`host-${h.id}`}
                  title={h.name}
                  desc={h.path}
                  checked={selectedHosts.includes(h.id)}
                  onToggle={() =>
                    setSelectedHosts(
                      selectedHosts.includes(h.id)
                        ? selectedHosts.filter((x) => x !== h.id)
                        : [...selectedHosts, h.id],
                    )
                  }
                  badge={
                    h.detected ? (
                      <Badge tone="success">
                        <i className="dot dot-success" aria-hidden="true" /> {A.detected}
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <i className="dot dot-neutral" aria-hidden="true" /> {A.undetected}
                      </Badge>
                    )
                  }
                />
              ))}
          </div>
        </div>
      ) : null}

      <div className="wizard-nav">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            {A.prev}
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button variant="primary" onClick={goNext}>
            {A.next}
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void submit(false)}>
            {A.submit}
          </Button>
        )}
      </div>

      <div className="footer-bar">
        <Button variant="secondary" onClick={() => void submit(true)}>
          {A.footerBtn}
        </Button>
        <span className="footer-desc">{A.footerDesc}</span>
      </div>

      {phase === "loading" ? <SubmitOverlay phase="loading" /> : null}
      {phase === "error" ? (
        <SubmitOverlay
          phase="error"
          error={error}
          onRetry={() => void submit(false)}
          onBack={() => {
            setPhase("idle");
            setStep(3);
          }}
        />
      ) : null}
    </div>
  );
}
