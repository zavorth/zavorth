"use client";

import type { ControlPageClientModel } from "../../controlPageClient.types";
import { CommandCenterButton } from "./CommandCenterPrimitives";

type CommandCenterExperienceHomeProps = {
  model: ControlPageClientModel;
  onDraftCommand: (command: string) => void;
  onNavigate: (sectorId: "terminal" | "overview" | "workspace" | "config") => void;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function asArray(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object") as Record<string, any>[] : [];
}

function asText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toneForStatus(status: string): "ok" | "warn" | "danger" | "info" {
  if (status === "ready" || status === "completed") return "ok";
  if (status === "blocked" || status === "failed") return "danger";
  if (status === "attention" || status === "waiting_approval") return "warn";
  return "info";
}

export function CommandCenterExperienceHome({
  model,
  onDraftCommand,
  onNavigate,
}: CommandCenterExperienceHomeProps) {
  const snapshot = model.experience;
  const agent = asRecord(snapshot?.agent);
  const journey = asRecord(snapshot?.journey);
  const trust = asRecord(snapshot?.trust);
  const health = asRecord(snapshot?.health);
  const learning = asRecord(snapshot?.learning);
  const memory = asRecord(snapshot?.memory);
  const timeline = asArray(snapshot?.timeline);
  const receipts = asArray(snapshot?.receipts);
  const approvals = asArray(snapshot?.approvals).filter((approval) => approval.status === "pending");
  const nextActions = asArray(snapshot?.nextActions);
  const agentStatus = asText(agent.status, model.runtimeStatus === "ready" ? "ready" : "attention");
  const learningPending = Number(learning.pending || 0);

  return (
    <section className="bcc-experience-home" aria-label="Zavorth Experience Core">
      <div className="bcc-experience-home__hero">
        <AgentPulse
          status={agentStatus}
          title={asText(journey.title, "Zavorth Natural-First")}
          summary={asText(agent.summary || health.summary, "Fale normalmente. O Zavorth planeja, executa, pede aprovacao e aprende com consentimento.")}
          modelLabel={asText(agent.modelLabel, model.productModeLabel)}
          providerLabel={asText(agent.providerLabel, "runtime atual")}
        />
        <NaturalCommandBar
          draft={model.draft}
          sending={model.sending}
          onDraftChange={model.setDraft}
          onSend={() => void model.handleSend({ live: true })}
        />
      </div>

      <div className="bcc-experience-home__grid">
        <ReasoningTimeline timeline={timeline} onNavigate={() => onNavigate("terminal")} />
        <TrustLens
          trust={trust}
          approvalCount={approvals.length}
          onReview={() => onNavigate("overview")}
        />
        <MemoryBloom
          memory={memory}
          learningPending={learningPending}
          onReviewLearning={() => onDraftCommand("Mostre aprendizados pendentes")}
        />
        <ActionReceiptStack
          receipts={receipts}
          actions={nextActions}
          onDraftCommand={onDraftCommand}
          onNavigate={onNavigate}
        />
      </div>
    </section>
  );
}

function AgentPulse({
  status,
  title,
  summary,
  modelLabel,
  providerLabel,
}: {
  status: string;
  title: string;
  summary: string;
  modelLabel: string;
  providerLabel: string;
}) {
  return (
    <div className="bcc-agent-pulse" data-status={toneForStatus(status)}>
      <div className="bcc-agent-pulse__signal" aria-hidden="true" />
      <div>
        <p className="bcc-agent-pulse__eyebrow">Experience Core</p>
        <h2>{title}</h2>
        <p>{summary}</p>
        <div className="bcc-agent-pulse__chips" aria-label="Estado do modelo">
          <span>{status}</span>
          <span>{modelLabel}</span>
          <span>{providerLabel}</span>
        </div>
      </div>
    </div>
  );
}

function NaturalCommandBar({
  draft,
  sending,
  onDraftChange,
  onSend,
}: {
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="bcc-natural-command-bar"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <label htmlFor="bcc-natural-command">Comando natural</label>
      <div className="bcc-natural-command-bar__row">
        <input
          id="bcc-natural-command"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Peca algo ao Zavorth"
        />
        <CommandCenterButton type="submit" variant="primary" disabled={sending || !draft.trim()}>
          {sending ? "Enviando" : "Enviar"}
        </CommandCenterButton>
      </div>
    </form>
  );
}

function ReasoningTimeline({
  timeline,
  onNavigate,
}: {
  timeline: Record<string, any>[];
  onNavigate: () => void;
}) {
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Reasoning Timeline</span>
        <button type="button" onClick={onNavigate}>Abrir chat</button>
      </header>
      <div className="bcc-experience-list">
        {timeline.length ? timeline.slice(-4).map((item) => (
          <div key={asText(item.id, asText(item.title))} className="bcc-experience-list__item" data-tone={toneForStatus(asText(item.status))}>
            <strong>{asText(item.title, "Evento")}</strong>
            <small>{asText(item.detail, asText(item.kind, "runtime"))}</small>
          </div>
        )) : (
          <p>Sem timeline ativa. Envie um pedido para iniciar uma jornada viva.</p>
        )}
      </div>
    </article>
  );
}

function TrustLens({
  trust,
  approvalCount,
  onReview,
}: {
  trust: Record<string, any>;
  approvalCount: number;
  onReview: () => void;
}) {
  const sandbox = asRecord(trust.sandbox);
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Trust Lens</span>
        <button type="button" onClick={onReview}>{approvalCount} approval</button>
      </header>
      <div className="bcc-trust-lens" data-risk={asText(trust.risk, "safe")}>
        <strong>{asText(trust.title, "Trust Lens ativo")}</strong>
        <p>{asText(trust.summary, "Acoes sensiveis passam por policy, preview e receipt.")}</p>
        <small>{asText(sandbox.detail, "Sandbox governado pronto quando necessario.")}</small>
      </div>
    </article>
  );
}

function MemoryBloom({
  memory,
  learningPending,
  onReviewLearning,
}: {
  memory: Record<string, any>;
  learningPending: number;
  onReviewLearning: () => void;
}) {
  const signals = asArray(memory.signals);
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Memory Bloom</span>
        <button type="button" onClick={onReviewLearning}>{learningPending} learning</button>
      </header>
      <div className="bcc-memory-bloom">
        <strong>{asText(memory.summary, "Memoria pronta para contexto validado.")}</strong>
        {signals.length ? signals.slice(0, 3).map((signal) => (
          <small key={asText(signal.id, asText(signal.title))}>{asText(signal.title)} - {asText(signal.summary)}</small>
        )) : (
          <small>O Zavorth vai propor memorias e preferencias somente quando tiver evidencia util.</small>
        )}
      </div>
    </article>
  );
}

function ActionReceiptStack({
  receipts,
  actions,
  onDraftCommand,
  onNavigate,
}: {
  receipts: Record<string, any>[];
  actions: Record<string, any>[];
  onDraftCommand: (command: string) => void;
  onNavigate: (sectorId: "terminal" | "overview" | "workspace" | "config") => void;
}) {
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Receipts e acoes</span>
        <button type="button" onClick={() => onNavigate("overview")}>Ver tudo</button>
      </header>
      <div className="bcc-experience-list">
        {receipts.length ? receipts.slice(0, 3).map((receipt) => (
          <div key={asText(receipt.id, asText(receipt.title))} className="bcc-experience-list__item" data-tone={toneForStatus(asText(receipt.status))}>
            <strong>{asText(receipt.title, "Receipt")}</strong>
            <small>{asText(receipt.detail, asText(receipt.source, "runtime"))}</small>
          </div>
        )) : (
          <p>Nenhum receipt ainda. O proximo run gera evidencias aqui.</p>
        )}
        <div className="bcc-experience-actions">
          {actions.slice(0, 3).map((item) => (
            <button
              key={asText(item.id, asText(item.label))}
              type="button"
              onClick={() => onDraftCommand(asText(item.command, asText(item.label)))}
            >
              {asText(item.label, "Acao")}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}
