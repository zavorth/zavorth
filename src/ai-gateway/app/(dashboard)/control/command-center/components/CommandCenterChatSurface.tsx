"use client";

import type { FormEvent } from "react";
import type { DashboardCommandCenterViewModel } from "../contracts";
import {
  CommandCenterButton,
  CommandCenterLogicCell,
} from "./CommandCenterPrimitives";
import {
  formatCommandCenterBudgetLabel,
  formatCommandCenterModelRouteLabel,
} from "./CommandCenterObservability";

type CommandCenterChatSurfaceProps = {
  viewModel: DashboardCommandCenterViewModel;
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onResolveApproval?: (approvalId: string, decision: "approve" | "reject") => void | Promise<void>;
  resolvingApprovalId?: string | null;
};

export function CommandCenterChatSurface({
  viewModel,
  draft,
  sending,
  onDraftChange,
  onSend,
  onResolveApproval,
  resolvingApprovalId,
}: CommandCenterChatSurfaceProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSend();
  };
  const pendingApprovals = viewModel.approvals.filter((approval) => approval.status === "pending");
  const latestReceipts = viewModel.runObservatory.receipts?.slice(0, 3) ?? [];

  return (
    <>
      <header className="bcc-inbox-header">
        <div>
          <span className="bcc-inbox-header__eyebrow">Inbox</span>
          <h1>Conversa principal</h1>
          <p>Fale normalmente. O Zavorth responde, prepara previews e para quando precisar da sua decisao.</p>
        </div>
        <div className="bcc-inbox-header__status" aria-label="Estado atual do runtime">
          <span data-tone={viewModel.runtime.status}>{humanRuntimeStatusLabel(viewModel.runtime.status)}</span>
          <span>{viewModel.modelProfile.modelLabel}</span>
          <span>{viewModel.replyPorts.find((port) => port.primary)?.label ?? "Web"}</span>
        </div>
      </header>

      <div className="bcc-chat-feed">
        {viewModel.messages.length === 0 && shouldShowRunState(viewModel) ? (
          <CommandCenterActiveRunState viewModel={viewModel} />
        ) : viewModel.messages.length === 0 ? (
          <CommandCenterInboxWelcome
            viewModel={viewModel}
            onDraftChange={onDraftChange}
          />
        ) : (
          viewModel.messages.map((message) => (
            <article key={message.id} className="bcc-message" data-role={message.role}>
              <div className="bcc-message__avatar" aria-hidden="true">
                {formatRoleGlyph(message.role)}
              </div>
              <div className="bcc-message__content">
                <div className="bcc-message__meta">
                  <span>{formatRoleLabel(message.role)}</span>
                  <span>{message.createdAt}</span>
                  {message.modelLabel ? <span>{message.modelLabel}</span> : null}
                </div>
                <div className="bcc-message__body whitespace-pre-wrap">{message.text}</div>
                {message.trace?.length ? (
                  <details className="bcc-message-details">
                    <summary>
                      <span>Como o Zavorth chegou nisso</span>
                      <small>{message.trace.length} passo(s)</small>
                    </summary>
                    <CommandCenterTraceBlock
                      label="Trace desta mensagem"
                      events={message.trace}
                    />
                  </details>
                ) : null}
                {message.events?.length ? (
                  <div className="bcc-message__events" aria-label="Resumo de eventos da mensagem">
                    {message.events.map((event) => (
                      <CommandCenterLogicCell
                        key={event.id}
                        title={event.title}
                        detail={event.detail}
                        status={event.status}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}

        {pendingApprovals.length > 0 ? (
          <CommandCenterInlineApprovalStack
            approvals={pendingApprovals}
            resolvingApprovalId={resolvingApprovalId}
            onResolveApproval={onResolveApproval}
          />
        ) : null}

        {sending ? (
          <CommandCenterThinkingCard />
        ) : null}

        {viewModel.trace?.events.length ? (
          <details className="bcc-message-details bcc-session-trace">
            <summary>
              <span>Atividade segura da sessao</span>
              <small>{viewModel.trace.summary.eventCount} evento(s)</small>
            </summary>
            <CommandCenterTraceBlock
              label="Agent trace"
              events={viewModel.trace.events.slice(0, 10)}
              summary={`${viewModel.trace.summary.toolCount} tool(s) - ${viewModel.trace.summary.approvalCount} approval(s)`}
            />
          </details>
        ) : null}

        {latestReceipts.length > 0 ? (
          <section className="bcc-receipt-strip" aria-label="Receipts recentes">
            <span className="bcc-receipt-strip__label">Receipts recentes</span>
            {latestReceipts.map((receipt) => (
              <div key={receipt.id} className="bcc-receipt-strip__item">
                <span>{receipt.title}</span>
                <small>{receipt.status} - {receipt.source}</small>
              </div>
            ))}
          </section>
        ) : null}

        {viewModel.events.length > 0 ? (
          <section className="bcc-event-stream" aria-label="Eventos do runtime">
            <span className="bcc-event-stream__label">Atividade agora</span>
            {viewModel.events.slice(0, 8).map((event) => (
              <CommandCenterLogicCell
                key={event.id}
                title={event.title}
                detail={event.detail}
                status={event.status}
              />
            ))}
          </section>
        ) : null}

        <CommandCenterChatContextStrip viewModel={viewModel} />
      </div>

      <form className="bcc-compose" onSubmit={handleSubmit}>
        <div className="bcc-compose__input-frame">
          <div className="bcc-compose__toolbar" aria-label="Acoes rapidas">
            {["Revisar workspace", "Ver pendencias", "Resumir documento"].map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onDraftChange(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Pergunte ou peca algo ao Zavorth"
            aria-label="Mensagem para o Zavorth"
          />
          <div className="bcc-compose__footer">
            <span className="bcc-empty-note">
              {sending ? "Enviando..." : `${draft.trim().length} caracteres - linguagem natural entra no gateway.`}
            </span>
            <CommandCenterButton
              type="submit"
              variant="primary"
              className="bcc-compose__send"
              disabled={sending || !draft.trim()}
            >
              <span aria-hidden="true">send</span>
              Enviar
            </CommandCenterButton>
          </div>
        </div>
      </form>
    </>
  );
}

function CommandCenterInboxWelcome({
  viewModel,
  onDraftChange,
}: {
  viewModel: DashboardCommandCenterViewModel;
  onDraftChange: (value: string) => void;
}) {
  return (
    <section className="bcc-inbox-welcome">
      <div className="bcc-inbox-welcome__copy">
        <span>Pronto para conversar</span>
        <h2>{viewModel.emptyState.title}</h2>
        <p>{viewModel.emptyState.subtitle}</p>
      </div>
      <div className="bcc-suggestion-chips">
        {viewModel.emptyState.suggestions.map((suggestion) => (
          <CommandCenterButton
            key={suggestion}
            type="button"
            className="bcc-suggestion-chip"
            onClick={() => onDraftChange(suggestion)}
          >
            <span aria-hidden="true">{suggestionGlyph(suggestion)}</span>
            {suggestion}
          </CommandCenterButton>
        ))}
      </div>
    </section>
  );
}

function CommandCenterInlineApprovalStack({
  approvals,
  resolvingApprovalId,
  onResolveApproval,
}: {
  approvals: DashboardCommandCenterViewModel["approvals"];
  resolvingApprovalId?: string | null;
  onResolveApproval?: (approvalId: string, decision: "approve" | "reject") => void | Promise<void>;
}) {
  return (
    <section className="bcc-inline-approvals" aria-label="Aprovacoes pendentes">
      <div className="bcc-inline-approvals__header">
        <span>Precisa da sua decisao</span>
        <small>{approvals.length} pendente(s)</small>
      </div>
      {approvals.slice(0, 3).map((approval) => {
        const busy = resolvingApprovalId === approval.id;
        return (
          <article key={approval.id} className="bcc-inline-approval" data-risk={approval.risk}>
            <div>
              <strong>{approval.title}</strong>
              <p>{approval.reason}</p>
              <div className="bcc-inline-approval__meta">
                <span>{approval.id}</span>
                {approval.scope ? <span>{approval.scope}</span> : null}
                <span>{approval.createdAt}</span>
              </div>
            </div>
            <div className="bcc-inline-approval__actions">
              <CommandCenterButton
                type="button"
                variant="primary"
                disabled={!onResolveApproval || busy}
                onClick={() => {
                  void onResolveApproval?.(approval.id, "approve");
                }}
              >
                {busy ? "Aplicando..." : "Aprovar"}
              </CommandCenterButton>
              <CommandCenterButton
                type="button"
                disabled={!onResolveApproval || busy}
                onClick={() => {
                  void onResolveApproval?.(approval.id, "reject");
                }}
              >
                Rejeitar
              </CommandCenterButton>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function CommandCenterThinkingCard() {
  return (
    <section className="bcc-thinking-card" aria-live="polite">
      <span className="bcc-thinking-card__pulse" aria-hidden="true" />
      <div>
        <strong>Zavorth esta pensando</strong>
        <p>Classificando o pedido, escolhendo a rota e mantendo a seguranca em segundo plano.</p>
      </div>
      <div className="bcc-thinking-card__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function shouldShowRunState(viewModel: DashboardCommandCenterViewModel): boolean {
  return Boolean(
    viewModel.agentRun
      || viewModel.approvals.length > 0
      || viewModel.artifacts.length > 0
      || viewModel.events.length > 0,
  );
}

function CommandCenterActiveRunState({
  viewModel,
}: {
  viewModel: DashboardCommandCenterViewModel;
}) {
  const run = viewModel.agentRun;
  const traceEvents = (run?.trace?.events.length ? run.trace.events : viewModel.trace?.events || []).slice(0, 6);
  const events = (run?.events.length ? run.events : viewModel.events).slice(0, 5);

  return (
    <section className="bcc-active-run-state" data-status={run?.status ?? "idle"}>
      <div>
        <span className="bcc-card__label">
          {viewModel.approvals.length > 0 ? "Approval aguardando voce" : "Run atual"}
        </span>
        <h2>{run?.title ?? "Atividade do Command Center"}</h2>
        <p>{run?.summary ?? viewModel.runtime.summary}</p>
      </div>
      <div className="bcc-active-run-state__badges">
        <span>{run ? formatAgentStatus(run.status) : viewModel.runtime.status}</span>
        <span>{viewModel.modelProfile.modelLabel}</span>
        <span>rota {formatCommandCenterModelRouteLabel(viewModel.modelProfile)}</span>
        <span>budget {formatCommandCenterBudgetLabel(viewModel.budget)}</span>
        {viewModel.approvals.length > 0 ? <span>{viewModel.approvals.length} approval</span> : null}
        {viewModel.artifacts.length > 0 ? <span>{viewModel.artifacts.length} artifact</span> : null}
      </div>
      {traceEvents.length > 0 ? (
        <CommandCenterTraceBlock
          label="Trace seguro"
          events={traceEvents}
          summary={run?.trace?.summary.hasPendingApproval ? "Approval pendente no runtime." : "Passos explicaveis do agente."}
        />
      ) : events.length > 0 ? (
        <div className="bcc-run-mini-timeline">
          {events.map((event) => (
            <div key={event.id} className="bcc-run-mini-timeline__item" data-status={event.status ?? "done"}>
              <span>{event.title}</span>
              <small>{event.detail ?? event.kind}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CommandCenterTraceBlock({
  label,
  events,
  summary,
}: {
  label: string;
  events: NonNullable<DashboardCommandCenterViewModel["trace"]>["events"];
  summary?: string;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="bcc-agent-trace" aria-label={label}>
      <div className="bcc-agent-trace__header">
        <span>{label}</span>
        {summary ? <small>{summary}</small> : null}
      </div>
      <div className="bcc-agent-trace__steps">
        {events.map((event) => (
          <div
            key={event.id}
            className="bcc-agent-trace__step"
            data-kind={event.kind}
            data-status={event.status}
          >
            <span className="bcc-agent-trace__dot" aria-hidden="true" />
            <div className="bcc-agent-trace__copy">
              <div className="bcc-agent-trace__title">
                <span>{event.title}</span>
                {event.chipLabel ? <code>{event.chipLabel}</code> : null}
              </div>
              <p>{event.summary}</p>
              {event.target ? <small>{event.target}</small> : null}
              {event.capability ? (
                <div className="bcc-agent-capability" data-kind={event.capability.kind} data-risk={event.capability.risk}>
                  <div className="bcc-agent-capability__pills" aria-label={`Capability ${event.capability.label}`}>
                    <span className="bcc-agent-capability__pill" data-tone="kind">{event.capability.kind}</span>
                    <span className="bcc-agent-capability__pill" data-tone={event.capability.risk}>{event.capability.risk}</span>
                    <span className="bcc-agent-capability__pill" data-tone={event.capability.requiresApproval ? "approval" : "direct"}>
                      {event.capability.requiresApproval ? "approval" : "direct"}
                    </span>
                    <span className="bcc-agent-capability__pill" data-tone={event.capability.previewRequired ? "preview" : "no-preview"}>
                      {event.capability.previewRequired ? "preview" : "no preview"}
                    </span>
                    <span className="bcc-agent-capability__pill" data-tone="effect">{event.capability.sideEffect}</span>
                  </div>
                  <p className="bcc-agent-capability__reason">{event.capability.reason}</p>
                  <small className="bcc-agent-capability__scope">scope: {event.capability.scope}</small>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <p className="bcc-agent-trace__policy">
        Summaries only. Raw chain-of-thought stays private.
      </p>
    </section>
  );
}

function formatRoleGlyph(role: DashboardCommandCenterViewModel["messages"][number]["role"]): string {
  if (role === "user") {
    return "U";
  }
  if (role === "assistant") {
    return "B";
  }
  if (role === "tool") {
    return "T";
  }
  return "S";
}

function formatAgentStatus(status: NonNullable<DashboardCommandCenterViewModel["agentRun"]>["status"]): string {
  if (status === "waiting_approval") {
    return "aguardando approval";
  }
  if (status === "completed") {
    return "concluido";
  }
  if (status === "thinking") {
    return "pensando";
  }
  if (status === "running") {
    return "rodando";
  }
  if (status === "queued") {
    return "na fila";
  }
  if (status === "failed") {
    return "falhou";
  }
  if (status === "cancelled") {
    return "cancelado";
  }
  return "idle";
}

function suggestionGlyph(suggestion: string): string {
  const normalized = suggestion.toLowerCase();
  if (normalized.includes("status")) {
    return "sys";
  }
  if (normalized.includes("repositorio") || normalized.includes("analisar")) {
    return "repo";
  }
  if (normalized.includes("sessao") || normalized.includes("retomar")) {
    return "run";
  }
  if (normalized.includes("artifact")) {
    return "out";
  }
  return "ask";
}

function formatRoleLabel(role: DashboardCommandCenterViewModel["messages"][number]["role"]): string {
  if (role === "user") {
    return "Voce";
  }
  if (role === "assistant") {
    return "Zavorth";
  }
  if (role === "tool") {
    return "Ferramenta";
  }
  return "Sistema";
}

function humanRuntimeStatusLabel(status: DashboardCommandCenterViewModel["runtime"]["status"]): string {
  if (status === "ready") {
    return "Pronto";
  }
  if (status === "degraded") {
    return "Atencao";
  }
  if (status === "blocked") {
    return "Bloqueado";
  }
  return "Offline";
}

function CommandCenterChatContextStrip({
  viewModel,
}: {
  viewModel: DashboardCommandCenterViewModel;
}) {
  const hasContext = viewModel.artifacts.length > 0 || viewModel.memorySignals.length > 0;

  if (!hasContext) {
    return null;
  }

  return (
    <aside className="bcc-chat-context" aria-label="Contexto conectado ao chat">
      {viewModel.artifacts.length > 0 ? (
        <div className="bcc-chat-context__group">
          <span className="bcc-chat-context__label">Artifacts</span>
          {viewModel.artifacts.slice(0, 3).map((artifact) => (
            <span key={artifact.id} className="bcc-chat-context__chip">
              {artifact.title} - {artifact.status}
            </span>
          ))}
        </div>
      ) : null}
      {viewModel.memorySignals.length > 0 ? (
        <div className="bcc-chat-context__group">
          <span className="bcc-chat-context__label">Memoria</span>
          {viewModel.memorySignals.slice(0, 3).map((signal) => (
            <span key={signal.id} className="bcc-chat-context__chip">
              {signal.title} - {signal.layer}
            </span>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
