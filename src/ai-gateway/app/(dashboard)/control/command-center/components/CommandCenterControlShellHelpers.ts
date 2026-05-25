import type {
  DashboardCommandCenterViewModel,
  DashboardRunObservatoryQuery,
} from "../contracts";
import { asText } from "../../controlPageClient.utils";
import {
  commandCenterRunObservatoryHasQuery,
  filterCommandCenterRunObservatory,
  normalizeCommandCenterRunObservatoryQuery,
} from "./CommandCenterObservability";

export function asRecordArray(value: unknown): Array<Record<string, any>> {
  return Array.isArray(value) ? value : [];
}

export function formatRuntimeDetail(entry: Record<string, any>): string {
  const memory = asText(entry?.memoryMb ?? entry?.memory?.mb);
  const cpu = asText(entry?.cpuPercent ?? entry?.cpu?.percent);
  const status = asText(entry?.status ?? entry?.state ?? entry?.summary);
  const parts = [
    status,
    memory ? `RAM ${memory} MB` : "",
    cpu ? `CPU ${cpu}%` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Sem detalhe curto retornado.";
}

export function runtimeTone(status: DashboardCommandCenterViewModel["runtime"]["status"]): "info" | "ok" | "warn" | "danger" {
  if (status === "ready") {
    return "ok";
  }
  if (status === "degraded") {
    return "warn";
  }
  if (status === "blocked" || status === "offline") {
    return "danger";
  }
  return "info";
}

export function humanRuntimeStatus(status: DashboardCommandCenterViewModel["runtime"]["status"]): string {
  if (status === "ready") {
    return "pronto";
  }
  if (status === "degraded") {
    return "atenção";
  }
  if (status === "blocked") {
    return "bloqueado";
  }
  if (status === "offline") {
    return "offline";
  }
  return status;
}

export function humanAgentStatus(status: NonNullable<DashboardCommandCenterViewModel["agentRun"]>["status"]): string {
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

export function applyCommandCenterRunObservatoryQuery(
  viewModel: DashboardCommandCenterViewModel,
  query: DashboardRunObservatoryQuery,
): DashboardCommandCenterViewModel {
  return {
    ...viewModel,
    runObservatory: filterCommandCenterRunObservatory(viewModel.runObservatory, query),
  };
}

export function readCommandCenterRunObservatoryUrlQuery(
  searchParams: { get(name: string): string | null },
): DashboardRunObservatoryQuery {
  const runId = asText(searchParams.get("runId"));
  const traceId = asText(searchParams.get("traceId"));
  const status = asText(searchParams.get("status") || searchParams.get("runStatus"));
  const limit = Number(searchParams.get("limit"));
  const directQuery = Boolean(runId || traceId || normalizeCommandCenterRunObservatoryQuery({ status }).status);
  const sessionId = directQuery ? "" : asText(searchParams.get("sessionId"));

  return normalizeCommandCenterRunObservatoryQuery({
    runId,
    traceId,
    sessionId,
    status,
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : null,
  });
}

export function clearCommandCenterRunObservatorySearchParams(searchParams: URLSearchParams): void {
  for (const key of ["runId", "traceId", "status", "runStatus", "limit"]) {
    searchParams.delete(key);
  }
}
