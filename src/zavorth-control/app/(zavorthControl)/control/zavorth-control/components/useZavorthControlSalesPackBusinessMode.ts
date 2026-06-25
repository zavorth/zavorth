"use client";

import { useEffect, useMemo, useState } from "react";

const BUSINESS_MODE_STORAGE_KEY = "zavorth.zavorthControl.businessMode.enabled";

export type ZavorthControlSalesPackBusinessIdentity = {
  userId?: string | null;
  profileId?: string | null;
};

export type ZavorthControlSalesPackSnapshot = {
  generatedAt: string;
  summary: {
    posture: "healthy" | "attention" | "critical";
    mode: string;
    conversations: number;
    leads: number;
    pendingApprovals: number;
    deliveryReceipts: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  actions: Array<{
    id: string;
    label: string;
    severity: "info" | "warn" | "critical";
    reason: string;
    command: string | null;
  }>;
  sourceSnapshots: {
    inbox: Array<{
      id: string;
      customerId: string;
      status: string;
      lastIntent: string;
      lastMessageAt: string;
      summary: string;
    }>;
    crm: Array<{
      customerId: string;
      intent: string;
      stage: string;
      nextAction: string;
      risk: string;
      handoffRequired: boolean;
    }>;
    channelHealth: {
      platform: string;
      mode: string;
      configured: boolean;
    };
    ledger: {
      totalEvents: number;
    };
  };
};

export type ZavorthControlSalesPackBusinessController = {
  enabled: boolean;
  effectiveEnabled: boolean;
  activationReason: "manual" | "activity" | "disabled";
  snapshot: ZavorthControlSalesPackSnapshot | null;
  loading: boolean;
  busyActionId: string | null;
  message: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  refresh: () => Promise<void>;
  seedDemo: () => Promise<void>;
};

export function useZavorthControlSalesPackBusinessMode(
  identity: ZavorthControlSalesPackBusinessIdentity = {},
): ZavorthControlSalesPackBusinessController {
  const resolvedIdentity = useMemo(() => ({
    userId: asText(identity.userId) || null,
    profileId: asText(identity.profileId) || null,
  }), [identity.userId, identity.profileId]);
  const storageKey = useMemo(
    () => buildBusinessModeStorageKey(resolvedIdentity),
    [resolvedIdentity],
  );
  const [enabled, setEnabled] = useState(false);
  const [snapshot, setSnapshot] = useState<ZavorthControlSalesPackSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasActivity = Boolean(
    snapshot
      && (
        snapshot.summary.conversations > 0
        || snapshot.summary.pendingApprovals > 0
        || snapshot.sourceSnapshots.inbox.length > 0
      ),
  );
  const effectiveEnabled = enabled || hasActivity;
  const activationReason = enabled ? "manual" : hasActivity ? "activity" : "disabled";

  const refresh = async () => {
    setLoading(true);
    try {
      const next = await fetchSalesPackSnapshot();
      setSnapshot(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel carregar o Modo Business.");
    } finally {
      setLoading(false);
    }
  };

  const enable = async () => {
    setLoading(true);
    try {
      const preference = await updateBusinessModePreference(true, resolvedIdentity);
      setEnabled(preference.enabled);
      persistBusinessMode(storageKey, preference.enabled);
      setMessage("Modo Business ativado para este perfil.");
      await refresh();
    } catch (error) {
      persistBusinessMode(storageKey, true);
      setEnabled(true);
      setMessage(error instanceof Error
        ? `${error.message} Usando fallback local neste navegador.`
        : "Nao foi possivel persistir no backend; usando fallback local.");
      await refresh();
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      const preference = await updateBusinessModePreference(false, resolvedIdentity);
      setEnabled(preference.enabled);
      persistBusinessMode(storageKey, preference.enabled);
      setMessage("Modo Business oculto para este perfil. Atendimentos ativos ainda podem reaparecer como alerta.");
    } catch (error) {
      persistBusinessMode(storageKey, false);
      setEnabled(false);
      setMessage(error instanceof Error
        ? `${error.message} Fallback local desativado neste navegador.`
        : "Nao foi possivel persistir no backend; fallback local desativado.");
    } finally {
      setLoading(false);
    }
  };

  const seedDemo = async () => {
    setBusyActionId("sales-pack-demo");
    setMessage(null);
    try {
      const response = await fetch("/api/v2/sales-pack/demo", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          ...buildZavorthControlRuntimeAuthHeaders(),
          ...buildBusinessModeIdentityHeaders(resolvedIdentity),
        },
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Nao foi possivel criar o exemplo local."));
      }
      const record = asRecord(payload);
      const nextSnapshot = asRecord(record?.snapshot);
      if (nextSnapshot) {
        setSnapshot(nextSnapshot as ZavorthControlSalesPackSnapshot);
      } else {
        await refresh();
      }
      const preference = await updateBusinessModePreference(true, resolvedIdentity);
      persistBusinessMode(storageKey, preference.enabled);
      setEnabled(preference.enabled);
      setMessage("Exemplo local criado sem envio externo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar exemplo local.");
    } finally {
      setBusyActionId(null);
    }
  };

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const preference = await fetchBusinessModePreference(resolvedIdentity);
        setEnabled(preference.enabled);
        persistBusinessMode(storageKey, preference.enabled);
      } catch {
        setEnabled(readPersistedBusinessMode(storageKey));
      }
    };
    void loadPreference();
    void refresh();
  }, [resolvedIdentity, storageKey]);

  return useMemo(() => ({
    enabled,
    effectiveEnabled,
    activationReason,
    snapshot,
    loading,
    busyActionId,
    message,
    enable,
    disable,
    refresh,
    seedDemo,
  }), [enabled, effectiveEnabled, activationReason, snapshot, loading, busyActionId, message, resolvedIdentity, storageKey]);
}

async function fetchSalesPackSnapshot(): Promise<ZavorthControlSalesPackSnapshot> {
  const response = await fetch("/api/v2/sales-pack/snapshot", {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...buildZavorthControlRuntimeAuthHeaders(),
    },
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Modo Business indisponivel agora."));
  }
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  if (!data) {
    throw new Error("Snapshot do Modo Business veio em formato invalido.");
  }
  return data as ZavorthControlSalesPackSnapshot;
}

async function fetchBusinessModePreference(
  identity: Required<ZavorthControlSalesPackBusinessIdentity>,
): Promise<{ enabled: boolean }> {
  const response = await fetch(buildBusinessModePreferenceUrl(identity), {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...buildZavorthControlRuntimeAuthHeaders(),
      ...buildBusinessModeIdentityHeaders(identity),
    },
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Preferencia do Modo Business indisponivel."));
  }
  return readBusinessModePreference(payload);
}

async function updateBusinessModePreference(
  enabled: boolean,
  identity: Required<ZavorthControlSalesPackBusinessIdentity>,
): Promise<{ enabled: boolean }> {
  const response = await fetch("/api/v2/sales-pack/business-mode", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...buildZavorthControlRuntimeAuthHeaders(),
      ...buildBusinessModeIdentityHeaders(identity),
    },
    body: JSON.stringify({
      userId: identity.userId,
      profileId: identity.profileId,
      enabled,
      updatedBy: "zavorth-control",
    }),
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, "Nao foi possivel salvar o Modo Business."));
  }
  return readBusinessModePreference(payload);
}

function buildBusinessModePreferenceUrl(identity: Required<ZavorthControlSalesPackBusinessIdentity>): string {
  const query = new URLSearchParams();
  if (identity.userId) {
    query.set("userId", identity.userId);
  }
  if (identity.profileId) {
    query.set("profileId", identity.profileId);
  }
  const serialized = query.toString();
  return `/api/v2/sales-pack/business-mode${serialized ? `?${serialized}` : ""}`;
}

function buildBusinessModeIdentityHeaders(
  identity: Required<ZavorthControlSalesPackBusinessIdentity>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (identity.userId) {
    headers["X-Zavorth-User-Id"] = identity.userId;
  }
  if (identity.profileId) {
    headers["X-Zavorth-Profile-Id"] = identity.profileId;
  }
  return headers;
}

function buildZavorthControlRuntimeAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }
  const token = readBrowserToken([
    "zavorth.runtime.webApiToken",
    "zavorth.webApiToken",
    "zavorth.managementToken",
  ]);
  return token ? { Authorization: `Bearer ${token}`, "X-Zavorth-Web-Api-Token": token } : {};
}

function readBrowserToken(keys: string[]): string {
  for (const key of keys) {
    const value = asText(window.sessionStorage.getItem(key) || window.localStorage.getItem(key));
    if (value) {
      return value;
    }
  }
  return "";
}

function readBusinessModePreference(payload: unknown): { enabled: boolean } {
  const record = asRecord(payload);
  const data = asRecord(record?.data);
  return {
    enabled: data?.enabled === true,
  };
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload);
  const error = typeof record?.error === "string" ? record.error.trim() : "";
  return sanitizeUserFacingError(error) || fallback;
}

function sanitizeUserFacingError(message: string): string {
  const firstLine = message.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
  if (!firstLine || firstLine.length > 180) {
    return "";
  }
  if (/\bat\s+\S+\s*\(|node_modules|[A-Za-z]:\\|\/(?:src|app|var|tmp|home)\//i.test(message)) {
    return "";
  }
  if (/\b(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{12,}|Bearer\s+[A-Za-z0-9._~+/-]+=*)\b/i.test(message)) {
    return "";
  }
  return firstLine;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readPersistedBusinessMode(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(storageKey) === "true";
}

function persistBusinessMode(storageKey: string, value: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, value ? "true" : "false");
}

function buildBusinessModeStorageKey(identity: Required<ZavorthControlSalesPackBusinessIdentity>): string {
  return [
    BUSINESS_MODE_STORAGE_KEY,
    slugIdentity(identity.userId || "local-owner"),
    slugIdentity(identity.profileId || "default"),
  ].join(":");
}

function slugIdentity(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "default";
}
