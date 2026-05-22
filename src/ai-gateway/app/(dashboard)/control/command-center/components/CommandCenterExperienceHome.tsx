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

function asTextArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : [];
}

function asText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toneForStatus(status: string): "ok" | "warn" | "danger" | "info" {
  if (status === "ready" || status === "completed" || status === "passed" || status === "success" || status === "safe") return "ok";
  if (status === "blocked" || status === "failed" || status === "danger" || status === "critical") return "danger";
  if (status === "attention" || status === "waiting_approval" || status === "pending" || status === "running" || status === "warn") return "warn";
  return "info";
}

function compactCommand(value: unknown): string {
  const command = asText(value);
  return command.length > 54 ? `${command.slice(0, 51)}...` : command;
}

function commandForDiffDecision(reviewId: string, decision: string, targetId?: string): string {
  return targetId
    ? `zavorth diff ${decision} ${reviewId} ${targetId}`
    : `zavorth diff ${decision} ${reviewId}`;
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
  const daily = asRecord(snapshot?.daily);
  const dailyBrief = asRecord(daily.brief);
  const responseProfile = asRecord(snapshot?.responseProfile || daily.responseProfile || dailyBrief.profile);
  const autoHealing = asRecord(snapshot?.autoHealing);
  const contextRecovery = asRecord(snapshot?.contextRecovery);
  const reasoningSummary = asRecord(snapshot?.reasoningSummary);
  const executionGraph = asRecord(snapshot?.executionGraph);
  const timeline = asArray(snapshot?.timeline);
  const receipts = asArray(snapshot?.receipts);
  const approvals = asArray(snapshot?.approvals).filter((approval) => approval.status === "pending");
  const actionCards = asArray(snapshot?.actionCards);
  const diffReviews = asArray(snapshot?.diffReviews);
  const graphNodes = asArray(executionGraph.nodes);
  const nextActions = asArray(snapshot?.nextActions);
  const agentStatus = asText(agent.status, model.runtimeStatus === "ready" ? "ready" : "attention");
  const learningPending = Number(learning.pending || 0);

  return (
    <section className="bcc-experience-home" aria-label="Zavorth Experience Core">
      <div className="bcc-experience-home__hero">
        <AgentPulse
          status={agentStatus}
          title={asText(journey.title, "Zavorth Natural-First")}
          summary={asText(daily.summary || agent.summary || health.summary, "Fale normalmente. O Zavorth planeja, executa, pede aprovacao e aprende com consentimento.")}
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
        <ReasoningSummaryTimeline
          timeline={timeline}
          reasoningSummary={reasoningSummary}
          onNavigate={() => onNavigate("terminal")}
        />
        <DailyBriefPanel brief={dailyBrief} fallbackSummary={asText(daily.summary || health.summary)} onDraftCommand={onDraftCommand} />
        <ResponseProfilePanel profile={responseProfile} onDraftCommand={onDraftCommand} />
        <ActionCardsPanel
          cards={actionCards}
          onDraftCommand={onDraftCommand}
          onActionCardDecision={model.handleExperienceActionCard}
        />
        <TrustLens
          trust={trust}
          approvalCount={approvals.length}
          onReview={() => onNavigate("overview")}
        />
        <LiveActionGraph nodes={graphNodes} />
        <InteractiveDiffReview
          reviews={diffReviews}
          onDraftCommand={onDraftCommand}
          onDiffDecision={model.handleExperienceDiffDecision}
        />
        <AutoHealingProgress autoHealing={autoHealing} />
        <ContextRecoveryPanel recovery={contextRecovery} onDraftCommand={onDraftCommand} />
        <MemoryBloom
          memory={memory}
          learningPending={learningPending}
          onReviewLearning={() => onDraftCommand("Mostre aprendizados pendentes")}
        />
        <LearningReviewPanel learning={learning} onDraftCommand={onDraftCommand} />
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

function DailyBriefPanel({
  brief,
  fallbackSummary,
  onDraftCommand,
}: {
  brief: Record<string, any>;
  fallbackSummary: string;
  onDraftCommand: (command: string) => void;
}) {
  const bestNextAction = asRecord(brief.bestNextAction);
  const pending = asRecord(brief.pending);
  const highlights = asTextArray(brief.highlights);
  const risks = asTextArray(brief.risks);
  return (
    <article className="bcc-experience-card bcc-daily-brief">
      <header>
        <span>Daily Brief</span>
        <button
          type="button"
          onClick={() => onDraftCommand(asText(bestNextAction.command, asText(bestNextAction.label, "o que devo fazer agora?")))}
        >
          Proximo
        </button>
      </header>
      <div className="bcc-experience-list">
        <div className="bcc-experience-list__item" data-tone={risks.length ? "warn" : "ok"}>
          <strong>{asText(brief.headline, fallbackSummary || "Zavorth pronto para o proximo pedido.")}</strong>
          <small>{asText(brief.summary, fallbackSummary)}</small>
          <small>Approvals {Number(pending.approvals || 0)} | Learning {Number(pending.learning || 0)} | Receipts {Number(pending.receipts || 0)}</small>
        </div>
        {highlights.slice(0, 3).map((item) => (
          <small key={item} className="bcc-daily-brief__line">+ {item}</small>
        ))}
        {risks.slice(0, 3).map((item) => (
          <small key={item} className="bcc-daily-brief__line bcc-daily-brief__line--risk">! {item}</small>
        ))}
      </div>
    </article>
  );
}

function ResponseProfilePanel({
  profile,
  onDraftCommand,
}: {
  profile: Record<string, any>;
  onDraftCommand: (command: string) => void;
}) {
  const structure = asTextArray(profile.structure);
  const active = asText(profile.id, "dev");
  const profiles = [
    { id: "short", label: "Curto" },
    { id: "dev", label: "Dev" },
    { id: "executive", label: "Executivo" },
    { id: "mentor", label: "Mentor" },
  ];
  return (
    <article className="bcc-experience-card bcc-response-profile">
      <header>
        <span>Estilo de resposta</span>
        <button type="button" disabled>{asText(profile.label, "Dev")}</button>
      </header>
      <div className="bcc-trust-lens" data-risk="safe">
        <strong>{asText(profile.summary, "Respostas tecnicas com plano, evidencias e validacao.")}</strong>
        <small>{structure.length ? structure.join(" -> ") : "plano -> mudancas -> validacao"}</small>
        <div className="bcc-action-card-actions" aria-label="Selecionar perfil de resposta">
          {profiles.map((item) => (
            <button
              key={item.id}
              type="button"
              data-active={active === item.id ? "true" : "false"}
              onClick={() => onDraftCommand(`use estilo ${item.id}`)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </article>
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

function ReasoningSummaryTimeline({
  timeline,
  reasoningSummary,
  onNavigate,
}: {
  timeline: Record<string, any>[];
  reasoningSummary: Record<string, any>;
  onNavigate: () => void;
}) {
  return (
    <article className="bcc-experience-card bcc-experience-card--wide">
      <header>
        <span>Reasoning Summary</span>
        <button type="button" onClick={onNavigate}>Abrir chat</button>
      </header>
      <div className="bcc-experience-list">
        <div className="bcc-experience-list__item" data-tone={toneForStatus(asText(reasoningSummary.risk, "safe"))}>
          <strong>{asText(reasoningSummary.understood, "Aguardando pedido natural")}</strong>
          <small>{asText(reasoningSummary.nextAction, "Envie um comando ou revise o Trust Lens.")}</small>
        </div>
        <details className="bcc-reasoning-details">
          <summary>Mostrar raciocinio seguro</summary>
          <dl>
            <div>
              <dt>Risco</dt>
              <dd>{asText(reasoningSummary.risk, "safe")}</dd>
            </div>
            <div>
              <dt>Ferramentas</dt>
              <dd>{asTextArray(reasoningSummary.tools).length ? asTextArray(reasoningSummary.tools).join(", ") : asText(reasoningSummary.tools, "nenhuma anunciada")}</dd>
            </div>
            <div>
              <dt>Aprovacao</dt>
              <dd>{asText(reasoningSummary.approvalReason, "nao necessaria agora")}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>{asText(reasoningSummary.result, "ainda em progresso")}</dd>
            </div>
          </dl>
        </details>
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

function ActionCardsPanel({
  cards,
  onDraftCommand,
  onActionCardDecision,
}: {
  cards: Record<string, any>[];
  onDraftCommand: (command: string) => void;
  onActionCardDecision: ControlPageClientModel["handleExperienceActionCard"];
}) {
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Action Cards</span>
        <button type="button" onClick={() => onDraftCommand("o que esta bloqueado?")}>Bloqueios</button>
      </header>
      <div className="bcc-experience-list">
        {cards.length ? cards.slice(0, 4).map((card) => {
          const actions = asArray(card.actions);
          return (
            <div key={asText(card.id, asText(card.title))} className="bcc-experience-list__item" data-tone={toneForStatus(asText(card.status))}>
              <strong>{asText(card.title, "Acao pendente")}</strong>
              <small>{asText(card.summary, "Revise risco e escopo antes de decidir.")}</small>
              <small>{asText(card.risk, "safe")} | {asText(card.scope, "workspace")} | {asText(card.sandbox, "governed-local")}</small>
              <div className="bcc-action-card-actions">
                {actions.slice(0, 4).map((action) => asText(action.command) ? (
                  <button
                    key={asText(action.id, asText(action.label))}
                    type="button"
                    onClick={() => void onActionCardDecision(asText(card.id), asText(action.id))}
                    title={compactCommand(action.command)}
                  >
                    {asText(action.label, "Executar")}
                  </button>
                ) : null)}
              </div>
            </div>
          );
        }) : (
          <p>Nenhuma acao pendente. Quando algo importar, o card aparece aqui e nos outros canais.</p>
        )}
      </div>
    </article>
  );
}

function LiveActionGraph({ nodes }: { nodes: Record<string, any>[] }) {
  const visibleNodes = nodes.length ? nodes.slice(0, 8) : [
    { id: "prompt", label: "Prompt", kind: "entrada", status: "ready", detail: "Aguardando comando natural" },
    { id: "router", label: "Router", kind: "planejamento", status: "pending", detail: "Classifica intencao e risco" },
    { id: "sandbox", label: "Sandbox", kind: "governanca", status: "pending", detail: "Valida antes do host" },
    { id: "receipt", label: "Receipt", kind: "evidencia", status: "pending", detail: "Registra decisao" },
  ];
  return (
    <article className="bcc-experience-card bcc-experience-card--wide">
      <header>
        <span>Live Action Graph</span>
        <button type="button" disabled>{visibleNodes.length} nos</button>
      </header>
      <div className="bcc-live-action-graph" aria-label="Fluxo de execucao do agente">
        {visibleNodes.map((node, index) => (
          <div key={asText(node.id, asText(node.label))} className="bcc-live-action-graph__node" data-tone={toneForStatus(asText(node.status))}>
            <span className="bcc-live-action-graph__index">{index + 1}</span>
            <strong>{asText(node.label, "No")}</strong>
            <small>{asText(node.kind, "runtime")}</small>
            <p>{asText(node.detail, "sem detalhe")}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function InteractiveDiffReview({
  reviews,
  onDraftCommand,
  onDiffDecision,
}: {
  reviews: Record<string, any>[];
  onDraftCommand: (command: string) => void;
  onDiffDecision: ControlPageClientModel["handleExperienceDiffDecision"];
}) {
  return (
    <article className="bcc-experience-card bcc-experience-card--wide">
      <header>
        <span>Interactive Diff Review</span>
        <button type="button" onClick={() => onDraftCommand("zavorth diff")}>Abrir diff</button>
      </header>
      <div className="bcc-experience-list">
        {reviews.length ? reviews.slice(0, 3).map((review) => {
          const files = asArray(review.files);
          return (
            <div key={asText(review.id, asText(review.title))} className="bcc-experience-list__item" data-tone={toneForStatus(asText(review.status))}>
              <strong>{asText(review.title, "Diff governado")}</strong>
              <small>{asText(review.summary, "Alteracoes em sandbox aguardam revisao.")}</small>
              {asRecord(review.recomposition).summary ? (
                <small>{asText(asRecord(review.recomposition).summary)}</small>
              ) : null}
              {files.slice(0, 3).map((file) => (
                <div key={asText(file.id, asText(file.path))} className="bcc-diff-file">
                  <div className="bcc-diff-file__head">
                    <span>{asText(file.path, "arquivo")}</span>
                    <small>+{Number(file.addedLines || 0)}/-{Number(file.removedLines || 0)}</small>
                  </div>
                  {asArray(file.hunks).slice(0, 3).map((hunk) => (
                    <div key={asText(hunk.id, asText(hunk.header))} className="bcc-diff-hunk" data-risk={toneForStatus(asText(hunk.risk, "safe"))}>
                      <strong>{asText(hunk.header, "hunk")}</strong>
                      <pre>{asArray(hunk.preview).map((line) => asText(line)).slice(0, 6).join("\n")}</pre>
                      <div className="bcc-diff-hunk__actions">
                        <button
                          type="button"
                          onClick={() => void onDiffDecision(asText(review.id), asText(hunk.id), "approve-hunk")}
                          title={commandForDiffDecision(asText(review.id), "approve-hunk", asText(hunk.id))}
                        >
                          Aprovar hunk
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDiffDecision(asText(review.id), asText(hunk.id), "reject-hunk")}
                          title={commandForDiffDecision(asText(review.id), "reject-hunk", asText(hunk.id))}
                        >
                          Rejeitar hunk
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="bcc-action-card-actions">
                <button
                  type="button"
                  onClick={() => void onDiffDecision(asText(review.id), asText(review.id), "approve-plan")}
                  title={commandForDiffDecision(asText(review.id), "approve")}
                >
                  Aprovar plano
                </button>
                <button
                  type="button"
                  onClick={() => onDraftCommand(commandForDiffDecision(asText(review.id), "retry"))}
                  title={commandForDiffDecision(asText(review.id), "retry")}
                >
                  Nova tentativa
                </button>
              </div>
            </div>
          );
        }) : (
          <p>Nenhum diff revisavel. Mutacoes futuras aparecem por arquivo e hunk.</p>
        )}
      </div>
    </article>
  );
}

function AutoHealingProgress({ autoHealing }: { autoHealing: Record<string, any> }) {
  const status = asText(autoHealing.status, "idle");
  const budget = asRecord(autoHealing.budget);
  const elapsed = Math.round(Number(budget.elapsedMs || 0) / 1000);
  const maxElapsed = Math.round(Number(budget.maxElapsedMs || 120000) / 1000);
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Auto-Healing</span>
        <button type="button" disabled>{status}</button>
      </header>
      <div className="bcc-trust-lens" data-risk={status === "failed" || status === "blocked" ? "attention" : "safe"}>
        <strong>Tentativa {Number(autoHealing.attempt || 0)}/{Number(autoHealing.maxAttempts || 3)}</strong>
        <p>{asText(autoHealing.lastErrorSummary || autoHealing.proposedCorrection, "Sem autocorrecao especulativa ativa.")}</p>
        <small>{asText(autoHealing.validationCommand, "Validacao ainda nao detectada.")}</small>
        <small>Budget: {elapsed}s/{maxElapsed}s | tokens {asText(budget.tokensUsed, "n/a")}/{asText(budget.tokenBudget, "n/a")}</small>
        {budget.cancellable ? (
          <button type="button" onClick={() => navigator.clipboard?.writeText(asText(budget.cancelCommand, "zavorth ask \"parar auto-healing e mostrar erro\""))}>
            Copiar comando de parada
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ContextRecoveryPanel({
  recovery,
  onDraftCommand,
}: {
  recovery: Record<string, any>;
  onDraftCommand: (command: string) => void;
}) {
  const options = asArray(recovery.options);
  const overflow = asRecord(recovery.overflow);
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Context Recovery</span>
        <button type="button" disabled>{asText(recovery.status, "idle")}</button>
      </header>
      <div className="bcc-experience-list">
        {asText(recovery.status) === "needs-selection" ? (
          <>
            <p>{asText(recovery.question, "Escolha o alvo correto.")}</p>
            {options.map((option) => (
              <button key={asText(option.id, asText(option.label))} type="button" onClick={() => onDraftCommand(asText(option.command))}>
                {asText(option.label, "Opcao")}
              </button>
            ))}
            {overflow.hasOverflow ? (
              <small>Mostrando {Number(overflow.shownOptions || options.length)} de {Number(overflow.totalOptions || options.length)} alvos. Abra o Dashboard completo para todos.</small>
            ) : null}
          </>
        ) : (
          <p>Sem ambiguidade pendente. O Zavorth vai perguntar antes de agir quando houver mais de um alvo provavel.</p>
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

function LearningReviewPanel({
  learning,
  onDraftCommand,
}: {
  learning: Record<string, any>;
  onDraftCommand: (command: string) => void;
}) {
  const candidates = asArray(learning.candidates);
  return (
    <article className="bcc-experience-card">
      <header>
        <span>Learning Review</span>
        <button type="button" onClick={() => onDraftCommand("zavorth learn")}>Revisar</button>
      </header>
      <div className="bcc-experience-list">
        {candidates.length ? candidates.slice(0, 3).map((candidate) => (
          <div key={asText(candidate.id, asText(candidate.title))} className="bcc-experience-list__item" data-tone={asText(candidate.state) === "pending" ? "warn" : "ok"}>
            <strong>{asText(candidate.title, "Aprendizado")}</strong>
            <small>{asText(candidate.recommendation, asText(candidate.observedPattern, "Candidato aguardando revisao."))}</small>
            <small>{Math.round(Number(candidate.confidence || 0) * 100)}% | {asText(candidate.state, "pending")}</small>
          </div>
        )) : (
          <p>Nenhum candidato pendente. Aprendizados so mudam comportamento com consentimento.</p>
        )}
      </div>
    </article>
  );
}
