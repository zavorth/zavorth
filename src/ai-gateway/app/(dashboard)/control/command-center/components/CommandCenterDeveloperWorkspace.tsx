"use client";

import type { ControlPageClientModel } from "../../controlPageClient.types";
import { asText } from "../../controlPageClient.utils";
import {
  CommandCenterBadge,
  CommandCenterButton,
  CommandCenterCard,
} from "./CommandCenterPrimitives";

type CommandCenterDeveloperWorkspaceProps = {
  model: ControlPageClientModel;
};

export function CommandCenterDeveloperWorkspace({ model }: CommandCenterDeveloperWorkspaceProps) {
  const snapshot = model.developerWorkspace;
  const project = asRecord(snapshot?.project);
  const summary = asRecord(snapshot?.summary);
  const policy = asRecord(snapshot?.policy);
  const processes = asRecordArray(snapshot?.processes);
  const hooks = asRecordArray(snapshot?.hooks);
  const agents = asRecordArray(snapshot?.agents);
  const profiles = asRecordArray(snapshot?.ptyProfiles);
  const logWatch = asRecord(snapshot?.logWatch);
  const logWatchSummary = asRecord(logWatch.summary);
  const logWatchEvents = asRecordArray(logWatch.events);
  const warnings = asTextArray(snapshot?.warnings);
  const actionResult = model.developerWorkspaceActionResult;

  const runWorkspaceAction = (action: "start" | "stop" | "restart", processId?: string | null) => {
    void model.handleDeveloperWorkspaceAction(action, processId);
  };

  return (
    <div className="bcc-developer-workspace">
      <section className="bcc-developer-workspace__hero" data-status={snapshot?.ok === false ? "blocked" : "ready"}>
        <div>
          <span className="bcc-card__label">Developer Workspace</span>
          <h2>{asText(project.name, "Workspace sem manifesto")}</h2>
          <p>{asText(project.description, snapshot?.error || "Manifesto, processos e logs do projeto atual.")}</p>
        </div>
        <div className="bcc-gateway-console__badges">
          <CommandCenterBadge tone={snapshot?.ok === false ? "warn" : "ok"}>
            {asText(snapshot?.contractVersion, "sem contrato")}
          </CommandCenterBadge>
          <CommandCenterBadge>
            {asText(policy.defaultMode, "suggest")}
          </CommandCenterBadge>
        </div>
      </section>

      <div className="bcc-state-grid">
        <WorkspaceMetric
          label="Processos"
          value={asText(summary.processes, "0")}
          detail={`${asText(summary.running, "0")} running - ${asText(summary.failed, "0")} failed`}
          tone={Number(summary.failed || 0) > 0 ? "danger" : Number(summary.running || 0) > 0 ? "ok" : "info"}
        />
        <WorkspaceMetric
          label="Hooks"
          value={asText(summary.hooks, "0")}
          detail={`${asText(summary.agents, "0")} agentes observando`}
          tone={Number(summary.hooks || 0) > 0 ? "info" : "ok"}
        />
        <WorkspaceMetric
          label="Logs"
          value={asText(summary.logs, "0")}
          detail={`${asText(logWatchSummary.events, "0")} eventos de hook`}
          tone={warnings.length > 0 || model.developerWorkspaceError ? "warn" : "ok"}
        />
        <WorkspaceMetric
          label="Auto-heal"
          value={asText(logWatchSummary.suggestions, "0")}
          detail={`${asText(logWatchSummary.blocked, "0")} bloqueados - ${asText(logWatchSummary.manualRequired, "0")} manual`}
          tone={Number(logWatchSummary.blocked || 0) > 0 ? "warn" : Number(logWatchSummary.suggestions || 0) > 0 ? "info" : "ok"}
        />
        <WorkspaceMetric
          label="Policy"
          value={asText(policy.defaultMode, "suggest")}
          detail={asTextArray(policy.requireApprovalFor).join(", ") || "approval padrao"}
          tone="info"
        />
      </div>

      {actionResult ? (
        <section className="bcc-developer-workspace__notice" data-status={asText(actionResult.status, "unknown")}>
          <CommandCenterBadge tone={workspaceTone(actionResult.status)}>
            {asText(actionResult.status, "resultado")}
          </CommandCenterBadge>
          <span>{asText(actionResult.message, "Acao processada pelo Developer Workspace.")}</span>
        </section>
      ) : null}

      <div className="bcc-developer-workspace__grid">
        <CommandCenterCard label="Processos" title={`${processes.length} declarados`} className="bcc-developer-workspace__processes">
          <div className="bcc-list">
            {processes.length > 0 ? processes.map((process) => {
              const processId = asText(process.id);
              const status = asText(process.status, "idle");
              const pendingId = model.developerWorkspaceActionPending;
              return (
                <div key={processId} className="bcc-list-item bcc-workspace-process" data-active={status === "running"}>
                  <div>
                    <span className="bcc-list-item__title">{asText(process.name || process.id, "Processo")}</span>
                    <span className="bcc-list-item__meta">
                      {status} - pid {asText(process.pid, "n/a")} - restart {asText(process.restart, "never")}
                    </span>
                    <code>{asText(process.command, "command redacted")}</code>
                  </div>
                  <div className="bcc-workspace-process__actions">
                    <CommandCenterButton
                      type="button"
                      disabled={Boolean(pendingId)}
                      onClick={() => runWorkspaceAction("start", processId)}
                    >
                      {pendingId === `start:${processId}` ? "..." : "Start"}
                    </CommandCenterButton>
                    <CommandCenterButton
                      type="button"
                      disabled={Boolean(pendingId)}
                      onClick={() => runWorkspaceAction("stop", processId)}
                    >
                      {pendingId === `stop:${processId}` ? "..." : "Stop"}
                    </CommandCenterButton>
                    <CommandCenterButton
                      type="button"
                      disabled={Boolean(pendingId)}
                      onClick={() => runWorkspaceAction("restart", processId)}
                    >
                      {pendingId === `restart:${processId}` ? "..." : "Restart"}
                    </CommandCenterButton>
                  </div>
                </div>
              );
            }) : (
              <p className="bcc-empty-note">Nenhum processo foi declarado no manifesto.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Logs" title="Streams recentes">
          <div className="bcc-workspace-log-list">
            {processes.flatMap((process) => asRecordArray(process.logs)).slice(-12).map((log, index) => (
              <div key={`${asText(log.id, "log")}-${index}`} className="bcc-workspace-log" data-stream={asText(log.stream, "system")}>
                <span>{asText(log.processId, "process")} / {asText(log.stream, "system")}</span>
                <code>{asText(log.text, "sem texto")}</code>
              </div>
            ))}
            {processes.flatMap((process) => asRecordArray(process.logs)).length === 0 ? (
              <p className="bcc-empty-note">Logs aparecem aqui quando um processo supervisionado emitir stdout/stderr.</p>
            ) : null}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Auto-healing" title={`${logWatchEvents.length} eventos`}>
          <div className="bcc-list">
            {logWatchEvents.length > 0 ? logWatchEvents.slice(-8).map((event, index) => (
              <div key={`${asText(event.id, "event")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {asText(event.status, "recorded")} - {asText(event.category, "generic_error")}
                </span>
                <span className="bcc-list-item__meta">
                  {asText(event.processId, "process")} / {asText(event.mode, "suggest")} / risco {asText(event.risk, "medium")}
                </span>
                <span className="bcc-list-item__meta">{asText(event.summary, "Evento de log auditado.")}</span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum evento auditavel de hook foi registrado nesta sessao.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="PTY" title={`${profiles.length} perfis`}>
          <div className="bcc-list">
            {profiles.length > 0 ? profiles.map((profile, index) => (
              <div key={`${asText(profile.sessionId, "pty")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">{asText(profile.sessionId, "PTY")}</span>
                <span className="bcc-list-item__meta">
                  {asText(profile.processId, "process")} - input {asText(profile.inputPolicy, "operator-only")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum perfil PTY foi projetado para este workspace.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Hooks" title={`${hooks.length} observadores`}>
          <div className="bcc-list">
            {hooks.length > 0 ? hooks.map((hook, index) => (
              <div key={`${asText(hook.id, "hook")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">{asText(hook.id, "Hook")}</span>
                <span className="bcc-list-item__meta">
                  {asText(hook.processId, "process")} - {asText(hook.mode, "suggest")} - {asText(hook.pattern, "pattern")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum hook de log declarado no manifesto.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Agentes" title={`${agents.length} declarados`}>
          <div className="bcc-list">
            {agents.length > 0 ? agents.map((agent, index) => (
              <div key={`${asText(agent.id, "agent")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">{asText(agent.id, "Agente")}</span>
                <span className="bcc-list-item__meta">
                  {asText(agent.role, "project-maintainer")} - {asText(agent.mode, "suggest")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum agente de workspace declarado.</p>
            )}
          </div>
        </CommandCenterCard>
      </div>
    </div>
  );
}

function WorkspaceMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "info" | "ok" | "warn" | "danger";
}) {
  return (
    <article className="bcc-state-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function workspaceTone(status: unknown): "info" | "ok" | "warn" | "danger" {
  const normalized = asText(status).toLowerCase();
  if (normalized === "executed") {
    return "ok";
  }
  if (normalized === "approval_required") {
    return "warn";
  }
  if (normalized === "failed" || normalized === "invalid") {
    return "danger";
  }
  return "info";
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asRecordArray(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value) ? value : [];
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => asText(entry)).filter(Boolean)
    : [];
}
