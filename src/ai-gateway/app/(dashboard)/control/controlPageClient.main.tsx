"use client";

import { Button, Card } from "@/shared/components";
import type { ControlPageClientModel } from "./controlPageClient.types";
import { asText } from "./controlPageClient.utils";

type ControlPageClientMainProps = {
  model: ControlPageClientModel;
};

export function ControlPageClientMain({ model }: ControlPageClientMainProps) {
  const {
    timelineItems,
    toolRuns,
    handleOpenDiff,
    diffPreview,
    artifacts,
    capabilities,
    topConsumers,
    companions,
    wsStatus,
    runtimeWarnings,
    runtimeApiV1,
    receiptCards,
    providerRows,
    channelRows,
    missionRows,
    resolvingMissionId,
    resolvingProviderId,
    resolvingChannelActionId,
    handleMissionCancel,
    handleProviderTest,
    handleChannelAction,
  } = model;
  const runtimeApiEvents = Array.isArray(runtimeApiV1?.events?.data) ? runtimeApiV1.events.data : [];

  return (
    <div className="space-y-6">
      <Card title="Timeline da sessao" subtitle="Mensagens e tasks no mesmo replay" icon="schedule">
        <div className="space-y-3">
          {timelineItems.length > 0 ? (
            timelineItems.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="rounded-lg border border-black/5 bg-bg p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-sm text-text-main">{item.title}</strong>
                  <span className="text-xs uppercase tracking-[0.12em] text-text-muted">
                    {item.kind === "task" ? "task" : "chat"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-text-muted">{item.body}</p>
                <p className="mt-2 text-xs text-text-muted">{item.timestamp}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-muted">
              O replay desta sessao ainda esta vazio. Envie uma tarefa para comecar.
            </p>
          )}
        </div>
      </Card>

      <Card title="Mission Cockpit" subtitle="Preview, live status and cancellation from Runtime API v1" icon="track_changes">
        <div className="space-y-3">
          {missionRows.length > 0 ? (
            missionRows.slice(0, 6).map((mission, index) => {
              const missionId = asText(
                mission?.missionId || mission?.mission_id || mission?.taskId || mission?.id,
                `mission-${index + 1}`,
              );
              const title = asText(mission?.title || mission?.intent || mission?.command, missionId);
              const status = asText(mission?.status || mission?.state || mission?.phase, "preview");
              const risk = asText(mission?.risk || mission?.riskLevel || mission?.safety?.risk, "unknown");
              const summary = asText(
                mission?.summary || mission?.description || mission?.result?.summary,
                "Runtime API v1 registered this mission for the Command Center.",
              );
              const canCancel = !["completed", "cancelled", "failed"].includes(status.toLowerCase());
              return (
                <div key={`${missionId}-${index}`} className="rounded-lg border border-black/5 bg-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm text-text-main">{title}</strong>
                    <span className="rounded-full border border-black/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                      {status} - risk {risk}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{summary}</p>
                  <p className="mt-2 text-xs text-text-muted">Mission ID: {missionId}</p>
                  {canCancel ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="cancel"
                        loading={resolvingMissionId === missionId}
                        onClick={() => {
                          void handleMissionCancel(missionId);
                        }}
                      >
                        Cancel mission
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-text-muted">
              No Runtime API v1 missions yet. Preview a mission from the sidebar to register one without executing it.
            </p>
          )}
        </div>
      </Card>

      <Card title="Tool cards" subtitle="Runs, summaries e diffs visiveis" icon="construction">
        <div className="space-y-3">
          {toolRuns.length > 0 ? (
            toolRuns.slice(0, 8).map((run) => {
              const runId = asText(run?.runId || run?.id);
              const filesTouched = Array.isArray(run?.filesTouched) ? run.filesTouched : [];
              return (
                <div key={runId} className="rounded-lg border border-black/5 bg-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-text-main">
                      {asText(run?.toolName || run?.title || runId, runId)}
                    </strong>
                    <span className="text-xs uppercase tracking-[0.12em] text-text-muted">
                      {asText(run?.status, "unknown")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-muted">
                    {asText(run?.summary || run?.stdout || run?.kind, "Run sem resumo curto.")}
                  </p>
                  <p className="mt-2 text-xs text-text-muted">
                    {filesTouched.length > 0
                      ? `Arquivos tocados: ${filesTouched.slice(0, 3).join(", ")}`
                      : "Nenhum arquivo tocado registrado."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="difference"
                      onClick={() => {
                        void handleOpenDiff(runId);
                      }}
                    >
                      Abrir diff
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-text-muted">Ainda nao houve tool runs observaveis nesta sessao.</p>
          )}
        </div>
      </Card>

      <Card title="Diffs e artifacts" subtitle="Viewer rapido do plano canonico de artifacts" icon="difference">
        {diffPreview ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <strong className="block text-sm text-text-main">
                Diff de {diffPreview.toolRunId}
              </strong>
              <p className="mt-2 text-sm text-text-muted">{diffPreview.summary}</p>
            </div>
            <div className="rounded-lg border border-black/5 bg-slate-950 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-emerald-100">
                {diffPreview.consolidatedDiff || "Nenhum patch consolidado retornado."}
              </pre>
            </div>
          </div>
        ) : artifacts.length > 0 ? (
          <div className="space-y-3">
            {artifacts.slice(0, 8).map((artifact, index) => (
              <div key={`${asText(artifact?.id || artifact?.path || artifact?.name, "artifact")}-${index}`} className="rounded-lg border border-black/5 bg-bg p-4">
                <strong className="block text-sm text-text-main">
                  {asText(artifact?.name || artifact?.path || artifact?.id, "Artifact")}
                </strong>
                <p className="mt-2 text-sm text-text-muted">
                  {asText(artifact?.summary || artifact?.kind || artifact?.path, "Artifact sem resumo curto.")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            Abra um diff num tool card para ver patches, ou aguarde artifacts aparecerem nesta sessao.
          </p>
        )}
      </Card>

      <Card title="Receipts" subtitle="Readable evidence from governed actions" icon="receipt_long">
        <div className="space-y-3">
          {receiptCards.length > 0 ? (
            receiptCards.slice(0, 4).map((receipt, index) => {
              const receiptId = asText(receipt?.receiptId || receipt?.id || receipt?.operation, `receipt-${index + 1}`);
              const status = asText(receipt?.status || receipt?.tone || receipt?.risk, "recorded");
              const summary = asText(
                receipt?.simpleText
                  || receipt?.summary
                  || receipt?.operatorSummary
                  || receipt?.title,
                "Governed action evidence recorded.",
              );
              const rollback = asText(
                receipt?.rollbackLabel
                  || receipt?.rollback
                  || receipt?.rollbackAvailable,
                "not required",
              );
              return (
                <div key={`${receiptId}-${index}`} className="rounded-lg border border-black/5 bg-bg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm text-text-main">{receiptId}</strong>
                    <span className="rounded-full border border-black/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-text-muted">{summary}</p>
                  <p className="mt-2 text-xs text-text-muted">Rollback: {rollback}</p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-text-muted">
              Receipts will appear after approvals, governed actions, rollbacks or completed missions publish evidence.
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Provider Cockpit" subtitle="Readiness and tests from Runtime API v1" icon="hub">
          <div className="space-y-3">
            {providerRows.length > 0 ? (
              providerRows.slice(0, 6).map((provider) => {
                const providerId = asText(provider?.id || provider?.providerId || provider?.name);
                const label = asText(provider?.label || provider?.name || providerId, providerId);
                const readiness = asText(provider?.readiness || provider?.status || provider?.state, "needs_probe");
                const reason = asText(provider?.reason || provider?.summary || provider?.detail, "Readiness is reported by the provider mesh.");
                return (
                  <div key={providerId} className="rounded-lg border border-black/5 bg-bg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-sm text-text-main">{label}</strong>
                      <span className="rounded-full border border-black/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                        {readiness}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{reason}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="network_check"
                        loading={resolvingProviderId === providerId}
                        onClick={() => {
                          void handleProviderTest(providerId);
                        }}
                      >
                        Test preview
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-text-muted">No provider rows returned by Runtime API v1 yet.</p>
            )}
          </div>
        </Card>

        <Card title="Channel Cockpit" subtitle="Channel readiness and governed actions" icon="forum">
          <div className="space-y-3">
            {channelRows.length > 0 ? (
              channelRows.slice(0, 6).map((channel) => {
                const channelId = asText(channel?.id || channel?.channelId || channel?.name);
                const label = asText(channel?.label || channel?.name || channelId, channelId);
                const readiness = asText(channel?.readiness || channel?.status || channel?.state, "needs_setup");
                const actions = Array.isArray(channel?.actions) ? channel.actions : [];
                const firstAction = asText(actions[0] || "status");
                const pendingId = `${channelId}:${firstAction}`;
                return (
                  <div key={channelId} className="rounded-lg border border-black/5 bg-bg p-4">
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-sm text-text-main">{label}</strong>
                      <span className="rounded-full border border-black/10 px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                        {readiness}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">
                      {actions.length > 0
                        ? `Actions: ${actions.slice(0, 4).join(", ")}`
                        : "No channel actions advertised by Runtime API v1."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="info"
                        loading={resolvingChannelActionId === pendingId}
                        onClick={() => {
                          void handleChannelAction(channelId, firstAction);
                        }}
                      >
                        Run {firstAction}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-text-muted">No channel rows returned by Runtime API v1 yet.</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Capabilities" subtitle="Sob demanda, com approval quando preciso" icon="deployed_code">
          <div className="space-y-3">
            {capabilities.length > 0 ? (
              capabilities.slice(0, 8).map((capability) => (
                <div
                  key={asText(capability?.id || capability?.capabilityId || capability?.name, "capability")}
                  className="rounded-lg border border-black/5 bg-bg p-4"
                >
                  <strong className="block text-sm text-text-main">
                    {asText(capability?.label || capability?.name || capability?.id, "Capability")}
                  </strong>
                  <p className="mt-2 text-sm text-text-muted">
                    {asText(capability?.summary || capability?.state || capability?.status, "Capability sem resumo curto.")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-muted">Nenhuma capability retornada pelo plano atual.</p>
            )}
          </div>
        </Card>

        <Card title="Resources" subtitle="Top consumers e pressao do host" icon="memory">
          <div className="space-y-3">
            {topConsumers.length > 0 ? (
              topConsumers.slice(0, 6).map((consumer, index) => (
                <div key={`${asText(consumer?.label || consumer?.groupId, "consumer")}-${index}`} className="rounded-lg border border-black/5 bg-bg p-4">
                  <strong className="block text-sm text-text-main">
                    {asText(consumer?.label || consumer?.groupId, "Consumer")}
                  </strong>
                  <p className="mt-2 text-sm text-text-muted">
                    RAM {asText(consumer?.memoryMb ?? consumer?.memory?.mb, "n/d")} MB
                    {" · "}
                    CPU {asText(consumer?.cpuPercent ?? consumer?.cpu?.percent, "n/d")}%
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-muted">Sem top consumers relevantes no snapshot atual.</p>
            )}
          </div>
        </Card>

        <Card title="Companions" subtitle="WSL, Docker Desktop, ZavorthBridge, Codex" icon="lan">
          <div className="space-y-3">
            {companions.length > 0 ? (
              companions.slice(0, 8).map((companion) => (
                <div
                  key={asText(companion?.id || companion?.companionId || companion?.name, "companion")}
                  className="rounded-lg border border-black/5 bg-bg p-4"
                >
                  <strong className="block text-sm text-text-main">
                    {asText(companion?.label || companion?.name || companion?.id, "Companion")}
                  </strong>
                  <p className="mt-2 text-sm text-text-muted">
                    {asText(companion?.summary || companion?.status, "Companion sem resumo curto.")}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-muted">Nenhum companion monitorado no snapshot atual.</p>
            )}
          </div>
        </Card>

        <Card title="Health" subtitle="Warnings, heartbeat e recomendacoes" icon="health_and_safety">
          <div className="space-y-3">
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <strong className="block text-sm text-text-main">Heartbeat do gateway</strong>
              <p className="mt-2 text-sm text-text-muted">Estado do socket: {wsStatus}</p>
            </div>
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <strong className="block text-sm text-text-main">Runtime API v1</strong>
              <p className="mt-2 text-sm text-text-muted">
                {asText(runtimeApiV1?.contracts?.source?.authority, "runtime-api-v1")} · events {runtimeApiEvents.length}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                Actions are delegated through governed API endpoints; this panel has no direct execution authority.
              </p>
            </div>
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <strong className="block text-sm text-text-main">Warnings</strong>
              <p className="mt-2 text-sm text-text-muted">
                {runtimeWarnings.length > 0
                  ? runtimeWarnings.slice(0, 2).join(" | ")
                  : "Sem warnings operacionais relevantes agora."}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
