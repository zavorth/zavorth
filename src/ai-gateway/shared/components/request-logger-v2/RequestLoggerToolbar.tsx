import { getApiKeyOptionLabel, getProviderOptionLabel } from "./requestLoggerUtils";
import type { ProviderNode, RequestLogEntry, RequestLoggerSortKey, RequestLoggerStats } from "./requestLoggerTypes";

interface RequestLoggerToolbarProps {
  recording: boolean;
  onToggleRecording: () => void;
  detailLoggingEnabled: boolean;
  detailLoggingLoading: boolean;
  onToggleDetailLogging: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedProvider: string;
  onProviderChange: (value: string) => void;
  selectedModel: string;
  onModelChange: (value: string) => void;
  selectedAccount: string;
  onAccountChange: (value: string) => void;
  selectedApiKey: string;
  onApiKeyChange: (value: string) => void;
  uniqueProviders: string[];
  uniqueModels: string[];
  uniqueAccounts: string[];
  uniqueApiKeys: string[];
  providerNodes: ProviderNode[];
  logs: RequestLogEntry[];
  stats: RequestLoggerStats;
  shownCount: number;
  sortBy: RequestLoggerSortKey;
  onSortChange: (value: RequestLoggerSortKey) => void;
  onRefresh: () => void;
}

const SORT_OPTIONS: Array<{ value: RequestLoggerSortKey; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "tokens_desc", label: "Tokens desc" },
  { value: "tokens_asc", label: "Tokens asc" },
  { value: "duration_desc", label: "Duration desc" },
  { value: "duration_asc", label: "Duration asc" },
  { value: "status_desc", label: "Status desc" },
  { value: "status_asc", label: "Status asc" },
  { value: "model_asc", label: "Model A-Z" },
  { value: "model_desc", label: "Model Z-A" },
];

export function RequestLoggerToolbar({
  recording,
  onToggleRecording,
  detailLoggingEnabled,
  detailLoggingLoading,
  onToggleDetailLogging,
  search,
  onSearchChange,
  selectedProvider,
  onProviderChange,
  selectedModel,
  onModelChange,
  selectedAccount,
  onAccountChange,
  selectedApiKey,
  onApiKeyChange,
  uniqueProviders,
  uniqueModels,
  uniqueAccounts,
  uniqueApiKeys,
  providerNodes,
  logs,
  stats,
  shownCount,
  sortBy,
  onSortChange,
  onRefresh,
}: RequestLoggerToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onToggleRecording}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
          recording ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
            : "bg-bg-subtle border-border text-text-muted"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${recording ? "bg-red-500 animate-pulse" : "bg-text-muted"}`}
        />
        {recording ? "Recording" : "Paused"}
      </button>

      <button
        onClick={onToggleDetailLogging}
        disabled={detailLoggingLoading}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-60 ${
          detailLoggingEnabled ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
            : "bg-bg-subtle border-border text-text-muted"
        }`}
        title="Capture pipeline payloads for new requests"
      >
        <span
          className={`w-2 h-2 rounded-full ${detailLoggingEnabled ? "bg-amber-500" : "bg-text-muted"}`}
        />
        {detailLoggingLoading ? "Updating pipeline logs..."
          : detailLoggingEnabled ? "Pipeline Logs On"
            : "Pipeline Logs Off"}
      </button>

      <div className="flex-1 min-w-[200px] relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
          search
        </span>
        <input
          type="text"
          placeholder="Search model, provider, account, API key, combo..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
      </div>

      <select
        value={selectedProvider}
        onChange={(event) => onProviderChange(event.target.value)}
        className="px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary focus:outline-none focus:border-primary appearance-none cursor-pointer min-w-[140px]"
      >
        <option value="">All Providers</option>
        {uniqueProviders.map((provider) => (
          <option key={provider} value={provider}>
            {getProviderOptionLabel(provider, providerNodes)}
          </option>
        ))}
      </select>

      <select
        value={selectedModel}
        onChange={(event) => onModelChange(event.target.value)}
        className="px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary focus:outline-none focus:border-primary appearance-none cursor-pointer min-w-[180px]"
      >
        <option value="">All Models</option>
        {uniqueModels.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>

      <select
        value={selectedAccount}
        onChange={(event) => onAccountChange(event.target.value)}
        className="px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary focus:outline-none focus:border-primary appearance-none cursor-pointer min-w-[140px]"
      >
        <option value="">All Accounts</option>
        {uniqueAccounts.map((account) => (
          <option key={account} value={account}>
            {account}
          </option>
        ))}
      </select>

      <select
        value={selectedApiKey}
        onChange={(event) => onApiKeyChange(event.target.value)}
        className="px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary focus:outline-none focus:border-primary appearance-none cursor-pointer min-w-[160px]"
      >
        <option value="">All API Keys</option>
        {uniqueApiKeys.map((value) => (
          <option key={value} value={value}>
            {getApiKeyOptionLabel(logs, value)}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="px-2 py-1 rounded bg-bg-subtle border border-border font-mono">
          {stats.totalCount} total
        </span>
        <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono">
          {stats.okCount} OK
        </span>
        {stats.errorCount > 0 && (
          <span className="px-2 py-1 rounded bg-red-500/10 text-red-700 dark:text-red-400 font-mono">
            {stats.errorCount} ERR
          </span>
        )}
        {stats.comboCount > 0 && (
          <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-700 dark:text-violet-400 font-mono">
            {stats.comboCount} combo
          </span>
        )}
        {stats.apiKeyCount > 0 && (
          <span className="px-2 py-1 rounded bg-primary/10 text-primary font-mono">
            {stats.apiKeyCount} keys
          </span>
        )}
        <span className="px-2 py-1 rounded bg-bg-subtle border border-border font-mono">
          {shownCount} shown
        </span>
      </div>

      <select
        value={sortBy}
        onChange={(event) => onSortChange(event.target.value as RequestLoggerSortKey)}
        className="px-3 py-2 rounded-lg bg-bg-subtle border border-border text-sm text-text-primary focus:outline-none focus:border-primary appearance-none cursor-pointer min-w-[150px]"
        title="Sort logs"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        onClick={onRefresh}
        className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors"
        title="Refresh"
      >
        <span className="material-symbols-outlined text-[18px]">refresh</span>
      </button>
    </div>
  );
}
