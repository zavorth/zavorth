"use client";

import type { ControlPageClientModel } from "../../controlPageClient.types";
import { asText } from "../../controlPageClient.utils";
import type {
  DashboardApprovalSummary,
  DashboardCommandCenterViewModel,
  DashboardVisibleCapability,
} from "../contracts";
import {
  CommandCenterBadge,
  CommandCenterButton,
  CommandCenterCard,
} from "./CommandCenterPrimitives";
import {
  buildCommandCenterRunObservabilityRows,
  formatCommandCenterBudgetLabel,
  formatCommandCenterModelRouteLabel,
  formatCommandCenterRunObservatoryQuery,
} from "./CommandCenterObservability";
import { CommandCenterRemoteMeshApprovalPanel } from "./CommandCenterRemoteMeshApprovalPanel";

type CommandCenterOperationsPanelProps = {
  model: ControlPageClientModel;
  viewModel: DashboardCommandCenterViewModel;
  onDraftCommand: (command: string) => void;
  previewMode?: boolean;
};

export function CommandCenterOperationsPanel({
  model,
  viewModel,
  onDraftCommand,
  previewMode = false,
}: CommandCenterOperationsPanelProps) {
  return (
    <aside className="bcc-side-panel" aria-label="Operacao do Command Center">
      <CommandCenterActiveMissionPanel
        model={model}
        onDraftCommand={onDraftCommand}
      />
      <CommandCenterApprovalsPanel
        model={model}
        viewModel={viewModel}
        onDraftCommand={onDraftCommand}
        previewMode={previewMode}
      />
      <CommandCenterSensitiveActionFlowPanel
        model={model}
        onDraftCommand={onDraftCommand}
      />
      <CommandCenterVisualReceiptsPanel
        model={model}
        onDraftCommand={onDraftCommand}
      />
      <CommandCenterRunPanel viewModel={viewModel} />
      <CommandCenterDoctorPanel
        viewModel={viewModel}
        onDraftCommand={onDraftCommand}
      />
      <CommandCenterProviderCockpitPanel
        viewModel={viewModel}
        onDraftCommand={onDraftCommand}
      />
      <CommandCenterProviderPreferencePanel
        model={model}
        onDraftCommand={onDraftCommand}
      />
      <CommandCenterRemoteMeshApprovalPanel
        snapshot={viewModel.remoteMeshApprovalUx}
        previewMode={previewMode}
      />
      <CommandCenterArtifactPanel
        model={model}
        viewModel={viewModel}
      />
      <CommandCenterCard label="Memory" title={viewModel.memorySignals.length > 0 ? `${viewModel.memorySignals.length} signals` : "Ready when needed"}>
        <div className="bcc-list">
          {viewModel.memorySignals.length > 0 ? viewModel.memorySignals.slice(0, 4).map((signal) => (
            <div key={signal.id} className="bcc-list-item">
              <span className="bcc-list-item__title">{signal.title}</span>
              <span className="bcc-list-item__meta">{signal.layer} - {signal.summary}</span>
            </div>
          )) : (
            <p className="bcc-empty-note">Recovered context appears here only when it helps the current mission.</p>
          )}
        </div>
      </CommandCenterCard>
    </aside>
  );
}

function CommandCenterActiveMissionPanel({
  model,
  onDraftCommand,
}: {
  model: ControlPageClientModel;
  onDraftCommand: (command: string) => void;
}) {
  const agentRuntime = model.state?.agentRuntime as Record<string, any> | null | undefined;
  const projection = agentRuntime?.activeMissionUx as Record<string, any> | null | undefined;
  const mission = projection?.mission as Record<string, any> | null | undefined;
  const counts = projection?.counts as Record<string, any> | null | undefined;
  const timeline = Array.isArray(projection?.timeline) ? projection.timeline.slice(0, 5) as Record<string, any>[] : [];
  const actions = Array.isArray(projection?.actions) ? projection.actions.slice(0, 4) as Record<string, any>[] : [];

  return (
    <CommandCenterCard
      label="Mission"
      title={mission ? asText(mission.title, "Active mission") : "No active mission"}
    >
      <div className="bcc-list">
        {projection && mission ? (
          <>
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">
                {asText(mission.summary, "Zavorth esta pronto para a proxima missao.")}
              </span>
              <span className="bcc-list-item__meta">
                {asText(mission.providerLabel, "provider")} - {asText(mission.modelLabel, "model")}
              </span>
            </div>
            <div className="bcc-run-card__meta">
              <CommandCenterBadge tone={missionTone(projection.tone)}>
                {asText(projection.status, "idle")}
              </CommandCenterBadge>
              <CommandCenterBadge tone={mission.risk === "high" ? "danger" : mission.risk === "medium" ? "warn" : "ok"}>
                risk {asText(mission.risk, "unknown")}
              </CommandCenterBadge>
              <CommandCenterBadge tone={projection.safety?.commandCenterCanExecute === false ? "ok" : "danger"}>
                projection-only
              </CommandCenterBadge>
            </div>
            <div className="bcc-health-list">
              <div className="bcc-health-row" data-status={Number(counts?.approvalsPending || 0) > 0 ? "attention" : "ready"}>
                <span>Approvals</span>
                <small>{Number(counts?.approvalsPending || 0)} pending</small>
              </div>
              <div className="bcc-health-row" data-status={Number(counts?.receiptsReady || 0) > 0 ? "ready" : "attention"}>
                <span>Receipts</span>
                <small>{Number(counts?.receiptsReady || 0)} ready</small>
              </div>
              <div className="bcc-health-row" data-status={Number(counts?.blockers || 0) > 0 ? "blocked" : "ready"}>
                <span>Blockers</span>
                <small>{Number(counts?.blockers || 0)} bloqueios</small>
              </div>
            </div>
            <div className="bcc-run-mini-timeline">
              {timeline.map((event) => (
                <div key={asText(event.id, asText(event.label, "mission-event"))} className="bcc-run-mini-timeline__item" data-status={missionTimelineStatus(event.status)}>
                  <span>{asText(event.label, "Step")}</span>
                  <small>{asText(event.summary, "Mission step.")}</small>
                </div>
              ))}
            </div>
            <div className="bcc-action-row">
              {actions.map((action) => (
                <CommandCenterButton
                  key={asText(action.id, asText(action.label, "mission-action"))}
                  type="button"
                  onClick={() => onDraftCommand(asText(action.command, "zavorth missions"))}
                >
                  {asText(action.label, "Open")}
                </CommandCenterButton>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="bcc-empty-note">Start with a normal request. Mission status, approvals, artifacts and receipts will stay together here.</p>
            <div className="bcc-action-row">
              <CommandCenterButton type="button" onClick={() => onDraftCommand("zavorth go")}>
                Start mission
              </CommandCenterButton>
            </div>
          </>
        )}
      </div>
    </CommandCenterCard>
  );
}

function missionTone(value: unknown): "info" | "ok" | "warn" | "danger" {
  const raw = asText(value).toLowerCase();
  if (raw === "ok" || raw === "warn" || raw === "danger") {
    return raw;
  }
  return "info";
}

function missionTimelineStatus(value: unknown): "done" | "pending" | "blocked" {
  const raw = asText(value).toLowerCase();
  if (raw === "blocked") return "blocked";
  if (raw === "done") return "done";
  return "pending";
}

function CommandCenterSensitiveActionFlowPanel({
  model,
  onDraftCommand,
}: {
  model: ControlPageClientModel;
  onDraftCommand: (command: string) => void;
}) {
  const agentRuntime = model.state?.agentRuntime as Record<string, any> | null | undefined;
  const projection = agentRuntime?.sensitiveActionFlowUx as Record<string, any> | null | undefined;
  const card = projection?.card as Record<string, any> | null | undefined;
  const preview = card?.preview as Record<string, any> | null | undefined;
  const approval = card?.approval as Record<string, any> | null | undefined;
  const execution = card?.execution as Record<string, any> | null | undefined;
  const rollback = card?.rollback as Record<string, any> | null | undefined;
  const actions = Array.isArray(card?.actions) ? card.actions.slice(0, 4) as Record<string, any>[] : [];
  const steps = Array.isArray(card?.steps) ? card.steps.slice(0, 4) as Record<string, any>[] : [];

  return (
    <CommandCenterCard
      label="Sensitive Flow"
      title={card ? asText(card.title, "Sensitive preview") : "No sensitive flow"}
    >
      <div className="bcc-list">
        {card ? (
          <>
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">
                {asText(card.subtitle, "Governed preview ready for review.")}
              </span>
              <span className="bcc-list-item__meta">
                {asText(card.request, "No sensitive request selected.")}
              </span>
            </div>
            <div className="bcc-run-card__meta">
              <CommandCenterBadge tone={sensitiveTone(card.tone)}>
                {asText(card.status, "projection")}
              </CommandCenterBadge>
              <CommandCenterBadge tone={card.risk === "high" ? "danger" : card.risk === "medium" ? "warn" : "ok"}>
                risk {asText(card.risk, "unknown")}
              </CommandCenterBadge>
              <CommandCenterBadge tone={card.safety?.commandCenterCanExecute === false ? "ok" : "danger"}>
                projection-only
              </CommandCenterBadge>
            </div>
            <div className="bcc-health-list">
              <div className="bcc-health-row" data-status={Number(preview?.filesChanged || 0) > 0 ? "attention" : "ready"}>
                <span>Preview</span>
                <small>
                  {Number(preview?.filesChanged || 0)} files - {Number(preview?.commands || 0)} commands - {Number(preview?.networkCalls || 0)} network
                </small>
              </div>
              <div className="bcc-health-row" data-status={approval?.required && approval?.status === "pending" ? "attention" : approval?.status === "denied" ? "blocked" : "ready"}>
                <span>Approval</span>
                <small>{asText(approval?.simpleText, "No approval required.")}</small>
              </div>
              <div className="bcc-health-row" data-status={execution?.mode === "blocked" ? "blocked" : execution?.mode === "dry_run" ? "attention" : "ready"}>
                <span>Execution</span>
                <small>{asText(execution?.why, "No live execution from Command Center.")}</small>
              </div>
              <div className="bcc-health-row" data-status={rollback?.available ? "ready" : "attention"}>
                <span>Rollback</span>
                <small>{asText(rollback?.summary, "Rollback appears when mutable work has a prepared artifact.")}</small>
              </div>
            </div>
            {steps.length > 0 ? (
              <div className="bcc-run-mini-timeline">
                {steps.map((step) => (
                  <div key={asText(step.id, asText(step.label, "step"))} className="bcc-run-mini-timeline__item" data-status={sensitiveStepStatus(step.status)}>
                    <span>{asText(step.label, "Step")}</span>
                    <small>{asText(step.summary, "Flow step.")}</small>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="bcc-action-row">
              {actions.map((action) => (
                <CommandCenterButton
                  key={asText(action.id, asText(action.label, "sensitive-action"))}
                  type="button"
                  onClick={() => onDraftCommand(asText(action.command, "zavorth sensitive-flow --json"))}
                >
                  {asText(action.label, "Open")}
                </CommandCenterButton>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="bcc-empty-note">When a mission needs preview, approval, receipt or rollback, Zavorth shows the safe path here.</p>
            <div className="bcc-action-row">
              <CommandCenterButton type="button" onClick={() => onDraftCommand("zavorth sensitive-flow --request=\"Review this workspace\" --json")}>
                Prepare preview
              </CommandCenterButton>
            </div>
          </>
        )}
      </div>
    </CommandCenterCard>
  );
}

function sensitiveTone(value: unknown): "info" | "ok" | "warn" | "danger" {
  const raw = asText(value).toLowerCase();
  if (raw === "ok" || raw === "warn" || raw === "danger") {
    return raw;
  }
  return "info";
}

function sensitiveStepStatus(value: unknown): "done" | "pending" | "blocked" {
  const raw = asText(value).toLowerCase();
  if (raw === "blocked") return "blocked";
  if (raw === "pending") return "pending";
  return "done";
}

function CommandCenterVisualReceiptsPanel({
  model,
  onDraftCommand,
}: {
  model: ControlPageClientModel;
  onDraftCommand: (command: string) => void;
}) {
  const agentRuntime = model.state?.agentRuntime as Record<string, any> | null | undefined;
  const visualReceipts = agentRuntime?.visualReceipts as Record<string, any> | null | undefined;
  const cards = Array.isArray(visualReceipts?.cards) ? visualReceipts.cards.slice(0, 2) as Record<string, any>[] : [];
  const primary = cards[0] || null;

  return (
    <CommandCenterCard
      label="Receipts"
      title={primary ? asText(primary.title, "Visual receipt") : "No receipts yet"}
    >
      <div className="bcc-list">
        {primary ? (
          <>
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">
                {asText(primary.simpleText, "Receipt recorded.")}
              </span>
              <span className="bcc-list-item__meta">
                {asText(primary.subtitle, "No additional summary.")}
              </span>
            </div>
            <div className="bcc-run-card__meta">
              <CommandCenterBadge tone={receiptTone(primary.tone)}>
                risk {asText(primary.risk, "unknown")}
              </CommandCenterBadge>
              <CommandCenterBadge tone={visualReceipts?.summary?.rawSecretsSerialized === false ? "ok" : "danger"}>
                no secrets
              </CommandCenterBadge>
              <CommandCenterBadge tone={primary.safety?.projectionOnly === true ? "ok" : "warn"}>
                projection-only
              </CommandCenterBadge>
            </div>
            <div className="bcc-health-list">
              {Array.isArray(primary.evidence) ? primary.evidence.slice(0, 4).map((row: Record<string, any>) => (
                <div key={asText(row.id, asText(row.label, "receipt-row"))} className="bcc-health-row" data-status={receiptRowStatus(row.tone)}>
                  <span>{asText(row.label, "Evidence")}</span>
                  <small>{asText(row.value, "0")} - {asText(row.detail, "Receipt evidence.")}</small>
                </div>
              )) : null}
            </div>
            <div className="bcc-action-row">
              {Array.isArray(primary.actions) ? primary.actions.slice(0, 3).map((action: Record<string, any>) => (
                <CommandCenterButton
                  key={asText(action.id, asText(action.label, "receipt-action"))}
                  type="button"
                  onClick={() => onDraftCommand(asText(action.command, "zavorth receipts"))}
                >
                  {asText(action.label, "Open")}
                </CommandCenterButton>
              )) : null}
            </div>
          </>
        ) : (
          <>
            <p className="bcc-empty-note">Receipts appear after a mission, approval or rollback publishes evidence.</p>
            <div className="bcc-action-row">
              <CommandCenterButton type="button" onClick={() => onDraftCommand("zavorth receipts")}>
                Open receipts
              </CommandCenterButton>
            </div>
          </>
        )}
      </div>
    </CommandCenterCard>
  );
}

function receiptTone(value: unknown): "info" | "ok" | "warn" | "danger" {
  const raw = asText(value).toLowerCase();
  if (raw === "ok" || raw === "warn" || raw === "danger") {
    return raw;
  }
  return "info";
}

function receiptRowStatus(value: unknown): "ready" | "attention" | "blocked" {
  const raw = asText(value).toLowerCase();
  if (raw === "danger") {
    return "blocked";
  }
  if (raw === "warn") {
    return "attention";
  }
  return "ready";
}

function CommandCenterProviderPreferencePanel({
  model,
  onDraftCommand,
}: {
  model: ControlPageClientModel;
  onDraftCommand: (command: string) => void;
}) {
  const agentRuntime = model.state?.agentRuntime as Record<string, any> | null | undefined;
  const selection = agentRuntime?.providerSelectionUx as Record<string, any> | null | undefined;
  const preferenceProjection = agentRuntime?.providerPreference as Record<string, any> | null | undefined;
  const selected = selection?.selected as Record<string, any> | null | undefined;
  const preference = preferenceProjection?.preference as Record<string, any> | null | undefined;
  const fallbacks = Array.isArray(selection?.fallbacks) ? selection?.fallbacks.slice(0, 3) as Record<string, any>[] : [];
  const applyCommand = selected?.providerId
    ? `zavorth providers apply ${selected.providerId} --confirm`
    : "zavorth providers select --intent smart";
  const testCommand = selected?.providerId
    ? `zavorth providers test ${selected.providerId} --live`
    : "zavorth providers cockpit";
  const rollbackCommand = asText((preferenceProjection?.commands as Record<string, any> | undefined)?.rollback);
  const resolvedRollbackCommand = rollbackCommand || (preference?.receiptId
    ? `zavorth providers rollback ${preference.receiptId} --confirm`
    : "");

  return (
    <CommandCenterCard
      label="Model"
      title={selected?.providerId ? `${selected.providerId} recommended` : "Safe selection"}
    >
      <div className="bcc-list">
        <div className="bcc-list-item">
          <span className="bcc-list-item__title">
            Current: {asText(preference?.providerId, "no saved preference")}
            {preference?.modelId ? ` - ${preference.modelId}` : ""}
          </span>
          <span className="bcc-list-item__meta">
            {preference?.receiptId
              ? `Receipt ${preference.receiptId}`
              : "Runtime uses env/default until a choice is approved."}
          </span>
        </div>

        {selected ? (
          <div className="bcc-list-item">
            <span className="bcc-list-item__title">
              Recommended: {asText(selected.label || selected.providerId, "Provider")}
              {selected.model ? ` - ${selected.model}` : ""}
            </span>
            <span className="bcc-list-item__meta">
              {asText(selected.status, "unknown")} / live {asText(selected.liveStatus, "not_run")} - {asText(selection?.decision, "review")}
            </span>
          </div>
        ) : (
          <p className="bcc-empty-note">Provider selection appears when the readiness matrix is available.</p>
        )}

        {fallbacks.length > 0 ? (
          <div className="bcc-list-item">
            <span className="bcc-list-item__title">Fallbacks</span>
            <span className="bcc-list-item__meta">
              {fallbacks.map((fallback) => `${asText(fallback.providerId, "provider")}=${asText(fallback.status, "unknown")}`).join(" · ")}
            </span>
          </div>
        ) : null}

        <div className="bcc-run-card__meta">
          <CommandCenterBadge tone={selection?.decision === "use_now" ? "ok" : selection?.decision === "blocked" ? "danger" : "warn"}>
            {asText(selection?.decision, "projection")}
          </CommandCenterBadge>
          <CommandCenterBadge tone={selection?.safety?.rawSecretsSerialized === false ? "ok" : "danger"}>
            no secrets
          </CommandCenterBadge>
          <CommandCenterBadge tone={selection?.safety?.dashboardExecutionAuthority === false ? "ok" : "warn"}>
            projection-only
          </CommandCenterBadge>
        </div>

        <div className="bcc-action-row">
          <CommandCenterButton type="button" onClick={() => onDraftCommand(testCommand)}>
            Test
          </CommandCenterButton>
          <CommandCenterButton type="button" onClick={() => onDraftCommand(applyCommand)}>
            Use
          </CommandCenterButton>
          <CommandCenterButton
            type="button"
            disabled={!resolvedRollbackCommand}
            onClick={() => {
              if (resolvedRollbackCommand) {
                onDraftCommand(resolvedRollbackCommand);
              }
            }}
          >
            Rollback
          </CommandCenterButton>
        </div>
      </div>
    </CommandCenterCard>
  );
}

function CommandCenterProviderCockpitPanel({
  viewModel,
  onDraftCommand,
}: {
  viewModel: DashboardCommandCenterViewModel;
  onDraftCommand: (command: string) => void;
}) {
  const cockpit = viewModel.providerCockpit;
  const selectedCard = cockpit?.cards.find((card) => card.providerId === cockpit.selectedProviderId)
    ?? cockpit?.cards.find((card) => card.priority === "primary")
    ?? cockpit?.cards[0]
    ?? null;
  const visibleCards = cockpit?.cards.slice(0, 4) ?? [];
  const primaryAction = cockpit?.actions.find((action) => action.kind === "read")
    ?? selectedCard?.actions.find((action) => action.kind === "read")
    ?? null;
  const liveAction = selectedCard?.actions.find((action) => action.kind === "live_probe")
    ?? cockpit?.actions.find((action) => action.kind === "live_probe")
    ?? null;

  return (
    <CommandCenterCard
      label="Providers"
      title={cockpit ? `${cockpit.summary.readyProviders}/${cockpit.summary.totalProviders} ready` : "No provider cockpit"}
    >
      {cockpit ? (
        <div className="bcc-list">
          <div className="bcc-list-item">
            <span className="bcc-list-item__title">
              Live matrix: {cockpit.summary.livePassed} ok / {cockpit.summary.liveFailed} failed / {cockpit.summary.liveBlocked} blocked
            </span>
            <span className="bcc-list-item__meta">
              {cockpit.safety.normalRenderMakesNoNetworkCalls
                ? "Safe render: no network calls from the dashboard."
                : "Attention: check render policy."}
            </span>
          </div>
          {visibleCards.map((card) => (
            <div key={card.id} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {card.title} {card.model ? `- ${card.model}` : ""}
              </span>
              <span className="bcc-list-item__meta">
                {card.status} / live {card.liveStatus}
                {card.evidence.modelCount !== null ? ` - ${card.evidence.modelCount} models` : ""}
                {card.evidence.durationMs !== null ? ` - ${card.evidence.durationMs}ms` : ""}
              </span>
            </div>
          ))}
          <div className="bcc-run-card__meta">
            <CommandCenterBadge tone={providerCockpitTone(cockpit.status)}>
              {cockpit.status}
            </CommandCenterBadge>
            <CommandCenterBadge tone={cockpit.summary.missingAuth > 0 ? "warn" : "ok"}>
              auth {cockpit.summary.missingAuth}
            </CommandCenterBadge>
            <CommandCenterBadge tone={cockpit.executionAuthority ? "danger" : "ok"}>
              projection-only
            </CommandCenterBadge>
          </div>
          <div className="bcc-action-row">
            <CommandCenterButton
              type="button"
              onClick={() => onDraftCommand(primaryAction?.command ?? "zavorth providers cockpit")}
            >
              Open matrix
            </CommandCenterButton>
            <CommandCenterButton
              type="button"
              disabled={!liveAction}
              onClick={() => {
                if (liveAction) {
                  onDraftCommand(liveAction.command);
                }
              }}
            >
              Prepare probe
            </CommandCenterButton>
          </div>
        </div>
      ) : (
        <div className="bcc-list">
          <p className="bcc-empty-note">
            Provider Cockpit appears when the runtime publishes the live provider matrix.
          </p>
          <div className="bcc-action-row">
            <CommandCenterButton type="button" onClick={() => onDraftCommand("zavorth providers cockpit")}>
              Prepare cockpit
            </CommandCenterButton>
          </div>
        </div>
      )}
    </CommandCenterCard>
  );
}

function CommandCenterRunPanel({
  viewModel,
}: {
  viewModel: DashboardCommandCenterViewModel;
}) {
  const run = viewModel.agentRun;
  const observabilityRows = buildCommandCenterRunObservabilityRows(viewModel);

  return (
    <CommandCenterCard label="Runtime" title={run ? humanAgentStatus(run.status) : "idle"}>
      <div className="bcc-run-card">
        <p>{run?.summary ?? "No runtime execution is active right now."}</p>
        <p className="bcc-run-card__query">
          Observatory: {formatCommandCenterRunObservatoryQuery(viewModel.runObservatory)}
          {" "}({viewModel.runObservatory.matchedRuns}/{viewModel.runObservatory.totalRuns})
        </p>
        <div className="bcc-run-card__meta">
          <CommandCenterBadge tone={run?.status === "failed" ? "danger" : run?.status === "waiting_approval" ? "warn" : "ok"}>
            {run?.modelLabel ?? viewModel.modelProfile.modelLabel}
          </CommandCenterBadge>
          <CommandCenterBadge tone={viewModel.budget.status === "exceeded" ? "danger" : viewModel.budget.status === "attention" ? "warn" : "info"}>
            budget {formatCommandCenterBudgetLabel(viewModel.budget)}
          </CommandCenterBadge>
          <CommandCenterBadge>
            route {formatCommandCenterModelRouteLabel(viewModel.modelProfile)}
          </CommandCenterBadge>
        </div>
        <div className="bcc-run-observability" aria-label="Observabilidade do run">
          {observabilityRows.map((row) => (
            <div key={row.id} className="bcc-run-observability__row">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              {row.detail ? <small>{row.detail}</small> : null}
            </div>
          ))}
        </div>
        {run?.events.length ? (
          <div className="bcc-run-mini-timeline">
            {run.events.slice(0, 4).map((event) => (
              <div key={event.id} className="bcc-run-mini-timeline__item" data-status={event.status ?? "done"}>
                <span>{event.title}</span>
                <small>{event.detail ?? event.kind}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </CommandCenterCard>
  );
}

function providerCockpitTone(
  status: NonNullable<DashboardCommandCenterViewModel["providerCockpit"]>["status"],
): "info" | "ok" | "warn" | "danger" {
  if (status === "ready") {
    return "ok";
  }
  if (status === "blocked") {
    return "danger";
  }
  return "warn";
}

function CommandCenterDoctorPanel({
  viewModel,
  onDraftCommand,
}: {
  viewModel: DashboardCommandCenterViewModel;
  onDraftCommand: (command: string) => void;
}) {
  const hasBlockers = viewModel.runtime.blockers.length > 0;

  return (
    <CommandCenterCard
      label="Doctor"
      title={hasBlockers ? `${viewModel.runtime.blockers.length} attention point${viewModel.runtime.blockers.length === 1 ? "" : "s"}` : "All clear"}
    >
      <div className="bcc-doctor-summary">
        <div>
          <span className="bcc-doctor-summary__label">Healthy</span>
          <p>{viewModel.runtime.wsStatus === "connected" ? "Gateway connected and surface responding." : "Interface is ready to inspect runtime state."}</p>
        </div>
        <div>
          <span className="bcc-doctor-summary__label">Blocked</span>
          <p>{hasBlockers ? viewModel.runtime.blockers[0]?.detail : "Nothing critical in the current snapshot."}</p>
        </div>
        <div>
          <span className="bcc-doctor-summary__label">Next</span>
          <p>{hasBlockers ? "Open doctor for the next safe fix." : "Continue chatting or open status for a quick scan."}</p>
        </div>
      </div>
      {viewModel.health.checks.length > 0 ? (
        <div className="bcc-health-list mt-3">
          {viewModel.health.checks.slice(0, 4).map((check) => (
            <div key={check.id} className="bcc-health-row" data-status={check.status}>
              <span>{check.label}</span>
              <small>{check.detail ?? check.status}</small>
            </div>
          ))}
        </div>
      ) : null}
      <div className="bcc-action-row">
        <CommandCenterButton type="button" onClick={() => onDraftCommand("/doctor")}>
          Prepare doctor
        </CommandCenterButton>
        <CommandCenterButton type="button" onClick={() => onDraftCommand("/mode status")}>
          View status
        </CommandCenterButton>
      </div>
    </CommandCenterCard>
  );
}

function humanAgentStatus(status: NonNullable<DashboardCommandCenterViewModel["agentRun"]>["status"]): string {
  if (status === "waiting_approval") {
    return "waiting approval";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "thinking") {
    return "thinking";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "queued") {
    return "queued";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  return "idle";
}

function CommandCenterApprovalsPanel({
  model,
  viewModel,
  onDraftCommand,
  previewMode,
}: {
  model: ControlPageClientModel;
  viewModel: DashboardCommandCenterViewModel;
  onDraftCommand: (command: string) => void;
  previewMode: boolean;
}) {
  const agentRuntime = model.state?.agentRuntime as Record<string, any> | null | undefined;
  const approvalCardsProjection = agentRuntime?.approvalActionCardsUx as Record<string, any> | null | undefined;
  const approvalCards = Array.isArray(approvalCardsProjection?.cards)
    ? approvalCardsProjection.cards.slice(0, 4) as Record<string, any>[]
    : [];
  const approvals = viewModel.approvals;
  const traceCapabilities = collectApprovalCapabilities(viewModel);
  const highestRisk = approvalCards.some((card) => card.tone === "danger" || card.risk === "high")
    ? "danger"
    : approvalCards.some((card) => card.tone === "warn" || card.risk === "medium")
      ? "attention"
      : approvals.some((approval) => approval.risk === "danger")
    ? "danger"
    : approvals.some((approval) => approval.risk === "attention")
      ? "attention"
      : "safe";
  const visibleCount = approvalCards.length || approvals.length;

  return (
    <CommandCenterCard label="Approvals" title={visibleCount > 0 ? `${visibleCount} pending` : "Queue clear"}>
      <div className="bcc-approval-summary" data-risk={highestRisk}>
        <span>{visibleCount > 0 ? "Decision needed" : "Queue clear"}</span>
        <strong>{visibleCount > 0 ? "Review before release" : "No sensitive action"}</strong>
        <small>
          {visibleCount > 0
            ? "Mutation, sensitive network and external impact stay blocked until your decision."
            : "When permission is needed, risk, scope and reason appear here."}
        </small>
      </div>
      <div className="bcc-list">
        {approvalCards.length > 0 ? approvalCards.map((card, index) => {
          const approvalId = asText(card.id, `approval-card-${index + 1}`);
          const resolving = model.resolvingApprovalId === approvalId;
          const actions = Array.isArray(card.actions) ? card.actions.slice(0, 5) as Record<string, any>[] : [];
          return (
            <div key={approvalId} className="bcc-list-item bcc-approval-row" data-risk={approvalCardRisk(card)}>
              <div className="bcc-approval-row__state">
                <span>{asText(card.status, "pending") === "pending" ? "Waiting for you" : asText(card.status, "status")}</span>
                <span>{asText(card.scope, "session")}</span>
              </div>
              <div className="bcc-approval-row__panel">
                <div className="bcc-approval-row__request">
                  <span>Approval</span>
                  <strong>{asText(card.title, "Pending approval")}</strong>
                  <em>{asText(card.risk, "unknown")}</em>
                </div>
                <span className="bcc-list-item__title">
                  {asText(card.summary, "Review before release.")}
                </span>
                <span className="bcc-list-item__meta">
                  {asText(card.reason, "Policy requires your decision.")}
                </span>
                <div className="bcc-approval-capability">
                  <span>{Number(card.preview?.filesChanged || 0)} files</span>
                  <span>{Number(card.preview?.commands || 0)} commands</span>
                  <span>{Number(card.preview?.networkCalls || 0)} network</span>
                  <span>{card.safety?.dashboardCanExecuteTargetAction === false ? "target blocked" : "check policy"}</span>
                </div>
              </div>
              <div className="bcc-action-row">
                {actions.map((action) => {
                  const kind = asText(action.kind);
                  const label = kind === "allow_once" ? "Allow once" : kind === "deny" ? "Deny" : asText(action.label, "Open");
                  const canResolve = action.dashboardCanResolveApproval === true && (kind === "allow_once" || kind === "deny");
                  return (
                    <CommandCenterButton
                      key={asText(action.id, `${approvalId}:${kind}`)}
                      type="button"
                      variant={kind === "allow_once" ? "primary" : undefined}
                      disabled={previewMode || (canResolve && resolving)}
                      onClick={() => {
                        if (canResolve) {
                          void model.handleApproval(approvalId, kind === "allow_once" ? "approve" : "reject");
                          return;
                        }
                        onDraftCommand(asText(action.command, "zavorth approvals"));
                      }}
                    >
                      {previewMode && canResolve ? "Preview" : label}
                    </CommandCenterButton>
                  );
                })}
              </div>
            </div>
          );
        }) : approvals.length > 0 ? approvals.slice(0, 4).map((approval, index) => {
          const approvalId = asText(approval.id, `approval-${index + 1}`);
          const resolving = model.resolvingApprovalId === approvalId;
          const capability = resolveApprovalCapability(approval, traceCapabilities) ?? buildApprovalFallbackCapability(approval);
          const approveLabel = capability?.sideEffect === "write" || capability?.scope?.toLowerCase().includes("workspace")
            ? "Allow in Workspace"
            : capability?.kind === "docker" || capability?.kind === "mcp"
              ? "Allow via MCP"
              : "Allow";
          const previewLabel = capability?.previewRequired ? "Preview required" : "Preview clean";

          return (
            <div key={approvalId} className="bcc-list-item bcc-approval-row" data-risk={capability?.risk ?? approval.risk}>
              <div className="bcc-approval-row__state">
                <span>Waiting for you</span>
                <span>{approval.createdAt}</span>
              </div>
              <div className="bcc-approval-row__panel">
                <div className="bcc-approval-row__request">
                  <span>Access</span>
                  <strong>{capability?.label ?? asText(approval.title, "capability")}</strong>
                  <em>{capability?.risk ?? approval.risk}</em>
                </div>
                <span className="bcc-list-item__title">
                  {asText(approval.title, "Pending approval")}
                </span>
                <span className="bcc-list-item__meta">
                  {asText(approval.reason, capability?.reason ?? "Review before release.")}
                </span>
                <div className="bcc-approval-capability">
                  <span>{capability.kind}</span>
                  <span>{capability.sideEffect}</span>
                  <span>{previewLabel}</span>
                  <span>scope: {capability.scope}</span>
                </div>
              </div>
              <div className="bcc-action-row">
                <CommandCenterButton
                  type="button"
                  variant="primary"
                  disabled={previewMode || resolving}
                  onClick={() => {
                    void model.handleApproval(approvalId, "approve");
                  }}
                >
                  {previewMode ? "Preview" : approveLabel}
                </CommandCenterButton>
                <CommandCenterButton
                  type="button"
                  disabled={previewMode || resolving}
                  onClick={() => {
                    void model.handleApproval(approvalId, "reject");
                  }}
                >
              Deny
                </CommandCenterButton>
              </div>
            </div>
          );
        }) : (
          <p className="bcc-empty-note">No approvals waiting for you right now.</p>
        )}
      </div>
    </CommandCenterCard>
  );
}

function approvalCardRisk(card: Record<string, any>): DashboardVisibleCapability["risk"] {
  const risk = asText(card.risk).toLowerCase();
  const tone = asText(card.tone).toLowerCase();
  if (risk === "high" || tone === "danger") return "danger";
  if (risk === "medium" || tone === "warn") return "attention";
  if (risk === "low" || tone === "ok") return "safe";
  return "unknown";
}

function buildApprovalFallbackCapability(approval: DashboardApprovalSummary): DashboardVisibleCapability {
  const haystack = [
    approval.title,
    approval.reason,
    approval.command,
    approval.scope,
  ].map((value) => asText(value).toLowerCase()).join(" ");
  const isShell = /shell|terminal|npm|powershell|exec/.test(haystack);
  const isPatch = /apply_patch|patch|write|edit|editar|arquivo/.test(haystack);
  const label = isShell ? "shell.exec" : isPatch ? "apply_patch" : asText(approval.title, "approval");
  const sideEffect: DashboardVisibleCapability["sideEffect"] = isShell ? "process" : isPatch ? "write" : "unknown";
  const kind: DashboardVisibleCapability["kind"] = isShell ? "shell" : isPatch ? "tool" : "runtime";
  return {
    id: label,
    label,
    kind,
    risk: approval.risk,
    requiresApproval: true,
    previewRequired: sideEffect === "process" || sideEffect === "write" || approval.risk !== "safe",
    allowed: false,
    sideEffect,
    reason: asText(approval.reason, "Revise antes de liberar."),
    scope: asText(approval.scope, "session"),
  };
}

function collectApprovalCapabilities(viewModel: DashboardCommandCenterViewModel): DashboardVisibleCapability[] {
  const events = [
    ...(viewModel.trace?.events || []),
    ...(viewModel.agentRun?.trace?.events || []),
    ...viewModel.messages.flatMap((message) => message.trace || []),
  ];
  return events
    .map((event) => event.capability)
    .filter((capability): capability is DashboardVisibleCapability => Boolean(capability?.requiresApproval));
}

function resolveApprovalCapability(
  approval: DashboardApprovalSummary,
  capabilities: DashboardVisibleCapability[],
): DashboardVisibleCapability | null {
  const haystack = [
    approval.id,
    approval.title,
    approval.reason,
    approval.command,
    approval.scope,
  ].map((value) => asText(value).toLowerCase()).join(" ");
  return capabilities.find((capability) => {
    const label = capability.label.toLowerCase();
    const id = capability.id.toLowerCase();
    const scope = capability.scope.toLowerCase();
    return haystack.includes(label)
      || haystack.includes(id)
      || (scope !== "runtime" && haystack.includes(scope));
  }) ?? capabilities[0] ?? null;
}

function CommandCenterArtifactPanel({
  model,
  viewModel,
}: {
  model: ControlPageClientModel;
  viewModel: DashboardCommandCenterViewModel;
}) {
  return (
    <section className="bcc-artifact-pane" aria-label="Artifacts do Command Center">
      <p className="bcc-card__label">Artifacts</p>
      <h2 className="bcc-card__title">{`${viewModel.counts.artifacts} disponiveis`}</h2>
      <div className="bcc-card__body">
        {model.diffPreview ? (
          <div className="bcc-list">
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">Diff aberto</span>
              <span className="bcc-list-item__meta">{model.diffPreview.summary}</span>
            </div>
            <pre className="bcc-diff-preview">{model.diffPreview.consolidatedDiff ?? "Diff sem conteudo consolidado."}</pre>
          </div>
        ) : viewModel.artifacts.length > 0 ? (
          <div className="bcc-list">
            {viewModel.artifacts.slice(0, 5).map((artifact) => (
              <div key={artifact.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{artifact.title}</span>
                <span className="bcc-list-item__meta">{artifact.kind} - {artifact.status} - {artifact.createdAt}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="bcc-empty-note">Ainda nao ha artifacts nesta sessao.</p>
        )}

        {model.toolRuns.length > 0 ? (
          <div className="bcc-tool-run-strip">
            <span className="bcc-card__label">Diffs de ferramentas</span>
            {model.toolRuns.slice(0, 3).map((run, index) => {
              const runId = asText(run?.toolRunId ?? run?.runId ?? run?.id, `tool-${index + 1}`);

              return (
                <button
                  key={runId}
                  type="button"
                  className="bcc-list-item text-left"
                  onClick={() => {
                    void model.handleOpenDiff(runId);
                  }}
                >
                  <span className="bcc-list-item__title">
                    {asText(run?.name ?? run?.tool ?? run?.command, "Ferramenta")}
                  </span>
                  <span className="bcc-list-item__meta">Abrir diff/artifact relacionado</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
