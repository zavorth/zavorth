"use client";

import { Button, Card } from "@/shared/components";
import type { ControlPageClientModel } from "./controlPageClient.types";
import { asArray, asText, formatScope } from "./controlPageClient.utils";

type ControlPageClientHeaderProps = {
  model: ControlPageClientModel;
};

export function ControlPageClientHeader({ model }: ControlPageClientHeaderProps) {
  const {
    state,
    productModeLabel,
    productModeId,
    effectiveSessionId,
    sessionEntries,
    runtimeStatus,
    wsStatus,
    loading,
    diffPreview,
    error,
    runtimeWarnings,
    uiSurfaceHints,
    recommendedJourneys,
    visibleSurfaces,
    escalationRequest,
    resolvingModeEscalation,
    loadControlState,
    setDiffPreview,
    handleModeEscalation,
  } = model;

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card title="Control UI" subtitle="Surface principal do Zavorth" icon="hub">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Modo</p>
              <strong className="mt-2 block text-lg text-text-main">{productModeLabel}</strong>
              <p className="mt-2 text-sm text-text-muted">Base: {productModeId}</p>
            </div>
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Sessao ativa</p>
              <strong className="mt-2 block text-lg text-text-main">
                {effectiveSessionId || "resolvendo"}
              </strong>
              <p className="mt-2 text-sm text-text-muted">{sessionEntries.length} sessoes visiveis</p>
            </div>
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Gateway</p>
              <strong className="mt-2 block text-lg text-text-main">{runtimeStatus}</strong>
              <p className="mt-2 text-sm text-text-muted">WS {wsStatus}</p>
            </div>
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Pressao do host</p>
              <strong className="mt-2 block text-lg text-text-main">
                {asText(state?.resourcePlane?.status, "unknown")}
              </strong>
              <p className="mt-2 text-sm text-text-muted">
                {asText(state?.resourcePlane?.host?.summary, "Desktop Resource Plane ativo.")}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon="refresh"
              onClick={() => {
                void loadControlState(effectiveSessionId || null);
              }}
              loading={loading}
            >
              Atualizar estado
            </Button>
            <Button
              variant="secondary"
              icon="difference"
              onClick={() => setDiffPreview(null)}
              disabled={!diffPreview}
            >
              Limpar diff
            </Button>
          </div>
          {error ? (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}
        </Card>

        <Card title="Warnings e proximos passos" subtitle="Leitura canonica do gateway" icon="warning">
          {runtimeWarnings.length > 0 ? (
            <ul className="space-y-2 text-sm text-text-muted">
              {runtimeWarnings.slice(0, 6).map((warning) => (
                <li key={warning} className="rounded-lg border border-black/5 bg-bg px-3 py-2">
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              Sem warnings relevantes neste momento. A Control UI ja esta lendo sessoes, approvals e runtime no mesmo plano.
            </p>
          )}
        </Card>
      </div>

      {uiSurfaceHints ? (
        <Card
          title="Entradas recomendadas"
          subtitle="Web first, com Telegram como primeiro canal externo"
          icon="forum"
        >
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Jornada recomendada</p>
              <strong className="mt-2 block text-lg text-text-main">
                {asText(uiSurfaceHints.recommendedJourney, "web-only")}
              </strong>
              <p className="mt-2 text-sm text-text-muted">
                Entrada principal: {asText(uiSurfaceHints.primarySurface, "control")}. Canal externo recomendado:{" "}
                {asText(uiSurfaceHints.recommendedExternalChannel, "nenhum agora")}.
              </p>
              <div className="mt-3 space-y-2 text-sm text-text-muted">
                {recommendedJourneys.length > 0 ? (
                  recommendedJourneys.map((journey) => (
                    <div key={asText(journey.id, "journey")} className="rounded-lg border border-black/5 px-3 py-2">
                      <strong className="block text-text-main">{asText(journey.label, asText(journey.id, "Journey"))}</strong>
                      <p className="mt-1">{asText(journey.description, "Sem descricao.")}</p>
                    </div>
                  ))
                ) : (
                  <p>Comece pelo /control e adicione Telegram so quando fizer sentido.</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-black/5 bg-bg p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Superficies visiveis</p>
                <ul className="mt-3 space-y-2 text-sm text-text-muted">
                  {visibleSurfaces.map((surface) => (
                    <li key={asText(surface.id, "surface")}>
                      <strong className="text-text-main">{asText(surface.label, asText(surface.id, "Surface"))}</strong>
                      {" · "}
                      {asText(surface.entry, "-")}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-black/5 bg-bg p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Canais secundarios</p>
                <p className="mt-2 text-sm text-text-muted">
                  {asArray<string>(uiSurfaceHints.hiddenSecondaryChannels).length > 0
                    ? `${asArray<string>(uiSurfaceHints.hiddenSecondaryChannels).join(", ")} ficam ocultos por padrao neste modo.`
                    : "Nenhum canal secundario esta oculto neste modo."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {escalationRequest ? (
        <Card
          title="Elevacao de modo pendente"
          subtitle={`O pedido atual quer subir de ${asText(escalationRequest.effectiveMode?.id, productModeId)} para ${asText(escalationRequest.requiredMode?.id, "builder")}.`}
          icon="bolt"
        >
          <p className="text-sm text-text-muted">{asText(escalationRequest.summary, "O Zavorth precisa de mais poder para cumprir esta tarefa.")}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Necessidades</p>
              <ul className="mt-3 space-y-2 text-sm text-text-muted">
                {asArray<string>(escalationRequest.reasons).slice(0, 4).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-black/5 bg-bg p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-text-muted">Fallback leve</p>
              <p className="mt-3 text-sm text-text-muted">
                {asText(escalationRequest.fallback, "Sem fallback leve registrado.")}
              </p>
              <p className="mt-3 text-sm text-text-muted">
                Escopo sugerido: {formatScope(escalationRequest.recommendedScope)}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              icon="check"
              loading={resolvingModeEscalation}
              onClick={() => {
                void handleModeEscalation("approve", "once");
              }}
            >
              Aprovar uma vez
            </Button>
            <Button
              variant="secondary"
              icon="check_circle"
              loading={resolvingModeEscalation}
              onClick={() => {
                void handleModeEscalation("approve", "session");
              }}
            >
              Aprovar nesta sessao
            </Button>
            <Button
              variant="secondary"
              icon="lan"
              loading={resolvingModeEscalation}
              onClick={() => {
                void handleModeEscalation("approve", "host");
              }}
            >
              Aprovar neste host
            </Button>
            <Button
              variant="ghost"
              icon="close"
              loading={resolvingModeEscalation}
              onClick={() => {
                void handleModeEscalation("reject");
              }}
            >
              Rejeitar
            </Button>
          </div>
        </Card>
      ) : null}
    </>
  );
}
