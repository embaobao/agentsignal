/**
 * 状态 B · 管理/状态视图：配置摘要 + 路由图（@xyflow/react，点击宿主节点切换接线）
 * + 本地库 + 双指标 + 操作 + 危险区（Base UI DangerDialog）+ 卸载完成页。
 *
 * 路由图是 config.json5 的视图 + 编辑面：图上点击只改「待应用」状态，点「应用接线」才落盘。
 */
import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  Background,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Dialog } from "@base-ui/react/dialog";
import { Checkbox } from "@base-ui/react/checkbox";
import { B, D } from "./copy.ts";
import {
  Alert,
  Button,
  EmptyState,
  MetricCards,
  Panel,
  StatusRow,
  type WireState,
} from "./ui.tsx";

export interface HostState {
  id: string;
  name: string;
  detected: boolean;
  path: string;
  mcp: WireState;
}

export interface ManageProps {
  config: { domains?: { current?: string; available?: string[] }; layers?: { id: string; name: string }[] };
  hosts: HostState[];
  stats: { skill_count: number; bytes_total: number; index_rebuilt_at: string | null };
  metrics: { throughput_saved: number; residual: number };
  root: string;
  onRerun: () => void;
  onWire: (hosts: string[]) => Promise<{ ok: boolean; failed?: { host: string; reason: string }[] }>;
  onUninstall: () => Promise<{ ok: boolean; failed?: { host: string; reason: string }[]; dataKept: string }>;
}

function HostNode({ data, selected }: NodeProps): ReactNode {
  const state = data.state as WireState;
  const cls = state === "wired" ? "dot-success" : state === "drift" ? "dot-warning" : "dot-neutral";
  return (
    <div className={`flow-node ${selected ? "is-selected" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <span className="flow-node-title">{data.label as string}</span>
      <span className="flow-node-state">
        <i className={`dot ${cls}`} aria-hidden="true" />
        {state === "wired" ? B.wired : state === "drift" ? B.drift : B.unwired}
      </span>
    </div>
  );
}

const nodeTypes = { host: HostNode };

export function Manage(props: ManageProps): ReactNode {
  const { config, hosts, stats, metrics, root, onRerun, onWire, onUninstall } = props;
  const [desired, setDesired] = useState<Set<string>>(
    new Set(hosts.filter((h) => h.mcp === "wired").map((h) => h.id)),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [uninstalled, setUninstalled] = useState<string | undefined>();

  const toggle = useCallback((id: string) => {
    setDesired((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const nodes = useMemo<Node[]>(() => {
    const engine: Node = {
      id: "engine",
      type: "input",
      position: { x: 0, y: 160 },
      data: { label: "AgentSignal 本地引擎" },
      className: "flow-engine",
    };
    return [
      engine,
      ...hosts.map((h, i) => ({
        id: h.id,
        type: "host" as const,
        position: { x: 260, y: i * 90 },
        data: { label: h.name, state: desired.has(h.id) ? "wired" : h.mcp === "drift" ? "drift" : "unwired" },
      })),
    ];
  }, [hosts, desired]);

  const edges = useMemo<Edge[]>(
    () =>
      hosts.map((h) => {
        const on = desired.has(h.id);
        return {
          id: `e-${h.id}`,
          source: "engine",
          target: h.id,
          animated: false,
          style: {
            stroke: on ? "var(--color-success)" : h.mcp === "drift" ? "var(--color-warning)" : "var(--color-neutral-400)",
            strokeWidth: on ? 2 : 1.5,
          },
        };
      }),
    [hosts, desired],
  );

  const applyWiring = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await onWire([...desired]);
    if (result.ok) {
      setFeedback({ tone: "success", text: "接线已更新并写入配置。" });
    } else {
      const detail = (result.failed ?? []).map((f) => `${f.host}：${f.reason}`).join("；");
      setFeedback({ tone: "error", text: B.repairPartial(result.failed?.length ?? 0, detail) });
    }
    setBusy(false);
  };

  const repair = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await onWire(hosts.map((h) => h.id));
    if (result.ok) setFeedback({ tone: "success", text: B.repairOk(hosts.length) });
    else {
      const detail = (result.failed ?? []).map((f) => `${f.host}：${f.reason}`).join("；");
      setFeedback({ tone: "error", text: B.repairPartial(result.failed?.length ?? 0, detail) });
    }
    setBusy(false);
  };

  const doUninstall = async () => {
    setBusy(true);
    const result = await onUninstall();
    setBusy(false);
    setDialogOpen(false);
    setUninstalled(result.dataKept ?? root);
  };

  if (uninstalled) {
    return (
      <div className="container-manage">
        <div className="done">
          <h1 className="done-title">{D.doneTitle}</h1>
          <p className="done-sub">{D.doneBody(uninstalled)}</p>
        </div>
      </div>
    );
  }

  const allWired = hosts.every((h) => h.mcp === "wired");
  const stackRules = (config.layers ?? []).find((l) => l.id === "domain")?.name ?? "—";
  const sizeText = `${(stats.bytes_total / 1024 / 1024).toFixed(2)} MB`;
  const indexText = stats.index_rebuilt_at
    ? new Date(stats.index_rebuilt_at).toISOString().slice(0, 16).replace("T", " ")
    : "—";

  return (
    <div className="container-manage">
      {feedback ? (
        <Alert tone={feedback.tone === "info" ? "info" : feedback.tone}>{feedback.text}</Alert>
      ) : null}

      <Panel title={B.summary}>
        <div className="summary-row">
          <span className="summary-label">{B.domainsLabel}</span>
          <span className="summary-value">
            {(config.domains?.available ?? []).filter((d) => d !== "common").length > 0
              ? (config.domains?.available ?? []).filter((d) => d !== "common").join(" · ")
              : B.domainsEmpty}
          </span>
        </div>
        <div className="summary-row">
          <span className="summary-label">{B.stacksLabel}</span>
          <span className="summary-value">{stackRules}</span>
        </div>
      </Panel>

      <Panel title={B.wiring} desc="点击宿主节点切换接线，改完点「应用接线」落盘。">
        <div className="flow-wrap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              if (node.id !== "engine") toggle(node.id);
            }}
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} size={1} color="var(--color-border)" />
          </ReactFlow>
        </div>
        <div className="row-list">
          {hosts.map((h) => (
            <StatusRow
              key={`status-${h.id}`}
              title={h.name}
              path={h.path}
              state={h.mcp}
              onFix={() => void repair()}
            />
          ))}
        </div>
      </Panel>

      <Panel title={B.library}>
        {stats.skill_count > 0 ? (
          <p className="library-line">
            {B.entries(stats.skill_count)} · {B.indexRebuilt(indexText)} · {B.storage(sizeText)}
          </p>
        ) : (
          <EmptyState>{B.libraryEmpty}</EmptyState>
        )}
      </Panel>

      <Panel title={B.metrics}>
        <MetricCards throughput={metrics.throughput_saved} residual={metrics.residual} />
      </Panel>

      <Panel title={B.actions}>
        <div className="actions">
          <Button variant="secondary" onClick={onRerun}>
            {B.rerun}
          </Button>
          <Button variant="secondary" disabled={allWired || busy} loading={busy} onClick={() => void applyWiring()}>
            {B.repair}
          </Button>
          {allWired ? <span className="field-note">{B.repairDisabled}</span> : null}
        </div>
      </Panel>

      <Panel title={B.dangerTitle} desc={B.dangerDesc} tone="danger">
        <div className="danger-row">
          <Button variant="danger" onClick={() => setDialogOpen(true)}>
            {B.dangerBtn}
          </Button>
        </div>
      </Panel>

      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setAck(false);
        }}
        dismissible={false}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Popup className="dialog">
            <Dialog.Title className="dialog-title">{D.title}</Dialog.Title>
            <Dialog.Description className="dialog-desc">{D.desc}</Dialog.Description>
            <ul className="file-list">
              {hosts.map((h) => (
                <li key={`rm-${h.id}`} className="mono">
                  {h.path}
                </li>
              ))}
            </ul>
            <label className="ack-row">
              <Checkbox.Root
                className="checkbox"
                checked={ack}
                onCheckedChange={(checked) => setAck(Boolean(checked))}
              >
                <Checkbox.Indicator className="checkbox-indicator">✓</Checkbox.Indicator>
              </Checkbox.Root>
              <span>{D.acknowledge}</span>
            </label>
            <div className="dialog-actions">
              <Dialog.Close render={<Button variant="ghost" />}>{D.cancel}</Dialog.Close>
              <Button variant="danger-solid" disabled={!ack} loading={busy} onClick={() => void doUninstall()}>
                {D.confirm}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
