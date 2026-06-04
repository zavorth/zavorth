"use client";

import { useEffect, useMemo, useState } from "react";
import { buildCommandCenterRuntimeAuthHeaders } from "../../controlPageClient.utils";
import { CommandCenterBadge, CommandCenterCard } from "./CommandCenterPrimitives";
import type {
  CommandCenterSalesPackBusinessController,
  CommandCenterSalesPackSnapshot,
} from "./useCommandCenterSalesPackBusinessMode";

type SalesPackChannelIoSnapshot = {
  generatedAt: string;
  summary: {
    inboundReceived: number;
    processed: number;
    duplicates: number;
    rejected: number;
    statusOnly: number;
    knownMessageIds: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  sourceSnapshots: {
    recentEvents: Array<{
      id: string;
      kind: string;
      traceId: string;
      summary: string;
      providerMessageId: string | null;
      platform: string | null;
      provider: string | null;
    }>;
  };
};

type CommandCenterSalesOsSectorProps = {
  salesPackBusinessMode: CommandCenterSalesPackBusinessController;
  nexusWorkbenchRaw: Record<string, unknown> | null;
};

export function CommandCenterSalesOsSector({
  salesPackBusinessMode,
  nexusWorkbenchRaw,
}: CommandCenterSalesOsSectorProps) {
  const [channelIo, setChannelIo] = useState<SalesPackChannelIoSnapshot | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const salesPack = salesPackBusinessMode.snapshot;
  const agentMesh = useMemo(() => readRecord(nexusWorkbenchRaw?.agentMesh), [nexusWorkbenchRaw]);
  const agentMeshOrchestration = readRecord(agentMesh?.orchestration);
  const agentMeshLedger = readRecord(agentMesh?.ledger);
  const bridges = readArray(agentMeshOrchestration?.bridges).slice(0, 5);
  const receipts = readArray(agentMeshLedger?.recentReceipts).slice(0, 5);
  const inbox = salesPack?.sourceSnapshots.inbox.slice(0, 6) || [];
  const crm = salesPack?.sourceSnapshots.crm.slice(0, 6) || [];
  const agents = readArray(salesPack?.sourceSnapshots.agents).slice(0, 6);
  const actions = salesPack?.actions.slice(0, 4) || [];
  const recentChannelEvents = channelIo?.sourceSnapshots.recentEvents.slice(0, 6) || [];

  const refreshChannelIo = async () => {
    const next = await fetchChannelIoSnapshot();
    setChannelIo(next);
  };

  const runLocalInbound = async () => {
    setBusyAction("channel-io-demo");
    setMessage(null);
    try {
      const response = await fetch("/api/v2/sales-pack/channel-io/inbound", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...buildCommandCenterRuntimeAuthHeaders(),
        },
        body: JSON.stringify({
          tenantId: "demo-org",
          platform: "whatsapp",
          provider: "local-stub",
          providerMessageId: `command-center-${Date.now()}`,
          customerId: "lead-command-center",
          text: "Achei caro, mas ainda tenho interesse. Ainda tem vaga?",
          traceId: `trace-command-center-${Date.now()}`,
          metadata: { source: "command-center-sales-os" },
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Inbound local nao foi aceito."));
      }
      await Promise.all([
        salesPackBusinessMode.refresh(),
        refreshChannelIo(),
      ]);
      setMessage("Inbound local processado; Inbox, CRM e Channel I/O atualizados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao processar inbound local.");
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    void refreshChannelIo().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Channel I/O indisponivel.");
    });
  }, []);

  return (
    <div className="grid gap-4">
      <section className="bcc-overview-hero" data-status={salesPack?.summary.posture || "attention"}>
        <div>
          <span className="bcc-card__label">Sales OS</span>
          <h2>{salesPack?.narrative.headline || "Sales OS pronto para demo"}</h2>
          <p>{salesPack?.narrative.operatorSummary || "Ative o modo Business ou rode um inbound local para popular Inbox, CRM e auditoria."}</p>
        </div>
        <div className="bcc-overview-hero__rail">
          <CommandCenterBadge tone={salesPack?.summary.posture === "healthy" ? "ok" : salesPack?.summary.posture === "critical" ? "danger" : "warn"}>
            {salesPack?.summary.posture || "attention"}
          </CommandCenterBadge>
          <CommandCenterBadge>{salesPack?.summary.mode || "demo"}</CommandCenterBadge>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <CommandCenterCard label="Inbox" title={`${salesPack?.summary.conversations || 0} conversa(s)`}>
          <div className="bcc-list">
            {inbox.length > 0 ? inbox.map((conversation) => (
              <div key={conversation.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{conversation.customerId} - {conversation.lastIntent}</span>
                <span className="bcc-list-item__meta">{conversation.status} - {conversation.summary}</span>
              </div>
            )) : <p className="bcc-empty-note">Nenhuma conversa processada ainda.</p>}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="CRM Inteligente" title={`${salesPack?.summary.leads || 0} lead(s)`}>
          <div className="bcc-list">
            {crm.length > 0 ? crm.map((lead) => (
              <div key={`${lead.customerId}:${lead.intent}`} className="bcc-list-item" data-active={lead.handoffRequired}>
                <span className="bcc-list-item__title">{lead.customerId} - {lead.stage}</span>
                <span className="bcc-list-item__meta">{lead.intent} - {lead.nextAction}</span>
              </div>
            )) : <p className="bcc-empty-note">Leads aparecem apos inbound ou demo.</p>}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Channel I/O" title={`${channelIo?.summary.processed || 0} processada(s)`}>
          <div className="bcc-list">
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">Idempotencia</span>
              <span className="bcc-list-item__meta">
                {channelIo?.summary.duplicates || 0} duplicada(s), {channelIo?.summary.knownMessageIds || 0} id(s) conhecidos.
              </span>
            </div>
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">Status</span>
              <span className="bcc-list-item__meta">
                {channelIo?.summary.statusOnly || 0} receipt(s), {channelIo?.summary.rejected || 0} rejeitada(s).
              </span>
            </div>
            <button type="button" className="bcc-list-item text-left" disabled={busyAction === "channel-io-demo"} onClick={runLocalInbound}>
              <span className="bcc-list-item__title">{busyAction === "channel-io-demo" ? "Processando..." : "Rodar inbound local"}</span>
              <span className="bcc-list-item__meta">Simula WhatsApp sem envio externo.</span>
            </button>
          </div>
        </CommandCenterCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CommandCenterCard label="Agent Builder" title={`${agents.length} perfil(is)`}>
          <div className="bcc-list">
            {agents.length > 0 ? agents.map((agent) => (
              <div key={asText(agent.id, asText(agent.role, "agent"))} className="bcc-list-item">
                <span className="bcc-list-item__title">{asText(agent.role, "agent")} - {asText(agent.label, "Perfil")}</span>
                <span className="bcc-list-item__meta">{asText(agent.objective, "Sem objetivo publicado.")}</span>
              </div>
            )) : <p className="bcc-empty-note">Perfis aparecem quando o snapshot do Sales Pack carregar.</p>}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Policy Simulator" title={`${salesPack?.summary.pendingApprovals || 0} approval(s)`}>
          <div className="bcc-list">
            {actions.length > 0 ? actions.map((action) => (
              <div key={action.id} className="bcc-list-item" data-active={action.severity === "critical"}>
                <span className="bcc-list-item__title">{action.label}</span>
                <span className="bcc-list-item__meta">{action.reason}</span>
              </div>
            )) : <p className="bcc-empty-note">Nenhuma acao de policy pendente.</p>}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Agent Mesh" title={`${bridges.length} bridge(s)`}>
          <div className="bcc-list">
            {bridges.length > 0 ? bridges.map((bridge) => (
              <div key={asText(bridge.id, "bridge")} className="bcc-list-item">
                <span className="bcc-list-item__title">{asText(bridge.agentName, "Cliente ACP")}</span>
                <span className="bcc-list-item__meta">
                  {asText(bridge.primaryProtocol, "protocolo")} - {asText(bridge.status, "status")} - {asText(readRecord(bridge.connection)?.redacted, "conexao redigida")}
                </span>
              </div>
            )) : <p className="bcc-empty-note">Nenhum bridge externo registrado neste snapshot.</p>}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Audit Trail" title={`${readNumber(agentMeshLedger?.totalExecutions) || 0} execucao(oes)`}>
          <div className="bcc-list">
            {receipts.length > 0 ? receipts.map((receipt) => (
              <div key={asText(receipt.id, "receipt")} className="bcc-list-item">
                <span className="bcc-list-item__title">{asText(receipt.status, "status")} - {asText(receipt.driverProtocol, "driver")}</span>
                <span className="bcc-list-item__meta">{asText(receipt.finalResponseSummary, "Sem resumo.")}</span>
              </div>
            )) : recentChannelEvents.length > 0 ? recentChannelEvents.map((event) => (
              <div key={event.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{event.kind} - {event.platform || "canal"}</span>
                <span className="bcc-list-item__meta">{event.summary}</span>
              </div>
            )) : <p className="bcc-empty-note">Eventos aparecem apos inbound, demo ou execucao de bridge.</p>}
          </div>
        </CommandCenterCard>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="bcc-action-button" disabled={salesPackBusinessMode.loading} onClick={() => void salesPackBusinessMode.refresh()}>
          Atualizar Sales OS
        </button>
        <button type="button" className="bcc-action-button" disabled={busyAction === "channel-io-refresh"} onClick={() => void refreshChannelIo()}>
          Atualizar Channel I/O
        </button>
        <button type="button" className="bcc-action-button" disabled={salesPackBusinessMode.busyActionId === "sales-pack-demo"} onClick={() => void salesPackBusinessMode.seedDemo()}>
          Criar exemplo local
        </button>
      </div>
      {(message || salesPackBusinessMode.message) ? (
        <p className="bcc-empty-note">{message || salesPackBusinessMode.message}</p>
      ) : null}
    </div>
  );
}

async function fetchChannelIoSnapshot(): Promise<SalesPackChannelIoSnapshot> {
  const response = await fetch("/api/v2/sales-pack/channel-io/snapshot", {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...buildCommandCenterRuntimeAuthHeaders(),
    },
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Channel I/O indisponivel."));
  }
  const data = readRecord(readRecord(payload)?.data);
  if (!data) {
    throw new Error("Snapshot do Channel I/O veio em formato invalido.");
  }
  return data as unknown as SalesPackChannelIoSnapshot;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const error = readRecord(payload)?.error;
  return typeof error === "string" && error.trim() ? error : fallback;
}

function readRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function readArray(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, any> => Boolean(readRecord(entry)))
    : [];
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asText(value: unknown, fallback = ""): string {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}
