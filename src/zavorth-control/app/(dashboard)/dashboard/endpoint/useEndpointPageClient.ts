"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  CloudflaredTunnelPhase,
  CloudflaredTunnelStatus,
  EndpointModelsData,
  EndpointPageClientViewState,
  TranslationValues,
  TunnelNotice,
} from "./endpointPageClient.types";

const BUILD_TIME_CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL || null;
const CLOUD_ACTION_TIMEOUT_MS = 15000;

function categorizeModels(allModels: any[]): EndpointModelsData {
  const chat = allModels.filter((m) => !m.type && !m.parent);
  const embeddings = allModels.filter((m) => m.type === "embedding" && !m.parent);
  const images = allModels.filter((m) => m.type === "image" && !m.parent);
  const rerank = allModels.filter((m) => m.type === "rerank" && !m.parent);
  const audioTranscription = allModels.filter(
    (m) => m.type === "audio" && m.subtype === "transcription" && !m.parent
  );
  const audioSpeech = allModels.filter((m) => m.type === "audio" && m.subtype === "speech" && !m.parent);
  const moderation = allModels.filter((m) => m.type === "moderation" && !m.parent);
  const music = allModels.filter((m) => m.type === "music" && !m.parent);
  return { chat, embeddings, images, rerank, audioTranscription, audioSpeech, moderation, music };
}

export function useEndpointPageClient(machineId?: string): EndpointPageClientViewState {
  const [resolvedMachineId, setResolvedMachineId] = useState(machineId || "");
  const t = useTranslations("endpoint");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [allModels, setAllModels] = useState<any[]>([]);
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [viewTab, setViewTab] = useState("api");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [syncStep, setSyncStep] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [cloudBaseUrl, setCloudBaseUrl] = useState<string | null>(BUILD_TIME_CLOUD_URL);
  const [cloudConfigured, setCloudConfigured] = useState(Boolean(BUILD_TIME_CLOUD_URL));
  const [mcpStatus, setMcpStatus] = useState<any>(null);
  const [a2aStatus, setA2aStatus] = useState<any>(null);
  const [searchProviders, setSearchProviders] = useState<any[]>([]);
  const [cloudflaredStatus, setCloudflaredStatus] = useState<CloudflaredTunnelStatus | null>(null);
  const [cloudflaredBusy, setCloudflaredBusy] = useState(false);
  const [cloudflaredNotice, setCloudflaredNotice] = useState<TunnelNotice | null>(null);
  const [baseUrl, setBaseUrl] = useState("/v1");

  const { copied, copy } = useCopyToClipboard();

  const translateOrFallback = useCallback(
    (key: string, fallback: string, values?: TranslationValues) => {
      try {
        const message = values ? t(key as never, values as never) : t(key as never);
        if (!message || message === key || message === `endpoint.${key}`) {
          return fallback;
        }
        return message;
      } catch {
        return fallback;
      }
    },
    [t]
  );

  const fetchSearchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/search/providers");
      if (res.ok) {
        const data = await res.json();
        setSearchProviders(data.providers || []);
      }
    } catch {
      // Search endpoint may not be available.
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch("/v1/models");
      if (res.ok) {
        const data = await res.json();
        setAllModels(data.data || []);
      }
    } catch (error) {
      console.log("Error fetching models:", error);
    }
  }, []);

  const fetchProtocolStatus = useCallback(async () => {
    try {
      const [mcpRes, a2aRes] = await Promise.allSettled([fetch("/api/mcp/status"), fetch("/api/a2a/status")]);
      if (mcpRes.status === "fulfilled" && mcpRes.value.ok) {
        setMcpStatus(await mcpRes.value.json());
      }
      if (a2aRes.status === "fulfilled" && a2aRes.value.ok) {
        setA2aStatus(await a2aRes.value.json());
      }
    } catch {
      // Protocol cards have fallback text.
    }
  }, []);

  const loadCloudSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCloudEnabled(data.cloudEnabled || false);
        if (typeof data.cloudConfigured === "boolean") {
          setCloudConfigured(data.cloudConfigured);
        }
        if (data.cloudUrl) {
          setCloudBaseUrl(data.cloudUrl);
        }
        if (data.machineId) {
          setResolvedMachineId(data.machineId);
        }
      }
    } catch (error) {
      console.log("Error loading cloud settings:", error);
    }
  }, []);

  const fetchCloudflaredStatus = useCallback(
    async (silent = false) => {
      try {
        const res = await fetch("/api/tunnels/cloudflared", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            data?.error ||
              translateOrFallback("cloudflaredRequestFailed", "Failed to load Cloudflare tunnel status")
          );
        }

        setCloudflaredStatus(data);
        return data as CloudflaredTunnelStatus;
      } catch (error) {
        if (!silent) {
          setCloudflaredNotice({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : translateOrFallback(
                    "cloudflaredRequestFailed",
                    "Failed to load Cloudflare tunnel status"
                  ),
          });
        }
        return null;
      }
    },
    [translateOrFallback]
  );

  useEffect(() => {
    Promise.allSettled([
      loadCloudSettings(),
      fetchModels(),
      fetchProtocolStatus(),
      fetchSearchProviders(),
      fetchCloudflaredStatus(true),
    ]).finally(() => {
      setLoading(false);
    });
  }, [fetchCloudflaredStatus, fetchModels, fetchProtocolStatus, fetchSearchProviders, loadCloudSettings]);

  useEffect(() => {
    if (cloudStatus) {
      const timer = setTimeout(() => setCloudStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [cloudStatus]);

  useEffect(() => {
    if (cloudflaredNotice) {
      const timer = setTimeout(() => setCloudflaredNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [cloudflaredNotice]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchProtocolStatus();
      void fetchCloudflaredStatus(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCloudflaredStatus, fetchProtocolStatus]);

  const postCloudAction = useCallback(
    async (action: string, timeoutMs = CLOUD_ACTION_TIMEOUT_MS) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch("/api/sync/cloud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return { ok: false, status: 408, data: { error: t("cloudRequestTimeout") } };
        }
        return { ok: false, status: 500, data: { error: error.message || t("cloudRequestFailed") } };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [t]
  );

  const dispatchCloudChange = useCallback(() => {
    globalThis.dispatchEvent(new Event("cloud-status-changed"));
  }, []);

  const handleCloudToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        if (!cloudConfigured) {
          setCloudStatus({
            type: "warning",
            message: "Cloud sync is not configured on this instance.",
          });
          return;
        }
        setShowCloudModal(true);
      } else {
        setShowDisableModal(true);
      }
    },
    [cloudConfigured]
  );

  const handleEnableCloud = useCallback(async () => {
    setCloudSyncing(true);
    setModalSuccess(false);
    setSyncStep("syncing");
    try {
      const { ok, status, data } = await postCloudAction("enable");
      if (ok) {
        setSyncStep("verifying");
        await new Promise((r) => setTimeout(r, 600));
        setCloudEnabled(true);
        setSyncStep("done");
        setModalSuccess(true);
        setCloudSyncing(false);
        dispatchCloudChange();
        await new Promise((r) => setTimeout(r, 1200));
        setShowCloudModal(false);
        setModalSuccess(false);
        if (data.verified) {
          setCloudStatus({ type: "success", message: t("cloudConnectedVerified") });
        } else {
          setCloudStatus({
            type: "warning",
            message: data.verifyError
              ? t("connectedVerificationPendingWithError", { error: data.verifyError })
              : t("connectedVerificationPending"),
          });
        }
        if (data.cloudUrl) {
          setCloudBaseUrl(data.cloudUrl);
        }
        await loadCloudSettings();
      } else {
        let errorMessage = data.error || t("failedEnable");
        if (status === 502 || status === 408) {
          errorMessage = t("cloudWorkerUnreachable");
        }
        setCloudStatus({ type: "error", message: errorMessage });
        setShowCloudModal(false);
      }
    } catch (error: any) {
      setCloudStatus({ type: "error", message: error.message || t("connectionFailed") });
      setShowCloudModal(false);
    } finally {
      setCloudSyncing(false);
      setSyncStep("");
    }
  }, [dispatchCloudChange, loadCloudSettings, postCloudAction, t]);

  const handleConfirmDisable = useCallback(async () => {
    setCloudSyncing(true);
    setSyncStep("syncing");
    try {
      await postCloudAction("sync");
      setSyncStep("disabling");
      const { ok, data } = await postCloudAction("disable");
      if (ok) {
        setCloudEnabled(false);
        setCloudStatus({ type: "success", message: t("cloudDisabledSuccess") });
        setShowDisableModal(false);
        dispatchCloudChange();
        await loadCloudSettings();
      } else {
        setCloudStatus({ type: "error", message: data.error || t("failedDisable") });
      }
    } catch (error) {
      console.log("Error disabling cloud:", error);
      setCloudStatus({ type: "error", message: t("failedDisable") });
    } finally {
      setCloudSyncing(false);
      setSyncStep("");
    }
  }, [dispatchCloudChange, loadCloudSettings, postCloudAction, t]);

  const handleCloudflaredAction = useCallback(
    async (action: "enable" | "disable") => {
      setCloudflaredBusy(true);
      setCloudflaredNotice(null);
      try {
        const res = await fetch("/api/tunnels/cloudflared", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.error ||
              translateOrFallback("cloudflaredRequestFailed", "Failed to update Cloudflare tunnel")
          );
        }

        if (data?.status) {
          setCloudflaredStatus(data.status);
        }

        setCloudflaredNotice({
          type: "success",
          message:
            action === "enable"
              ? translateOrFallback("cloudflaredStarted", "Cloudflare tunnel started")
              : translateOrFallback("cloudflaredStopped", "Cloudflare tunnel stopped"),
        });
      } catch (error) {
        setCloudflaredNotice({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : translateOrFallback("cloudflaredRequestFailed", "Failed to update Cloudflare tunnel"),
        });
      } finally {
        setCloudflaredBusy(false);
        await fetchCloudflaredStatus(true);
      }
    },
    [fetchCloudflaredStatus, translateOrFallback]
  );

  const endpointData = useMemo(() => categorizeModels(allModels), [allModels]);
  const normalizedCloudBaseUrl = cloudBaseUrl
    ? resolvedMachineId && !cloudBaseUrl.endsWith(`/${resolvedMachineId}`)
      ? `${cloudBaseUrl}/${resolvedMachineId}`
      : cloudBaseUrl
    : null;
  const cloudEndpointCurrent = normalizedCloudBaseUrl ? `${normalizedCloudBaseUrl}/v1` : baseUrl;
  const currentEndpoint = cloudEnabled && cloudEndpointCurrent ? cloudEndpointCurrent : baseUrl;
  const mcpOnline = Boolean(mcpStatus?.online);
  const a2aOnline = a2aStatus?.status === "ok";
  const mcpToolCount = Number(mcpStatus?.heartbeat?.toolCount || 0);
  const a2aActiveStreams = Number(a2aStatus?.tasks?.activeStreams || 0);
  const cloudflaredPhase = cloudflaredStatus?.phase || "not_installed";
  const cloudflaredPhaseMeta: Record<CloudflaredTunnelPhase, { label: string; className: string }> =
    {
      running: {
        label: translateOrFallback("cloudflaredRunning", "Running"),
        className: "bg-green-500/10 border-green-500/30 text-green-400",
      },
      starting: {
        label: translateOrFallback("cloudflaredStarting", "Starting"),
        className: "bg-blue-500/10 border-blue-500/30 text-blue-400",
      },
      stopped: {
        label: translateOrFallback("cloudflaredStoppedState", "Stopped"),
        className: "bg-surface border-border/70 text-text-muted",
      },
      not_installed: {
        label: translateOrFallback("cloudflaredNotInstalled", "Not installed"),
        className: "bg-surface border-border/70 text-text-muted",
      },
      unsupported: {
        label: translateOrFallback("cloudflaredUnsupported", "Unsupported"),
        className: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      },
      error: {
        label: translateOrFallback("cloudflaredError", "Error"),
        className: "bg-red-500/10 border-red-500/30 text-red-400",
      },
    };
  const cloudflaredActionLabel = cloudflaredStatus?.running
    ? translateOrFallback("cloudflaredDisable", "Stop Tunnel")
    : cloudflaredStatus?.installed
      ? translateOrFallback("cloudflaredEnable", "Enable Tunnel")
      : translateOrFallback("cloudflaredInstallAndEnable", "Install & Enable");
  const cloudflaredUrlNotice = translateOrFallback(
    "cloudflaredUrlNotice",
    "Creates a temporary Cloudflare Quick Tunnel. The URL changes after every restart."
  );

  return {
    t,
    tc,
    translateOrFallback,
    copied,
    copy,
    loading,
    resolvedMachineId,
    allModels,
    endpointData,
    expandedEndpoint,
    setExpandedEndpoint,
    cloudEnabled,
    cloudStatus,
    cloudSyncing,
    cloudConfigured,
    cloudBaseUrl,
    cloudEndpointCurrent,
    showCloudModal,
    setShowCloudModal,
    showDisableModal,
    setShowDisableModal,
    viewTab,
    setViewTab,
    syncStep,
    modalSuccess,
    selectedProvider,
    setSelectedProvider,
    mcpStatus,
    a2aStatus,
    searchProviders,
    cloudflaredStatus,
    cloudflaredBusy,
    cloudflaredNotice,
    setCloudflaredNotice,
    setCloudStatus,
    cloudflaredPhaseMeta,
    cloudflaredActionLabel,
    cloudflaredUrlNotice,
    mcpOnline,
    a2aOnline,
    mcpToolCount,
    a2aActiveStreams,
    baseUrl,
    currentEndpoint,
    handleCloudToggle,
    handleEnableCloud,
    handleConfirmDisable,
    handleCloudflaredAction,
  };
}
