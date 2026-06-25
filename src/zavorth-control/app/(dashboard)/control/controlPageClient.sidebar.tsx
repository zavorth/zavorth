"use client";

import { Button, Card } from "@/shared/components";
import type { ControlPageClientModel } from "./controlPageClient.types";
import { asArray, asText, formatTimestamp } from "./controlPageClient.utils";

type ControlPageClientSidebarProps = {
  model: ControlPageClientModel;
};

export function ControlPageClientSidebar({ model }: ControlPageClientSidebarProps) {
  const {
    draft,
    setDraft,
    sending,
    handleSend,
    sessionEntries,
    effectiveSessionId,
    handleSessionChange,
    memoryRecall,
    memoryRecallSources,
    approvals,
    resolvingApprovalId,
    handleApproval,
    recommendations,
  } = model;

  return (
    <div className="space-y-6">
      <Card title="Mission input" subtitle="Preview first, live submit only when explicitly requested" icon="chat">
        <textarea
          className="min-h-[140px] w-full rounded-lg border border-black/10 bg-bg px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary/40"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Describe the mission. Zavorth will ask for approval only when the runtime policy requires it."
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            icon="send"
            loading={sending}
            onClick={() => {
              void handleSend({ live: false });
            }}
          >
            Preview mission
          </Button>
          <Button
            variant="secondary"
            icon="play_arrow"
            loading={sending}
            onClick={() => {
              void handleSend({ live: true });
            }}
          >
            Submit live
          </Button>
          <Button
            variant="secondary"
            icon="edit_square"
            onClick={() => setDraft("/mode status")}
          >
            Insert /mode status
          </Button>
        </div>
      </Card>

      <Card title="Sessoes" subtitle="Troque sem reload completo" icon="history">
        <div className="space-y-2">
          {sessionEntries.length > 0 ? (
            sessionEntries.slice(0, 10).map((entry) => {
              const sessionId = asText(entry?.sessionId || entry?.id);
              const active = sessionId === effectiveSessionId;
              return (
                <button
                  key={sessionId}
                  type="button"
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-black/5 bg-bg hover:border-primary/20"
                  }`}
                  onClick={() => {
                    void handleSessionChange(sessionId);
                  }}
                >
                  <strong className="block text-sm text-text-main">
                    {asText(entry?.label || entry?.title || sessionId, sessionId)}
                  </strong>
                  <p className="mt-1 text-xs text-text-muted">
                    {asText(entry?.summary || entry?.workspaceHint || "Sessao sem resumo curto.")}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    Atualizada {formatTimestamp(entry?.updatedAt || entry?.createdAt)}
                  </p>
                </button>
              );
            })
          ) : (
            <p className="text-sm text-text-muted">Nenhuma sessao listada ainda.</p>
          )}
        </div>
      </Card>

      <Card title="Memoria hibrida" subtitle="Ledger factual + recall recuperado" icon="psychology">
        <div className="rounded-lg border border-black/5 bg-bg p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Modo de recall</p>
          <strong className="mt-2 block text-sm text-text-main">
            {asText(memoryRecall?.mode, "ledger_only")}
          </strong>
          <p className="mt-2 text-sm text-text-muted">
            {memoryRecall?.query
              ? `Consulta: ${asText(memoryRecall.query)}`
              : "Sem consulta recente suficiente; o ledger continua como fonte principal."}
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Embeddings: {asText(memoryRecall?.embeddingStatus, "not_configured")} - fontes:{" "}
            {asText(memoryRecall?.summary?.returned, "0")}
          </p>
        </div>
        <div className="mt-3 space-y-3">
          {memoryRecallSources.length > 0 ? (
            memoryRecallSources.slice(0, 5).map((source) => (
              <div
                key={asText(source?.id || source?.label, "memory-source")}
                className="rounded-lg border border-black/5 bg-bg p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-text-main">
                    {asText(source?.label || source?.id, "Fonte de memoria")}
                  </strong>
                  <span className="text-xs uppercase tracking-[0.12em] text-text-muted">
                    {asText(source?.type, "ledger")}/{asText(source?.kind, "memory")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  {asText(source?.summary, "Fonte sem resumo curto.")}
                </p>
                <p className="mt-2 text-xs text-text-muted">
                  Por que lembrei: {asText(source?.reason, "correspondencia com a sessao atual.")}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">
              Nenhuma fonte recuperada ainda. Quando houver uma tarefa, a UI mostra o que foi lembrado e o motivo.
            </p>
          )}
        </div>
        {asArray<string>(memoryRecall?.warnings).length > 0 ? (
          <p className="mt-3 text-xs text-text-muted">
            {asArray<string>(memoryRecall?.warnings).slice(0, 2).join(" | ")}
          </p>
        ) : null}
      </Card>

      <Card title="Approval Inbox" subtitle="Scoped decisions from Runtime API v1" icon="rule">
        <div className="space-y-3">
          {approvals.length > 0 ? (
            approvals.slice(0, 8).map((approval) => {
              const approvalId = asText(
                approval?.permission_id || approval?.permissionId || approval?.taskId || approval?.id,
              );
              const summary = asText(
                approval?.summary || approval?.rationale || approval?.reason || approval?.title,
                "Approval pending.",
              );
              const risk = asText(approval?.metadata?.risk || approval?.risk, "review");
              const policy = asText(approval?.metadata?.policy || approval?.policy || approval?.kind, "policy-managed");
              const files = asArray<string>(approval?.metadata?.files || approval?.files);
              const status = asText(approval?.status || approval?.state, "pending");
              return (
                <div key={approvalId} className="rounded-lg border border-black/5 bg-bg p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="block text-sm text-text-main">
                        {asText(approval?.title || approval?.executor || approvalId, approvalId)}
                      </strong>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-text-muted">
                        {status} · risk {risk}
                      </p>
                    </div>
                    <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                      scoped
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{summary}</p>
                  <div className="mt-3 rounded-md border border-black/5 bg-black/[0.02] p-3 text-xs text-text-muted">
                    <p>Policy: {policy}</p>
                    <p>Approval ID: {approvalId || "unknown"}</p>
                    <p>
                      Files: {files.length > 0 ? files.slice(0, 3).join(", ") : "none declared"}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      icon="check"
                      loading={resolvingApprovalId === approvalId}
                      onClick={() => {
                        void handleApproval(approvalId, "approve");
                      }}
                    >
                      Approve once
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="close"
                      loading={resolvingApprovalId === approvalId}
                      onClick={() => {
                        void handleApproval(approvalId, "reject");
                      }}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-text-muted">No pending approvals for this session.</p>
          )}
        </div>
      </Card>

      <Card title="Acoes recomendadas" subtitle="Leituras do gateway e do resource plane" icon="tips_and_updates">
        <div className="space-y-3">
          {recommendations.length > 0 ? (
            recommendations.slice(0, 8).map((entry, index) => (
              <div key={`${asText(entry.label, "acao")}-${index}`} className="rounded-lg border border-black/5 bg-bg p-4">
                <strong className="block text-sm text-text-main">{asText(entry.label, "Acao sugerida")}</strong>
                <p className="mt-2 text-sm text-text-muted">
                  {asText(entry.summary || entry.description, "Sem resumo curto.")}
                </p>
                {asText(entry.command) ? (
                  <p className="mt-2 text-xs text-text-muted">Comando: {asText(entry.command)}</p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">Nenhuma recomendacao adicional agora.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
