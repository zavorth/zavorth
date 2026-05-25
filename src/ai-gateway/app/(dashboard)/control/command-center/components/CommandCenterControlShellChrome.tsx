import type { DashboardCommandAction, DashboardCommandCenterViewModel } from "../contracts";
import type { DashboardCommandCenterFixturePreviewOption } from "../preview";
import { formatCommandCenterBudgetLabel, formatCommandCenterModelRouteLabel } from "./CommandCenterObservability";
import { humanAgentStatus, humanRuntimeStatus, runtimeTone } from "./CommandCenterControlShellHelpers";
import { CommandCenterBadge } from "./CommandCenterPrimitives";

type CommandCenterFixturePreviewBarProps = {
  activeFixtureId: string | null;
  options: DashboardCommandCenterFixturePreviewOption[];
  viewModel: DashboardCommandCenterViewModel;
  onSelect: (fixtureId: string) => void;
};

export function CommandCenterFixturePreviewBar({
  activeFixtureId,
  options,
  viewModel,
  onSelect,
}: CommandCenterFixturePreviewBarProps) {
  const activeOption = activeFixtureId
    ? options.find((option) => option.id === activeFixtureId)
    : null;

  return (
    <section
      className="bcc-fixture-preview"
      data-active={activeFixtureId ? "true" : "false"}
      aria-label="Preview de contrato do Command Center"
    >
      <div>
        <span className="bcc-fixture-preview__label">
          {activeFixtureId ? "Preview de contrato" : "Fonte ao vivo"}
        </span>
        <strong>
          {activeOption?.label ?? viewModel.adapterSource.label}
        </strong>
        <p>
          {activeOption?.description ?? "Renderizando o snapshot real do Zavorth sem fixture visual."}
        </p>
      </div>
      <label className="bcc-fixture-preview__select">
        <span>Cenario visual</span>
        <select
          value={activeFixtureId ?? ""}
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">Ao vivo</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

type CommandCenterMissionBriefProps = {
  viewModel: DashboardCommandCenterViewModel;
  onAction: (action: DashboardCommandAction) => void;
};

export function CommandCenterMissionBrief({
  viewModel,
  onAction,
}: CommandCenterMissionBriefProps) {
  const run = viewModel.agentRun;
  const primaryAction = viewModel.approvals.length > 0
    ? viewModel.actions.find((action) => action.id === "approvals.open")
    : viewModel.runtime.blockers.length > 0
      ? viewModel.actions.find((action) => action.id === "runtime.doctor")
      : viewModel.artifacts.length > 0
        ? viewModel.actions.find((action) => action.id === "navigate.chat")
        : viewModel.actions.find((action) => action.id === "runtime.status");

  return (
    <section className="bcc-mission-brief" data-status={viewModel.runtime.status}>
      <div className="bcc-mission-brief__primary">
        <span className="bcc-card__label">Missao atual</span>
        <h1>{run?.title ?? "Command Center pronto"}</h1>
        <p>{run?.summary ?? viewModel.runtime.summary}</p>
        <div className="bcc-mission-brief__badges">
          <CommandCenterBadge tone={runtimeTone(viewModel.runtime.status)}>
            {humanRuntimeStatus(viewModel.runtime.status)}
          </CommandCenterBadge>
          <CommandCenterBadge>
            {viewModel.modelProfile.modelLabel}
          </CommandCenterBadge>
          <CommandCenterBadge>
            rota {formatCommandCenterModelRouteLabel(viewModel.modelProfile)}
          </CommandCenterBadge>
          <CommandCenterBadge tone={viewModel.budget.status === "exceeded" ? "danger" : viewModel.budget.status === "attention" ? "warn" : "info"}>
            budget {formatCommandCenterBudgetLabel(viewModel.budget)}
          </CommandCenterBadge>
          <CommandCenterBadge tone={viewModel.toolExposure.mode === "restricted" ? "warn" : "info"}>
            ferramentas: {viewModel.toolExposure.mode}
          </CommandCenterBadge>
        </div>
      </div>

      <div className="bcc-mission-brief__metrics">
        <CommandCenterMetricCard
          label="Run"
          value={run ? humanAgentStatus(run.status) : "idle"}
          detail={run?.updatedAt ?? viewModel.generatedAt}
          tone={run?.status === "failed" ? "danger" : run?.status === "waiting_approval" ? "warn" : "ok"}
        />
        <CommandCenterMetricCard
          label="Approvals"
          value={String(viewModel.counts.approvals)}
          detail={viewModel.counts.approvals > 0 ? "aguardando voce" : "sem bloqueio"}
          tone={viewModel.counts.approvals > 0 ? "warn" : "ok"}
        />
        <CommandCenterMetricCard
          label="Artifacts"
          value={String(viewModel.counts.artifacts)}
          detail={viewModel.counts.artifacts > 0 ? "entregas prontas" : "sem artifact"}
          tone={viewModel.counts.artifacts > 0 ? "info" : "ok"}
        />
        <CommandCenterMetricCard
          label="Health"
          value={humanRuntimeStatus(viewModel.health.status)}
          detail={viewModel.health.summary}
          tone={runtimeTone(viewModel.health.status)}
        />
      </div>

      {primaryAction ? (
        <button
          type="button"
          className="bcc-mission-brief__action"
          onClick={() => onAction(primaryAction)}
        >
          <span>{primaryAction.label}</span>
          <small>{primaryAction.description}</small>
        </button>
      ) : null}
    </section>
  );
}

type CommandCenterMetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "info" | "ok" | "warn" | "danger";
};

function CommandCenterMetricCard({
  label,
  value,
  detail,
  tone = "info",
}: CommandCenterMetricCardProps) {
  return (
    <article className="bcc-metric-card" data-tone={tone}>
      <span className="bcc-metric-card__label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
