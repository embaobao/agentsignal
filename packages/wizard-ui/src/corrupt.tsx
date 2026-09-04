/**
 * 状态 C · 配置损坏（降级态）：错误摘要 + 自动修复 / 备份后重新初始化。
 * 重新初始化前备份为 `<filename>.bak-<时间戳>`（规范 E-4）。
 */
import { useState, type ReactNode } from "react";
import { C } from "./copy.ts";
import { Alert, Button, Panel } from "./ui.tsx";

export interface CorruptProps {
  message: string;
  onAutofix: () => Promise<{ ok: boolean; reason?: string }>;
  onReinit: () => Promise<{ ok: boolean; backup?: string }>;
}

export function Corrupt({ message, onAutofix, onReinit }: CorruptProps): ReactNode {
  const [busy, setBusy] = useState(false);
  const [fixError, setFixError] = useState<string | undefined>();
  const [backup, setBackup] = useState<string | undefined>();

  const autofix = async () => {
    setBusy(true);
    const r = await onAutofix();
    setBusy(false);
    if (!r.ok) setFixError(C.autofixFail(r.reason ?? "未知原因"));
    else location.reload();
  };

  const reinit = async () => {
    setBusy(true);
    const r = await onReinit();
    setBusy(false);
    setBackup(r.backup ?? "config.json5.bak");
  };

  return (
    <div className="container-wizard">
      {backup ? <Alert tone="info">{C.backup(backup)}</Alert> : null}
      {fixError ? <Alert tone="error">{fixError}</Alert> : null}
      <Panel title={C.title} desc={C.desc}>
        <pre className="mono error-block">{message}</pre>
        <div className="actions">
          <Button variant="primary" loading={busy} onClick={() => void autofix()}>
            {C.autofix}
          </Button>
          <Button variant="secondary" loading={busy} onClick={() => void reinit()}>
            {C.reinit}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
