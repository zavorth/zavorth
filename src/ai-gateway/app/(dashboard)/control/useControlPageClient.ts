"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ControlPageClientModel,
  ControlStateResponse,
  DeveloperWorkspaceActionResult,
  DeveloperWorkspaceResponse,
  DiffPreviewState,
  ExperienceSnapshotResponse,
  GatewayControlResponse,
  GatewayRuntimeResponse,
  PendingRequest,
} from "./controlPageClient.types";
import {
  asArray,
  asText,
  buildGatewayWsUrl,
  buildTimelineItems,
  fetchJson,
  getApprovals,
  getArtifacts,
  getCapabilities,
  getCompanions,
  getChannelRows,
  getMemoryRecallSources,
  getMissionRows,
  getProductModeId,
  getProductModeLabel,
  getProviderRows,
  getReceiptCards,
  getSessionEntries,
  getSessionIdFromState,
  getTaskEntries,
  getToolRuns,
  getTopConsumers,
  getTranscriptEntries,
  getUiSurfaceHints,
} from "./controlPageClient.utils";

const CONTROL_OBSERVATORY_QUERY_KEYS = ["runId", "traceId", "status", "runStatus", "limit"] as const;

export function useControlPageClient(): ControlPageClientModel {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSessionId = asText(searchParams.get("sessionId"));
  const [state, setState] = useState<ControlStateResponse | null>(null);
  const [runtime, setRuntime] = useState<Record<string, any> | null>(null);
  const [gatewayControl, setGatewayControl] = useState<GatewayControlResponse | null>(null);
  const [gatewayControlError, setGatewayControlError] = useState<string | null>(null);
  const [experience, setExperience] = useState<ExperienceSnapshotResponse | null>(null);
  const [experienceError, setExperienceError] = useState<string | null>(null);
  const [developerWorkspace, setDeveloperWorkspace] = useState<DeveloperWorkspaceResponse | null>(null);
  const [developerWorkspaceError, setDeveloperWorkspaceError] = useState<string | null>(null);
  const [developerWorkspaceActionResult, setDeveloperWorkspaceActionResult] =
    useState<DeveloperWorkspaceActionResult | null>(null);
  const [developerWorkspaceActionPending, setDeveloperWorkspaceActionPending] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSessionId);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [resolvingApprovalId, setResolvingApprovalId] = useState<string | null>(null);
  const [resolvingProviderId, setResolvingProviderId] = useState<string | null>(null);
  const [resolvingChannelActionId, setResolvingChannelActionId] = useState<string | null>(null);
  const [resolvingMissionId, setResolvingMissionId] = useState<string | null>(null);
  const [resolvingModeEscalation, setResolvingModeEscalation] = useState(false);
  const [diffPreview, setDiffPreview] = useState<DiffPreviewState>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRequestsRef = useRef<Map<string, PendingRequest>>(new Map());
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSessionQuery = (sessionId: string | null) => {
    if (!sessionId) {
      return;
    }
    const next = new URLSearchParams(searchParams.toString());
    next.set("sessionId", sessionId);
    startTransition(() => {
      router.replace(`/control?${next.toString()}`, { scroll: false });
    });
  };

  const applyStatePayload = (payload: ControlStateResponse | null) => {
    if (!payload) {
      return;
    }
    setState(payload);
    const resolvedSessionId = getSessionIdFromState(payload);
    if (resolvedSessionId) {
      setActiveSessionId(resolvedSessionId);
      syncSessionQuery(resolvedSessionId);
    }
  };

  const buildControlStateQuery = (preferredSessionId?: string | null) => {
    const next = new URLSearchParams();
    const sessionId = asText(preferredSessionId || activeSessionId || searchParams.get("sessionId") || "");
    if (sessionId) {
      next.set("sessionId", sessionId);
    }
    for (const key of CONTROL_OBSERVATORY_QUERY_KEYS) {
      const value = asText(searchParams.get(key));
      if (value) {
        next.set(key, value);
      }
    }
    const query = next.toString();
    return query ? `?${query}` : "";
  };

  const loadGatewayControlSnapshot = async (): Promise<GatewayControlResponse | null> => {
    try {
      const payload = await fetchJson<GatewayControlResponse>("/api/gateway-control");
      setGatewayControl(payload);
      setGatewayControlError(null);
      return payload;
    } catch (controlError: any) {
      const message = controlError?.message || "Falha ao carregar a Gateway Control API.";
      const fallbackPayload: GatewayControlResponse = {
        ok: false,
        resource: "overview",
        warnings: [message],
        error: message,
      };
      setGatewayControl(fallbackPayload);
      setGatewayControlError(message);
      return null;
    }
  };

  const loadExperienceSnapshot = async (): Promise<ExperienceSnapshotResponse | null> => {
    try {
      const query = buildControlStateQuery();
      const payload = await fetchJson<ExperienceSnapshotResponse>(`/api/experience/home${query}`);
      setExperience(payload);
      setExperienceError(null);
      return payload;
    } catch (experienceLoadError: any) {
      const message = experienceLoadError?.message || "Falha ao carregar a Experience Core API.";
      setExperience(null);
      setExperienceError(message);
      return null;
    }
  };

  const loadDeveloperWorkspaceSnapshot = async (): Promise<DeveloperWorkspaceResponse | null> => {
    try {
      const payload = await fetchJson<DeveloperWorkspaceResponse>("/api/developer-workspace");
      setDeveloperWorkspace(payload);
      setDeveloperWorkspaceError(null);
      return payload;
    } catch (workspaceError: any) {
      const message = workspaceError?.message || "Falha ao carregar o Developer Workspace.";
      const fallbackPayload: DeveloperWorkspaceResponse = {
        ok: false,
        warnings: [message],
        error: message,
      };
      setDeveloperWorkspace(fallbackPayload);
      setDeveloperWorkspaceError(message);
      return null;
    }
  };

  const loadControlState = async (preferredSessionId?: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const query = buildControlStateQuery(preferredSessionId);
      const [statePayload, runtimePayload, commandCenterPayload, eventsPayload] = await Promise.all([
        fetchJson<ControlStateResponse>(`/api/web/gateway/sessions${query}`),
        fetchJson<GatewayRuntimeResponse>(`/api/web/gateway/runtime${query}`),
        fetchJson<Record<string, any>>(`/api/web/command-center${query}`),
        fetchJson<Record<string, any>>(`/api/web/command-center/events-v1${query}`),
        loadGatewayControlSnapshot(),
        loadExperienceSnapshot(),
        loadDeveloperWorkspaceSnapshot(),
      ]);

      applyStatePayload({
        ...statePayload,
        agentRuntime: commandCenterPayload?.snapshot || null,
        runtimeApiV1: {
          contracts: commandCenterPayload?.contractsV1 || commandCenterPayload?.contractAdapter || null,
          events: eventsPayload?.eventsV1 || null,
          safety: {
            commandCenterCanExecute: false,
            sourceOfTruth: "runtime-api-v1",
          },
        },
      } as ControlStateResponse);
      setRuntime(runtimePayload.runtime || null);
      setDiffPreview(null);
    } catch (fetchError: any) {
      setError(fetchError?.message || "Falha ao carregar a Control UI.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadControlState(initialSessionId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sessionId = asText(activeSessionId);
    if (!sessionId) {
      return;
    }

    setWsStatus("connecting");
    let closed = false;
    let socket: WebSocket | null = null;

    const queueRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = setTimeout(() => {
        void loadControlState(sessionId);
      }, 150);
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data || "{}"));

        if (payload.type === "response" && payload.id) {
          const pending = pendingRequestsRef.current.get(payload.id);
          if (pending) {
            pendingRequestsRef.current.delete(payload.id);
            if (payload.ok) {
              pending.resolve(payload.result);
            } else {
              pending.reject(new Error(payload.error?.message || "Falha no gateway."));
            }
          }
          return;
        }

        if (payload.type === "runtime") {
          setRuntime(payload.payload || null);
          return;
        }

        if (payload.type === "hydrate" && payload.state) {
          applyStatePayload(payload.state);
          return;
        }

        if (payload.type === "event") {
          if (payload.event?.kind === "health.resource" && payload.event?.payload) {
            setState((current) =>
              current
                ? {
                    ...current,
                    resourcePlane: {
                      ...(current.resourcePlane || {}),
                      generatedAt: payload.event.payload.generatedAt,
                      status: payload.event.payload.host?.pressure || current.resourcePlane?.status || "unknown",
                      host: payload.event.payload.host || null,
                      totals: payload.event.payload.totals || null,
                      topConsumers: Array.isArray(payload.event.payload.topConsumers)
                        ? payload.event.payload.topConsumers
                        : [],
                      warnings: Array.isArray(payload.event.payload.warnings)
                        ? payload.event.payload.warnings
                        : [],
                      recommendations: Array.isArray(payload.event.payload.recommendations)
                        ? payload.event.payload.recommendations
                        : [],
                    },
                  }
                : current,
            );
            return;
          }
          queueRefresh();
        }
      } catch {
        queueRefresh();
      }
    };

    const connect = async () => {
      try {
        const ticketPayload = await fetchJson<{ ok: boolean; ticket?: string }>("/api/auth/ticket", {
          method: "POST",
        });
        const ticket = asText(ticketPayload.ticket);
        if (!ticket) {
          throw new Error("Ticket WebSocket ausente.");
        }
        if (closed) {
          return;
        }

        socket = new WebSocket(buildGatewayWsUrl(sessionId, ticket));
        socketRef.current = socket;
        socket.onopen = () => {
          setWsStatus("connected");
        };
        socket.onclose = () => {
          setWsStatus("disconnected");
        };
        socket.onerror = () => {
          setWsStatus("disconnected");
        };
        socket.onmessage = handleMessage;
      } catch (ticketError: any) {
        if (!closed) {
          setWsStatus("disconnected");
          setError(ticketError?.message || "Falha ao emitir ticket WebSocket.");
        }
      }
    };

    void connect();

    return () => {
      closed = true;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      pendingRequestsRef.current.forEach((pending) =>
        pending.reject(new Error("A conexao com o gateway foi reiniciada.")),
      );
      pendingRequestsRef.current.clear();
      socket?.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const sendGatewayRequest = async (method: string, params: Record<string, any>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway WebSocket ainda nao esta conectado.");
    }

    const id = `${method}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const request = JSON.stringify({ id, method, params });

    return new Promise((resolve, reject) => {
      pendingRequestsRef.current.set(id, { resolve, reject });
      socket.send(request);
    });
  };

  const handleSend = async (options: { live?: boolean } = {}) => {
    const message = asText(draft);
    if (!message) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const experiencePayload = await fetchJson<Record<string, any>>(`/api/experience/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: getSessionIdFromState(state) || activeSessionId || null,
          text: message,
          message,
          intent: "ask",
          surface: "web",
          live: options.live === true,
          requestedBy: "control-ui",
        }),
      });
      if (experiencePayload.snapshot) {
        setExperience(experiencePayload.snapshot as ExperienceSnapshotResponse);
      }
      setState((current) => {
        const currentState = (current || {}) as ControlStateResponse;
        const currentRuntimeApiV1 = currentState.runtimeApiV1 || {};
        return {
          ...currentState,
          runtimeApiV1: {
            ...currentRuntimeApiV1,
            chat: experiencePayload.chat || experiencePayload.data || experiencePayload,
            experience: experiencePayload,
            safety: {
              ...(currentRuntimeApiV1.safety || {}),
              commandCenterCanExecute: false,
              sourceOfTruth: "runtime-api-v1",
            },
          },
        } as ControlStateResponse;
      });
      setDraft("");
      setDiffPreview(null);
      if (options.live === true) {
        await loadControlState(getSessionIdFromState(state) || activeSessionId || null);
      } else {
        await loadExperienceSnapshot();
      }
    } catch (sendError: any) {
      setError(sendError?.message || "Failed to submit the mission.");
    } finally {
      setSending(false);
    }
  };

  const handleDeveloperWorkspaceAction = async (
    action: "start" | "stop" | "restart",
    processId?: string | null,
  ): Promise<DeveloperWorkspaceActionResult | null> => {
    const pendingId = `${action}:${asText(processId, "all")}`;
    setDeveloperWorkspaceActionPending(pendingId);
    setDeveloperWorkspaceActionResult(null);
    setDeveloperWorkspaceError(null);

    try {
      const response = await fetch("/api/developer-workspace", {
        method: "POST",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          processId: asText(processId) || null,
          requestedBy: "control-ui",
        }),
      });
      const payload = await response.json() as DeveloperWorkspaceActionResult;
      setDeveloperWorkspaceActionResult(payload);
      if (payload.snapshot) {
        setDeveloperWorkspace(payload.snapshot);
      } else {
        await loadDeveloperWorkspaceSnapshot();
      }
      if (!response.ok && payload.status !== "approval_required") {
        setDeveloperWorkspaceError(payload.message || "Developer Workspace retornou erro.");
      }
      return payload;
    } catch (workspaceError: any) {
      const result: DeveloperWorkspaceActionResult = {
        ok: false,
        status: "failed",
        message: workspaceError?.message || "Falha ao chamar o Developer Workspace.",
      };
      setDeveloperWorkspaceActionResult(result);
      setDeveloperWorkspaceError(result.message || null);
      return result;
    } finally {
      setDeveloperWorkspaceActionPending(null);
    }
  };

  const handleSessionChange = async (sessionId: string) => {
    const normalizedSessionId = asText(sessionId);
    if (!normalizedSessionId || normalizedSessionId === activeSessionId) {
      return;
    }
    setActiveSessionId(normalizedSessionId);
    syncSessionQuery(normalizedSessionId);
    await loadControlState(normalizedSessionId);
  };

  const handleApproval = async (approvalId: string, decision: "approve" | "reject") => {
    const normalizedApprovalId = asText(approvalId);
    if (!normalizedApprovalId) {
      return;
    }

    setResolvingApprovalId(normalizedApprovalId);
    setError(null);

    try {
      const experienceDecision = await fetchJson<Record<string, any>>(
        `/api/experience/approvals/${encodeURIComponent(normalizedApprovalId)}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            requestedBy: "control-ui",
            sessionId: getSessionIdFromState(state) || activeSessionId || null,
          }),
        },
      );
      if (experienceDecision.snapshot) {
        setExperience(experienceDecision.snapshot as ExperienceSnapshotResponse);
      }
      await fetchJson<Record<string, any>>("/api/web/command-center/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: decision === "approve" ? "approval.approve" : "approval.deny",
          approvalId: normalizedApprovalId,
          requestedBy: "control-ui",
          reason: decision === "approve"
            ? "Approved from Command Center."
            : "Denied from Command Center.",
          sessionId: getSessionIdFromState(state) || activeSessionId || null,
        }),
      });
      await loadControlState(getSessionIdFromState(state) || activeSessionId || null);
    } catch (approvalError: any) {
      setError(approvalError?.message || "Falha ao resolver approval.");
    } finally {
      setResolvingApprovalId(null);
    }
  };

  const handleMissionCancel = async (missionId: string) => {
    const normalizedMissionId = asText(missionId);
    if (!normalizedMissionId) {
      return;
    }

    setResolvingMissionId(normalizedMissionId);
    setError(null);

    try {
      await fetchJson<Record<string, any>>("/api/web/command-center/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mission.cancel",
          missionId: normalizedMissionId,
          requestedBy: "control-ui",
          reason: "Cancelled from Command Center.",
          sessionId: getSessionIdFromState(state) || activeSessionId || null,
        }),
      });
      await loadControlState(getSessionIdFromState(state) || activeSessionId || null);
    } catch (missionError: any) {
      setError(missionError?.message || "Failed to cancel mission.");
    } finally {
      setResolvingMissionId(null);
    }
  };

  const handleModeEscalation = async (
    decision: "approve" | "reject",
    scope: "once" | "session" | "host" = "session",
  ) => {
    const requestId = asText(state?.modeEscalation?.pendingRequest?.id);
    if (!requestId) {
      return;
    }

    setResolvingModeEscalation(true);
    setError(null);

    try {
      await sendGatewayRequest("runtime.modeEscalation.resolve", {
        requestId,
        decision,
        scope,
      });
      await loadControlState(getSessionIdFromState(state) || activeSessionId || null);
    } catch (modeError: any) {
      setError(modeError?.message || "Falha ao resolver a elevacao de modo.");
    } finally {
      setResolvingModeEscalation(false);
    }
  };

  const handleProviderTest = async (
    providerId: string,
    options: { live?: boolean; approved?: boolean } = {},
  ) => {
    const normalizedProviderId = asText(providerId);
    if (!normalizedProviderId) {
      return;
    }

    setResolvingProviderId(normalizedProviderId);
    setError(null);

    try {
      await fetchJson<Record<string, any>>("/api/web/command-center/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "provider.test",
          providerId: normalizedProviderId,
          live: options.live === true,
          approved: options.approved === true,
          requestedBy: "control-ui",
        }),
      });
      await loadControlState(getSessionIdFromState(state) || activeSessionId || null);
    } catch (providerError: any) {
      setError(providerError?.message || "Provider test failed.");
    } finally {
      setResolvingProviderId(null);
    }
  };

  const handleChannelAction = async (
    channelId: string,
    actionId: string,
    options: { approved?: boolean } = {},
  ) => {
    const normalizedChannelId = asText(channelId);
    const normalizedActionId = asText(actionId);
    if (!normalizedChannelId || !normalizedActionId) {
      return;
    }

    const pendingId = `${normalizedChannelId}:${normalizedActionId}`;
    setResolvingChannelActionId(pendingId);
    setError(null);

    try {
      await fetchJson<Record<string, any>>("/api/web/command-center/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "channel.action",
          channelId: normalizedChannelId,
          actionId: normalizedActionId,
          approved: options.approved === true,
          requestedBy: "control-ui",
        }),
      });
      await loadControlState(getSessionIdFromState(state) || activeSessionId || null);
    } catch (channelError: any) {
      setError(channelError?.message || "Channel action failed.");
    } finally {
      setResolvingChannelActionId(null);
    }
  };

  const handleOpenDiff = async (toolRunId: string) => {
    const normalizedToolRunId = asText(toolRunId);
    if (!normalizedToolRunId) {
      return;
    }

    try {
      const result = await sendGatewayRequest("artifact.diff", {
        sessionId: getSessionIdFromState(state) || activeSessionId || null,
        toolRunId: normalizedToolRunId,
      });
      const diff = (result as Record<string, any>)?.diff || {};
      setDiffPreview({
        toolRunId: normalizedToolRunId,
        summary: asText(diff.summary, "Diff carregado."),
        patches: asArray(diff.patches),
        consolidatedDiff: asText(diff.consolidatedDiff) || null,
      });
    } catch (diffError: any) {
      setError(diffError?.message || "Falha ao abrir diff/artifact.");
    }
  };

  const sessionEntries = getSessionEntries(state);
  const transcriptEntries = getTranscriptEntries(state);
  const taskEntries = getTaskEntries(state);
  const toolRuns = getToolRuns(state);
  const artifacts = getArtifacts(state);
  const approvals = getApprovals(state);
  const capabilities = getCapabilities(state);
  const companions = getCompanions(state);
  const topConsumers = getTopConsumers(state);
  const uiSurfaceHints = getUiSurfaceHints(state);
  const memoryRecall = state?.memoryRecall || null;
  const memoryRecallSources = getMemoryRecallSources(state);
  const recommendedJourneys = asArray<Record<string, any>>(uiSurfaceHints?.journeys).filter((entry) => entry?.recommended);
  const visibleSurfaces = asArray<Record<string, any>>(uiSurfaceHints?.surfaces).filter((entry) => entry?.visible);
  const runtimeWarnings = asArray<string>(state?.runtimeWarnings);
  const recommendations = asArray<Record<string, any>>(state?.actionRecommendations);
  const runtimeApiV1 = state?.runtimeApiV1 || null;
  const receiptCards = getReceiptCards(state);
  const providerRows = getProviderRows(state);
  const channelRows = getChannelRows(state);
  const missionRows = getMissionRows(state);
  const effectiveSessionId = getSessionIdFromState(state) || activeSessionId;
  const escalationRequest = state?.modeEscalation?.pendingRequest || null;
  const productModeId = getProductModeId(state);
  const productModeLabel = getProductModeLabel(state);
  const runtimeStatus = asText(
    runtime?.status ?? runtime?.gateway?.status ?? runtime?.summary ?? runtime?.health?.status,
    "desconhecido",
  );
  const timelineItems = buildTimelineItems(state);

  return {
    state,
    runtime,
    gatewayControl,
    gatewayControlError,
    experience,
    experienceError,
    developerWorkspace,
    developerWorkspaceError,
    developerWorkspaceActionResult,
    developerWorkspaceActionPending,
    activeSessionId,
    draft,
    setDraft,
    loading,
    sending,
    resolvingApprovalId,
    resolvingProviderId,
    resolvingChannelActionId,
    resolvingMissionId,
    resolvingModeEscalation,
    diffPreview,
    setDiffPreview,
    wsStatus,
    error,
    sessionEntries,
    transcriptEntries,
    taskEntries,
    toolRuns,
    artifacts,
    approvals,
    capabilities,
    companions,
    topConsumers,
    uiSurfaceHints,
    memoryRecall,
    memoryRecallSources,
    recommendedJourneys,
    visibleSurfaces,
    runtimeWarnings,
    recommendations,
    runtimeApiV1,
    receiptCards,
    providerRows,
    channelRows,
    missionRows,
    effectiveSessionId,
    escalationRequest,
    productModeId,
    productModeLabel,
    runtimeStatus,
    timelineItems,
    loadControlState,
    reloadGatewayControl: loadGatewayControlSnapshot,
    reloadExperience: loadExperienceSnapshot,
    reloadDeveloperWorkspace: loadDeveloperWorkspaceSnapshot,
    handleDeveloperWorkspaceAction,
    handleSend,
    handleSessionChange,
    handleApproval,
    handleMissionCancel,
    handleProviderTest,
    handleChannelAction,
    handleModeEscalation,
    handleOpenDiff,
  };
}
