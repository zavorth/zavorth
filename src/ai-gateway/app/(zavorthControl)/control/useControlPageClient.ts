import { useState, useRef, useEffect } from "react";

export type ControlPageClientState = {
  wsReconnectAttempt: number;
};

export function useControlPageClient() {
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState<number>(0);
  const reconnectTimeoutRef = useRef<any>(null);

  const fetchJson = async <T = Record<string, any>>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, init);
    return res.json();
  };

  const loadControlState = async () => {
    const [gatewayControl, resilience] = await Promise.all([
      fetchJson("/api/gateway-control"),
      fetchJson("/api/gateway-control/resilience").catch((error: unknown) => ({
        ok: false,
        error: error?.message || "Failure ao carregar a resiliencia do gateway.",
      })),
    ]);
    const developerWorkspace = await fetchJson("/api/developer-workspace");
    return { gatewayControl: { ...gatewayControl, resilience }, developerWorkspace };
  };

  const reloadGatewayControl = async () => {
    const [gatewayControl, resilience] = await Promise.all([
      fetchJson("/api/gateway-control"),
      fetchJson("/api/gateway-control/resilience").catch((error: unknown) => ({
        ok: false,
        error: error?.message || "Failure ao carregar a resiliencia do gateway.",
      })),
    ]);
    return { ...gatewayControl, resilience };
  };
  const reloadDeveloperWorkspace = async () => fetchJson("/api/developer-workspace");

  const loadRuntimeEventsV1 = async (query = "") => {
    return fetchJson<Record<string, any>>(`/api/web/zavorthControl/events-v1${query}`);
  };

  const submitZavorthControlAction = async (payload: Record<string, any>) => {
    return fetchJson<Record<string, any>>("/api/web/zavorthControl/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const submitChatV1 = async (message: string, options: { sessionId?: string | null; live?: boolean } = {}) => {
    return fetchJson<Record<string, any>>(`/api/web/zavorthControl/chat-v1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        sessionId: options.sessionId || null,
        live: options.live === true,
      }),
    });
  };

  const handleApprovalDecision = async (permissionId: string, decision: "approve" | "deny") => {
    return submitZavorthControlAction({
      action: decision === "approve" ? "approval.approve" : "approval.deny",
      permissionId,
    });
  };

  const handleProviderTest = async (providerId: string) => {
    return submitZavorthControlAction({
      action: "provider.test",
      providerId,
    });
  };

  const handleChannelAction = async (channelId: string, channelAction: string) => {
    return submitZavorthControlAction({
      action: "channel.action",
      channelId,
      channelAction,
    });
  };

  const handleMissionCancel = async (missionId: string) => {
    return submitZavorthControlAction({
      action: "mission.cancel",
      missionId,
    });
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = setTimeout(() => {
      setWsReconnectAttempt((prev) => prev + 1);
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

    return {
      wsReconnectAttempt,
      loadControlState,
      reloadGatewayControl,
      reloadDeveloperWorkspace,
      loadRuntimeEventsV1,
    submitChatV1,
    handleApprovalDecision,
    handleProviderTest,
    handleChannelAction,
    handleMissionCancel,
    scheduleReconnect,
  };
}
