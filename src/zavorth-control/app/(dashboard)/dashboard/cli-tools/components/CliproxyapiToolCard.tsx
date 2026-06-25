"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";

interface ToolState {
  tool: string;
  installedVersion: string | null;
  currentVersion: string | null;
  status: string;
  pid: number | null;
  port: number;
  healthStatus: string;
  autoUpdate: boolean;
  autoStart: boolean;
  lastHealthCheck: string | null;
  errorMessage: string | null;
}

interface UpdateInfo {
  current: string | null;
  latest: string;
  updateAvailable: boolean;
}

const cliproxyTool = {
  id: "cliproxyapi",
  name: "CLIProxyAPI",
  description: "Managed upstream proxy fallback for OAuth-backed CLI traffic.",
  icon: "swap_horiz",
  color: "#6366F1",
};

export default function CliproxyapiToolCard({ tool = cliproxyTool, isExpanded, onToggle }) {
  const [toolState, setToolState] = useState<ToolState | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/version-manager/status");
      if (!res.ok) return;
      const data = await res.json();
      const entry = Array.isArray(data)
        ? data.find((entry: ToolState) => entry.tool === "cliproxyapi")
        : null;
      setToolState(entry || null);
    } catch (err) {
      console.error("Failed to fetch CLIProxyAPI status:", err);
    }
  }, []);

  const fetchUpdateInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/version-manager/check-update?tool=cliproxyapi");
      if (!res.ok) return;
      setUpdateInfo(await res.json());
    } catch (err) {
      console.error("Failed to fetch CLIProxyAPI update info:", err);
    }
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    fetchStatus();
    fetchUpdateInfo();
  }, [isExpanded, fetchStatus, fetchUpdateInfo]);

  const apiCall = async (action: string, body?: Record<string, unknown>) => {
    setLoading(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/version-manager/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "cliproxyapi", ...body }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: data.message || `${action} succeeded` });
        await fetchStatus();
        if (action === "install" || action === "restart") await fetchUpdateInfo();
      } else {
        setMessage({ type: "error", text: data.error || `${action} failed` });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setLoading(null);
    }
  };

  const statusTone =
    toolState?.status === "running"
      ? "success"
      : toolState?.status === "error"
        ? "danger"
        : toolState?.installedVersion
          ? "info"
          : "warning";

  const healthTone =
    toolState?.healthStatus === "healthy"
      ? "success"
      : toolState?.healthStatus === "unhealthy"
        ? "danger"
        : "muted";

  return (
    <CliToolCardFrame
      tool={tool}
      toolKey="cliproxyapi"
      isExpanded={isExpanded}
      onToggle={onToggle}
      eyebrow="Managed proxy runtime"
      summary={tool.description}
      status={
        toolState ? (
          <CliToolMetaPill tone={statusTone} icon="radio_button_checked">
            {toolState.status || "unknown"}
          </CliToolMetaPill>
        ) : (
          <CliToolMetaPill tone="neutral" icon="frame_inspect">
            Status check on open
          </CliToolMetaPill>
        )
      }
      meta={
        <>
          <CliToolMetaPill icon="tag">
            {toolState?.installedVersion ? `v${toolState.installedVersion}` : "not installed"}
          </CliToolMetaPill>
          <CliToolMetaPill tone={healthTone} icon="monitor_heart">
            {toolState?.healthStatus || "unknown health"}
          </CliToolMetaPill>
          <CliToolMetaPill icon="settings_ethernet">:{toolState?.port || 8317}</CliToolMetaPill>
        </>
      }
    >
      {message ? (
        <CliToolNotice
          tone={message.type === "success" ? "success" : "danger"}
          icon={message.type === "success" ? "check_circle" : "error"}
          title={message.text}
        />
      ) : null}

      {updateInfo?.updateAvailable ? (
        <CliToolCardSection
          title="Update available"
          description={`CLIProxyAPI can move from v${updateInfo.current || "unknown"} to v${updateInfo.latest}.`}
          icon="system_update"
          tone="warning"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => apiCall("install", { version: updateInfo.latest })}
              loading={loading === "install"}
            >
              Update
            </Button>
          }
        />
      ) : null}

      <CliToolCardSection
        title="Runtime snapshot"
        description="The version manager owns installation, process state and health for this fallback proxy."
        icon="monitoring"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
            <p className="text-xs text-text-muted">Version</p>
            <p className="mt-1 text-sm font-medium">
              {toolState?.installedVersion ? `v${toolState.installedVersion}` : "Not installed"}
            </p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
            <p className="text-xs text-text-muted">Health</p>
            <p className="mt-1 text-sm font-medium">{toolState?.healthStatus || "Unknown"}</p>
          </div>
          <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
            <p className="text-xs text-text-muted">Port</p>
            <p className="mt-1 font-mono text-sm">{toolState?.port || 8317}</p>
          </div>
        </div>
      </CliToolCardSection>

      <CliToolCardSection
        title="Operator controls"
        description="Install, start, stop or refresh the managed proxy without making it part of the core agent loop."
        icon="bolt"
      >
        <div className="flex flex-wrap gap-2">
          {!toolState?.installedVersion ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => apiCall("install")}
              loading={loading === "install"}
              icon="download"
            >
              Install
            </Button>
          ) : null}

          {toolState?.status === "running" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => apiCall("stop")}
              loading={loading === "stop"}
              icon="stop"
            >
              Stop
            </Button>
          ) : toolState?.installedVersion ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => apiCall("start")}
              loading={loading === "start"}
              icon="play_arrow"
            >
              Start
            </Button>
          ) : null}

          {toolState?.status === "running" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => apiCall("restart")}
              loading={loading === "restart"}
              icon="restart_alt"
            >
              Restart
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="sm"
            onClick={fetchUpdateInfo}
            loading={loading === "check"}
            icon="sync"
          >
            Check updates
          </Button>
        </div>
      </CliToolCardSection>
    </CliToolCardFrame>
  );
}
