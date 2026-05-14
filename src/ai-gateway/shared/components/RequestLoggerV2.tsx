"use client";

import RequestLoggerDetail from "./RequestLoggerDetail";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { RequestLoggerToolbar } from "./request-logger-v2/RequestLoggerToolbar";
import { RequestLoggerQuickFilters } from "./request-logger-v2/RequestLoggerQuickFilters";
import { RequestLoggerTable } from "./request-logger-v2/RequestLoggerTable";
import { useRequestLoggerV2 } from "./request-logger-v2/useRequestLoggerV2";

export default function RequestLoggerV2() {
  const logger = useRequestLoggerV2();

  return (
    <div className="flex flex-col gap-4">
      <RequestLoggerToolbar
        recording={logger.recording}
        onToggleRecording={logger.toggleRecording}
        detailLoggingEnabled={logger.detailLoggingEnabled}
        detailLoggingLoading={logger.detailLoggingLoading}
        onToggleDetailLogging={logger.toggleDetailLogging}
        search={logger.search}
        onSearchChange={logger.setSearch}
        selectedProvider={logger.selectedProvider}
        onProviderChange={logger.setSelectedProvider}
        selectedModel={logger.selectedModel}
        onModelChange={logger.setSelectedModel}
        selectedAccount={logger.selectedAccount}
        onAccountChange={logger.setSelectedAccount}
        selectedApiKey={logger.selectedApiKey}
        onApiKeyChange={logger.setSelectedApiKey}
        uniqueProviders={logger.uniqueProviders}
        uniqueModels={logger.uniqueModels}
        uniqueAccounts={logger.uniqueAccounts}
        uniqueApiKeys={logger.uniqueApiKeys}
        providerNodes={logger.providerNodes}
        logs={logger.logs}
        stats={logger.stats}
        shownCount={logger.sortedLogs.length}
        sortBy={logger.sortBy}
        onSortChange={logger.setSortBy}
        onRefresh={logger.refreshLogs}
      />

      <RequestLoggerQuickFilters
        activeFilter={logger.activeFilter}
        onActiveFilterChange={logger.setActiveFilter}
        uniqueProviders={logger.uniqueProviders}
        selectedProvider={logger.selectedProvider}
        onProviderChange={logger.setSelectedProvider}
        providerNodes={logger.providerNodes}
        visibleColumns={logger.visibleColumns}
        onToggleColumn={logger.toggleColumn}
      />

      <RequestLoggerTable
        logs={logger.logs}
        sortedLogs={logger.sortedLogs}
        loading={logger.loading}
        visibleColumns={logger.visibleColumns}
        providerNodes={logger.providerNodes}
        onOpenDetail={logger.openDetail}
      />

      <div className="text-[10px] text-text-muted italic">
        Call logs are also saved as JSON files to <code>{`{DATA_DIR}/call_logs/`}</code> and rotated
        by <code>CALL_LOG_RETENTION_DAYS</code> and <code>CALL_LOG_MAX_ENTRIES</code>.
      </div>

      {logger.selectedLog && (
        <RequestLoggerDetail
          log={logger.selectedLog}
          detail={logger.detailData}
          loading={logger.detailLoading}
          onClose={logger.closeDetail}
          onCopy={copyToClipboard}
        />
      )}
    </div>
  );
}
