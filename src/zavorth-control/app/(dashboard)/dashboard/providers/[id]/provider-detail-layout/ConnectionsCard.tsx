"use client";

import { Button, Card } from "@/shared/components";
import { ProviderDetailConnectionsList } from "./ConnectionsList";
import type { ProviderDetailPageModel } from "../useProviderDetailPageModel";

type ConnectionsCardProps = Pick<
  ProviderDetailPageModel,
  | "t"
  | "providerId"
  | "providerInfo"
  | "connections"
  | "isCompatible"
  | "isOAuth"
  | "providerSupportsPat"
  | "proxyConfig"
  | "setProxyTarget"
  | "handleBatchTestAll"
  | "batchTesting"
  | "retestingId"
  | "openPrimaryAddFlow"
  | "setShowOAuthModal"
  | "setShowAddApiKeyModal"
  | "handleSwapPriority"
  | "handleUpdateConnectionStatus"
  | "handleToggleRateLimit"
  | "handleToggleCodexLimit"
  | "handleRetestConnection"
  | "setSelectedConnection"
  | "setShowEditModal"
  | "handleDelete"
  | "handleRefreshToken"
  | "refreshingId"
  | "handleApplyCodexAuthLocal"
  | "applyingCodexAuthId"
  | "handleExportCodexAuthFile"
  | "exportingCodexAuthId"
  | "connProxyMap"
>;

export function ProviderDetailConnectionsCard({
  t,
  providerId,
  providerInfo,
  connections,
  isCompatible,
  isOAuth,
  providerSupportsPat,
  proxyConfig,
  setProxyTarget,
  handleBatchTestAll,
  batchTesting,
  retestingId,
  openPrimaryAddFlow,
  setShowOAuthModal,
  setShowAddApiKeyModal,
  handleSwapPriority,
  handleUpdateConnectionStatus,
  handleToggleRateLimit,
  handleToggleCodexLimit,
  handleRetestConnection,
  setSelectedConnection,
  setShowEditModal,
  handleDelete,
  handleRefreshToken,
  refreshingId,
  handleApplyCodexAuthLocal,
  applyingCodexAuthId,
  handleExportCodexAuthFile,
  exportingCodexAuthId,
  connProxyMap,
}: ConnectionsCardProps) {
  const providerProxy = proxyConfig?.providers?.[providerId];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{t("connections")}</h2>
          <button
            onClick={() =>
              setProxyTarget({
                level: "provider",
                id: providerId,
                label: providerInfo?.name || providerId,
              })
            }
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
              providerProxy
                ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/25"
                : "bg-black/[0.03] dark:bg-white/[0.03] text-text-muted/50 hover:text-text-muted hover:bg-black/[0.06] dark:hover:bg-white/[0.06]"
            }`}
            title={
              providerProxy
                ? t("providerProxyTitleConfigured", {
                    host: providerProxy.host || t("configured"),
                  })
                : t("providerProxyConfigureHint")
            }
          >
            <span className="material-symbols-outlined text-[14px]">vpn_lock</span>
            {providerProxy ? providerProxy.host || t("providerProxy") : t("providerProxy")}
          </button>
        </div>

        {connections.length > 1 && (
          <button
            onClick={handleBatchTestAll}
            disabled={batchTesting || !!retestingId}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              batchTesting
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40"
            }`}
            title={t("testAll")}
            aria-label={t("testAll")}
          >
            <span className="material-symbols-outlined text-[14px]">
              {batchTesting ? "sync" : "play_arrow"}
            </span>
            {batchTesting ? t("testing") : t("testAll")}
          </button>
        )}

        {!isCompatible ? (
          <div className="flex items-center gap-2">
            <Button size="sm" icon="add" onClick={openPrimaryAddFlow}>
              {providerSupportsPat ? "Add PAT" : t("add")}
            </Button>
            {providerId === "qoder" && (
              <Button size="sm" variant="secondary" onClick={() => setShowOAuthModal(true)}>
                Experimental OAuth
              </Button>
            )}
          </div>
        ) : (
          connections.length === 0 && (
            <Button size="sm" icon="add" onClick={() => setShowAddApiKeyModal(true)}>
              {t("add")}
            </Button>
          )
        )}
      </div>

      {connections.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
            <span className="material-symbols-outlined text-[32px]">{isOAuth ? "lock" : "key"}</span>
          </div>
          <p className="text-text-main font-medium mb-1">{t("noConnectionsYet")}</p>
          <p className="text-sm text-text-muted mb-4">{t("addFirstConnectionHint")}</p>
          {!isCompatible && (
            <div className="flex items-center justify-center gap-2">
              <Button icon="add" onClick={openPrimaryAddFlow}>
                {providerSupportsPat ? "Add PAT" : t("addConnection")}
              </Button>
              {providerId === "qoder" && (
                <Button variant="secondary" onClick={() => setShowOAuthModal(true)}>
                  Experimental OAuth
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <ProviderDetailConnectionsList
          connections={connections}
          providerId={providerId}
          handleSwapPriority={handleSwapPriority}
          handleUpdateConnectionStatus={handleUpdateConnectionStatus}
          handleToggleRateLimit={handleToggleRateLimit}
          handleToggleCodexLimit={handleToggleCodexLimit}
          handleRetestConnection={handleRetestConnection}
          retestingId={retestingId}
          setSelectedConnection={setSelectedConnection}
          setShowEditModal={setShowEditModal}
          handleDelete={handleDelete}
          setShowOAuthModal={setShowOAuthModal}
          handleRefreshToken={handleRefreshToken}
          refreshingId={refreshingId}
          handleApplyCodexAuthLocal={handleApplyCodexAuthLocal}
          applyingCodexAuthId={applyingCodexAuthId}
          handleExportCodexAuthFile={handleExportCodexAuthFile}
          exportingCodexAuthId={exportingCodexAuthId}
          setProxyTarget={setProxyTarget}
          connProxyMap={connProxyMap}
        />
      )}
    </Card>
  );
}
