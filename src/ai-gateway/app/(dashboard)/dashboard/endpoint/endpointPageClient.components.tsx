"use client";

import Link from "next/link";
import { Card, Button, Input, Modal } from "@/shared/components";
import { ProviderModelsModal } from "./EndpointPageSections";
import { EndpointPageClientViewState } from "./endpointPageClient.types";

export function CloudStatusToast({
  cloudStatus,
  onClose,
}: {
  cloudStatus: EndpointPageClientViewState["cloudStatus"];
  onClose: () => void;
}) {
  if (!cloudStatus) return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg mb-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
        cloudStatus.type === "success"
          ? "bg-green-500/10 border border-green-500/30 text-green-400"
          : cloudStatus.type === "warning"
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-400"
            : "bg-red-500/10 border border-red-500/30 text-red-400"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">
        {cloudStatus.type === "success" ? "check_circle" : cloudStatus.type === "warning" ? "warning" : "error"}
      </span>
      <span className="flex-1">{cloudStatus.message}</span>
      <button onClick={onClose} className="p-0.5 hover:bg-white/10 rounded transition-colors">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}

export function CloudflaredStatusCard({
  state,
}: {
  state: Pick<
    EndpointPageClientViewState,
    | "translateOrFallback"
    | "cloudflaredStatus"
    | "cloudflaredBusy"
    | "cloudflaredNotice"
    | "cloudflaredPhaseMeta"
    | "cloudflaredActionLabel"
    | "cloudflaredUrlNotice"
    | "copied"
    | "copy"
    | "tc"
    | "handleCloudflaredAction"
    | "setCloudflaredNotice"
  >;
}) {
  const {
    translateOrFallback,
    cloudflaredStatus,
    cloudflaredBusy,
    cloudflaredNotice,
    cloudflaredPhaseMeta,
    cloudflaredActionLabel,
    cloudflaredUrlNotice,
    copied,
    copy,
    tc,
    handleCloudflaredAction,
    setCloudflaredNotice,
  } = state;
  const cloudflaredPhase = cloudflaredStatus?.phase || "not_installed";

  return (
    <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                {translateOrFallback("cloudflaredTitle", "Cloudflare Quick Tunnel")}
              </h3>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${cloudflaredPhaseMeta[cloudflaredPhase].className}`}
              >
                {cloudflaredPhaseMeta[cloudflaredPhase].label}
              </span>
            </div>
          </div>

          {cloudflaredStatus?.supported !== false && (
            <Button
              size="sm"
              variant={cloudflaredStatus?.running ? "secondary" : "primary"}
              icon={cloudflaredStatus?.running ? "cloud_off" : "cloud_upload"}
              onClick={() =>
                handleCloudflaredAction(cloudflaredStatus?.running ? "disable" : "enable")
              }
              loading={cloudflaredBusy}
              className={
                cloudflaredStatus?.running
                  ? "border-border/70! text-text-muted! hover:text-text!"
                  : "bg-linear-to-r from-primary to-cyan-500 hover:from-primary-hover hover:to-cyan-600"
              }
            >
              {cloudflaredActionLabel}
            </Button>
          )}
        </div>

        {cloudflaredNotice && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              cloudflaredNotice.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : cloudflaredNotice.type === "info"
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {cloudflaredNotice.type === "success"
                ? "check_circle"
                : cloudflaredNotice.type === "info"
                  ? "info"
                  : "error"}
            </span>
            <span className="flex-1">{cloudflaredNotice.message}</span>
            <button
              onClick={() => setCloudflaredNotice(null)}
              className="rounded p-0.5 transition-colors hover:bg-white/10"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        <p className="text-xs text-text-muted">{cloudflaredUrlNotice}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={cloudflaredStatus?.apiUrl || ""}
            readOnly
            placeholder="https://*.trycloudflare.com/v1"
            className="flex-1 min-w-0 font-mono text-sm"
          />
          <Button
            variant="secondary"
            icon={copied === "cloudflared_url" ? "check" : "content_copy"}
            onClick={() =>
              cloudflaredStatus?.apiUrl && copy(cloudflaredStatus.apiUrl, "cloudflared_url")
            }
            disabled={!cloudflaredStatus?.apiUrl}
            className="shrink-0 self-start sm:self-auto"
          >
            {copied === "cloudflared_url" ? tc("copied") : tc("copy")}
          </Button>
        </div>
        {cloudflaredStatus?.lastError && (
          <p className="text-xs text-red-400">
            {translateOrFallback("cloudflaredLastError", "Last error: {error}", {
              error: cloudflaredStatus.lastError,
            })}
          </p>
        )}
      </div>
    </div>
  );
}

export function ProtocolsPanel({ state }: { state: EndpointPageClientViewState }) {
  const { t, tc, mcpOnline, a2aOnline, mcpToolCount, a2aActiveStreams, mcpStatus, a2aStatus, baseUrl } = state;

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold">{t("protocolsTitle") || "Protocols"}</h2>
          <p className="text-sm text-text-muted mt-1">
            {t("protocolsDescription") ||
              "MCP and A2A are first-class endpoints with dedicated observability and controls."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border p-4 bg-bg-subtle">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">hub</span>
                  {t("mcpCardTitle") || "MCP Server"}
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {t("mcpCardDescription") || "Model Context Protocol over stdio"}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  mcpOnline ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                }`}
              >
                {mcpOnline ? tc("active") : tc("inactive")}
              </span>
            </div>
            <div className="mt-3 text-xs text-text-muted space-y-1">
              <p>
                {t("protocolToolsLabel") || "Tools"}:{" "}
                <span className="text-text-main font-semibold">{mcpToolCount || 16}</span>
              </p>
              <p>
                {t("protocolLastActivity") || "Last activity"}:{" "}
                <span className="text-text-main">
                  {mcpStatus?.activity?.lastCallAt
                    ? new Date(mcpStatus.activity.lastCallAt).toLocaleString()
                    : "—"}
                </span>
              </p>
            </div>
            <div className="mt-3 rounded-lg bg-bg p-3 border border-border/70">
              <p className="text-xs font-semibold mb-1">{t("quickStart") || "Quick Start"}</p>
              <code className="text-xs font-mono break-all">ZavorthGateway --mcp</code>
            </div>
            <div className="mt-3">
              <Link
                href="/dashboard/mcp"
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                {t("openMcpDashboard") || "Open MCP management"} →
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 bg-bg-subtle">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">
                    group_work
                  </span>
                  {t("a2aCardTitle") || "A2A Server"}
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  {t("a2aCardDescription") || "Agent2Agent JSON-RPC endpoint"}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  a2aOnline ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"
                }`}
              >
                {a2aOnline ? tc("active") : tc("inactive")}
              </span>
            </div>
            <div className="mt-3 text-xs text-text-muted space-y-1">
              <p>
                {t("protocolTasksLabel") || "Tasks"}:{" "}
                <span className="text-text-main font-semibold">{a2aStatus?.tasks?.total || 0}</span>
              </p>
              <p>
                {t("protocolActiveStreamsLabel") || "Active streams"}:{" "}
                <span className="text-text-main font-semibold">{a2aActiveStreams}</span>
              </p>
            </div>
            <div className="mt-3 rounded-lg bg-bg p-3 border border-border/70">
              <p className="text-xs font-semibold mb-1">{t("quickStart") || "Quick Start"}</p>
              <code className="text-xs font-mono break-all">{baseUrl.replace(/\/v1$/, "")}/a2a</code>
            </div>
            <div className="mt-3">
              <Link
                href="/dashboard/a2a"
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                {t("openA2aDashboard") || "Open A2A management"} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function CloudModals({ state }: { state: EndpointPageClientViewState }) {
  const {
    t,
    tc,
    cloudSyncing,
    modalSuccess,
    syncStep,
    showCloudModal,
    setShowCloudModal,
    showDisableModal,
    setShowDisableModal,
    handleEnableCloud,
    handleConfirmDisable,
  } = state;

  return (
    <>
      <Modal isOpen={showCloudModal} title={t("enableCloudTitle")} onClose={() => setShowCloudModal(false)}>
        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">{t("whatYouGet")}</p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• {t("cloudBenefitAccess")}</li>
              <li>• {t("cloudBenefitShare")}</li>
              <li>• {t("cloudBenefitPorts")}</li>
              <li>• {t("cloudBenefitEdge")}</li>
            </ul>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">{tc("note")}</p>
            <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              <li>• {t("cloudSessionNote")}</li>
              <li>• {t("cloudUnstableNote")}</li>
            </ul>
          </div>

          {(cloudSyncing || modalSuccess) && (
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                modalSuccess ? "bg-green-500/10 border-green-500/30" : "bg-primary/10 border-primary/30"
              }`}
            >
              {modalSuccess ? (
                <span className="material-symbols-outlined text-green-500 text-xl">check_circle</span>
              ) : (
                <span className="material-symbols-outlined animate-spin text-primary">
                  progress_activity
                </span>
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${modalSuccess ? "text-green-500" : "text-primary"}`}>
                  {modalSuccess && t("cloudConnected")}
                  {!modalSuccess && syncStep === "syncing" && t("connectingToCloud")}
                  {!modalSuccess && syncStep === "verifying" && t("verifyingConnection")}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleEnableCloud} fullWidth disabled={cloudSyncing || modalSuccess}>
              {cloudSyncing ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                  {syncStep === "syncing" ? t("connecting") : t("verifying")}
                </span>
              ) : modalSuccess ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">check</span>
                  {t("connected")}
                </span>
              ) : (
                t("enableCloud")
              )}
            </Button>
            <Button
              onClick={() => setShowCloudModal(false)}
              variant="ghost"
              fullWidth
              disabled={cloudSyncing || modalSuccess}
            >
              {tc("cancel")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDisableModal}
        title={t("disableCloudTitle")}
        onClose={() => !cloudSyncing && setShowDisableModal(false)}
      >
        <div className="flex flex-col gap-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-600 dark:text-red-400">
                warning
              </span>
              <div>
                <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-1">
                  {tc("warning")}
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">{t("disableWarning")}</p>
              </div>
            </div>
          </div>

          {cloudSyncing && (
            <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
              <span className="material-symbols-outlined animate-spin text-primary">
                progress_activity
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-primary">
                  {syncStep === "syncing" && t("syncingData")}
                  {syncStep === "disabling" && t("disablingCloud")}
                </p>
              </div>
            </div>
          )}

          <p className="text-sm text-text-muted">{t("disableConfirm")}</p>

          <div className="flex gap-2">
            <Button
              onClick={handleConfirmDisable}
              fullWidth
              disabled={cloudSyncing}
              className="bg-red-500! hover:bg-red-600! text-white!"
            >
              {cloudSyncing ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-sm">
                    progress_activity
                  </span>
                  {syncStep === "syncing" ? t("syncing") : t("disabling")}
                </span>
              ) : (
                t("disableCloud")
              )}
            </Button>
            <Button
              onClick={() => setShowDisableModal(false)}
              variant="ghost"
              fullWidth
              disabled={cloudSyncing}
            >
              {tc("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export { ProviderModelsModal };
