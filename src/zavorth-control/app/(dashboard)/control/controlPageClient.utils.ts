"use client";

import type {
  ControlStateResponse,
  GatewayRuntimeResponse,
} from "./controlPageClient.types";

export function asArray<T = Record<string, any>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asText(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function formatTimestamp(value: unknown): string {
  const raw = asText(value);
  if (!raw) {
    return "agora";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatScope(value: unknown): string {
  const scope = asText(value).toLowerCase();
  if (scope === "host") {
    return "neste host";
  }
  if (scope === "session") {
    return "nesta sessao";
  }
  return "uma vez";
}

export function getSessionEntries(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(
    state?.sessions?.sessions
      ?? state?.sessions?.entries
      ?? state?.gatewaySessionTools?.sessions?.sessions
      ?? state?.gatewaySessionTools?.sessions?.entries,
  );
}

export function getTranscriptEntries(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.snapshot?.messages);
}

export function getTaskEntries(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.snapshot?.tasks);
}

export function getToolRuns(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.snapshot?.toolRuns ?? state?.artifactPlane?.toolRuns);
}

export function getArtifacts(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.artifactPlane?.artifacts);
}

export function getApprovals(state: ControlStateResponse | null): Record<string, any>[] {
  return uniqueById([
    ...asArray(state?.runtimeApiV1?.contracts?.approvals?.data),
    ...asArray(state?.agentRuntime?.contractsV1?.approvals?.data),
    ...asArray(state?.agentRuntime?.approvalsV1?.data),
    ...asArray(state?.approvalPlane?.pending ?? state?.approvalPlane?.recent),
  ]);
}

export function getReceiptCards(state: ControlStateResponse | null): Record<string, any>[] {
  return uniqueById([
    ...asArray(state?.runtimeApiV1?.contracts?.receipts?.cards),
    ...asArray(state?.agentRuntime?.contractsV1?.receipts?.cards),
    ...asArray(state?.agentRuntime?.receiptsV1?.cards),
    ...asArray(state?.agentRuntime?.visualReceipts?.cards),
  ]);
}

export function getProviderRows(state: ControlStateResponse | null): Record<string, any>[] {
  return uniqueById([
    ...asArray(state?.runtimeApiV1?.contracts?.providers?.providers),
    ...asArray(state?.agentRuntime?.contractsV1?.providers?.providers),
    ...asArray(state?.agentRuntime?.providersV1?.providers),
    ...asArray(state?.agentRuntime?.providerCockpit?.providers),
    ...asArray(state?.agentRuntime?.providerCockpit?.cards),
  ]);
}

export function getChannelRows(state: ControlStateResponse | null): Record<string, any>[] {
  return uniqueById([
    ...asArray(state?.runtimeApiV1?.contracts?.channels?.channels),
    ...asArray(state?.runtimeApiV1?.contracts?.channels?.entries),
    ...asArray(state?.agentRuntime?.contractsV1?.channels?.channels),
    ...asArray(state?.agentRuntime?.contractsV1?.channels?.entries),
    ...asArray(state?.agentRuntime?.channelsV1?.channels),
    ...asArray(state?.agentRuntime?.channelsV1?.entries),
  ]);
}

export function getMissionRows(state: ControlStateResponse | null): Record<string, any>[] {
  return uniqueById([
    ...asArray(state?.runtimeApiV1?.contracts?.missions?.data),
    ...asArray(state?.runtimeApiV1?.contracts?.missions?.missions),
    ...asArray(state?.runtimeApiV1?.chat?.mission ? [state.runtimeApiV1.chat.mission] : []),
    ...asArray(state?.agentRuntime?.contractsV1?.missions?.data),
    ...asArray(state?.agentRuntime?.contractsV1?.missions?.missions),
    ...asArray(state?.agentRuntime?.missionsV1?.data),
    ...asArray(state?.agentRuntime?.activeMissionUx?.mission ? [state.agentRuntime.activeMissionUx.mission] : []),
    ...getTaskEntries(state),
  ]);
}

export function getCapabilities(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.capabilityPlane?.capabilities);
}

export function getCompanions(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.companionPlane?.companions);
}

export function getTopConsumers(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.resourcePlane?.topConsumers);
}

export function getUiSurfaceHints(state: ControlStateResponse | null): Record<string, any> | null {
  return state?.uiSurfaceHints && typeof state.uiSurfaceHints === "object"
    ? state.uiSurfaceHints
    : null;
}

export function getMemoryRecallSources(state: ControlStateResponse | null): Record<string, any>[] {
  return asArray(state?.memoryRecall?.sources);
}

export function getSessionIdFromState(state: ControlStateResponse | null): string | null {
  return asText(state?.snapshot?.sessionId || state?.session?.sessionId || null) || null;
}

export function getMessageBody(entry: Record<string, any>): string {
  return asText(
    entry?.text
      ?? entry?.message
      ?? entry?.content
      ?? entry?.body
      ?? entry?.markdown
      ?? entry?.summary
      ?? "",
    "(mensagem vazia)",
  );
}

export function getProductModeId(state: ControlStateResponse | null): string {
  return asText(
    state?.productMode?.id
      ?? state?.productMode?.productMode?.id
      ?? state?.modeEscalation?.effectiveMode?.id,
    "chat",
  );
}

export function getProductModeLabel(state: ControlStateResponse | null): string {
  return asText(
    state?.productMode?.label
      ?? state?.productMode?.productMode?.label
      ?? getProductModeId(state),
    "chat",
  );
}

export function buildGatewayWsUrl(sessionId: string, ticket?: string | null): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = new URL(`${protocol}//${window.location.host}/api/web/gateway/ws`);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("replay", "state");
  if (ticket) {
    url.searchParams.set("ticket", ticket);
  }
  return url.toString();
}

export function readCommandCenterRuntimeAuthToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const urlToken = asText(
    url.searchParams.get("token")
      || url.searchParams.get("zavorthToken")
      || hashParams.get("token")
      || hashParams.get("zavorthToken"),
  );
  if (urlToken) {
    window.sessionStorage.setItem("zavorth.webAuthToken", urlToken);
    url.searchParams.delete("token");
    url.searchParams.delete("zavorthToken");
    hashParams.delete("token");
    hashParams.delete("zavorthToken");
    url.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return urlToken;
  }
  const keys = [
    "zavorth.webAuthToken",
    "zavorth.commandCenterToken",
    "ZAVORTH_WEB_AUTH_TOKEN",
  ];
  for (const key of keys) {
    const token = asText(window.sessionStorage.getItem(key));
    if (token) {
      return token;
    }
  }
  for (const key of keys) {
    const legacyToken = asText(window.localStorage.getItem(key));
    if (legacyToken) {
      window.sessionStorage.setItem("zavorth.webAuthToken", legacyToken);
      for (const legacyKey of keys) {
        window.localStorage.removeItem(legacyKey);
      }
      return legacyToken;
    }
  }
  return "";
}

export function buildCommandCenterRuntimeAuthHeaders(): Record<string, string> {
  const token = readCommandCenterRuntimeAuthToken();
  return token ? { "X-Zavorth-Token": token } : {};
}

function normalizeFetchHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers as Record<string, string>;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...buildCommandCenterRuntimeAuthHeaders(),
      ...normalizeFetchHeaders(init?.headers),
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(asText(payload?.error, "Falha ao carregar a Control UI."));
  }
  return payload as T;
}

export function buildTimelineItems(state: ControlStateResponse | null): Array<{
  kind: "message" | "task";
  id: string;
  title: string;
  body: string;
  timestamp: string;
}> {
  const transcriptEntries = getTranscriptEntries(state);
  const missionEntries = getMissionRows(state);

  return [
    ...transcriptEntries.map((entry) => ({
      kind: "message" as const,
      id: asText(entry?.id || entry?.messageId || entry?.timestamp || Math.random()),
      title: asText(entry?.role || entry?.source || entry?.sender || "mensagem"),
      body: getMessageBody(entry),
      timestamp: formatTimestamp(entry?.createdAt || entry?.timestamp || entry?.updatedAt),
    })),
    ...missionEntries.map((entry) => ({
      kind: "task" as const,
      id: asText(entry?.missionId || entry?.mission_id || entry?.taskId || entry?.id || entry?.createdAt || Math.random()),
      title: asText(entry?.title || entry?.intent || entry?.command || entry?.taskId || "mission"),
      body: asText(entry?.summary || entry?.status || entry?.state || "Mission registered by Runtime API v1."),
      timestamp: formatTimestamp(entry?.updatedAt || entry?.createdAt),
    })),
  ]
    .filter((entry) => entry.id)
    .slice(0, 16);
}

function uniqueById(entries: Record<string, any>[]): Record<string, any>[] {
  const seen = new Set<string>();
  const result: Record<string, any>[] = [];
  for (const entry of entries) {
    const key = asText(
      entry?.permission_id
        ?? entry?.permissionId
        ?? entry?.receiptId
        ?? entry?.mission_id
        ?? entry?.missionId
        ?? entry?.id
        ?? entry?.task_id
        ?? entry?.taskId,
    );
    const stableKey = key || JSON.stringify(entry).slice(0, 120);
    if (seen.has(stableKey)) {
      continue;
    }
    seen.add(stableKey);
    result.push(entry);
  }
  return result;
}
