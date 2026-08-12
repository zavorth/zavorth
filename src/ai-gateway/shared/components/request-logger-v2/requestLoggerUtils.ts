import { PROVIDER_COLORS } from "@/shared/constants/colors";
import { formatApiKeyLabel } from "@/shared/utils/formatting";
import {
  DEFAULT_VISIBLE,
  LOGGER_VISIBLE_COLUMNS_STORAGE_KEY,
  REQUEST_LOGGER_LIMIT,
} from "./requestLoggerConfig";
import { logger } from '@/shared/utils/logger';
import { asErrorLike } from '../../../../utils/errorLike';

import type {
ProviderNode,
  RequestLogEntry,
  RequestLoggerSortKey,
  RequestLoggerStats,
  RequestLoggerVisibleColumns,
} from "./requestLoggerTypes";

export function getProviderDisplayLabel(
  provider: string | undefined,
  providerNodes: ProviderNode[] = []
): string | null {
  if (!provider) return "-";
  if (provider.startsWith("openai-compatible-") || provider.startsWith("anthropic-compatible-")) {
    const matchedNode = providerNodes.find((node) => node.id === provider || node.prefix === provider);
    if (matchedNode?.name) return matchedNode.name;

    if (provider.startsWith("openai-compatible-")) {
      const suffix = provider.replace("openai-compatible-", "");
      const parts = suffix.split("-");
      if (parts.length > 1 && parts[1]?.length >= 8) return "OAI-COMPAT";
      return `OAI: ${suffix.slice(0, 16).toUpperCase()}`;
    }

    const suffix = provider.replace("anthropic-compatible-", "");
    const parts = suffix.split("-");
    if (parts.length > 1 && parts[1]?.length >= 8) return "ANT-COMPAT";
    return `ANT: ${suffix.slice(0, 16).toUpperCase()}`;
  }

  return null;
}

export function getLogTotalTokens(log: RequestLogEntry): number {
  return (log.tokens?.in || 0) + (log.tokens?.out || 0);
}

export function loadVisibleColumns(): RequestLoggerVisibleColumns {
  if (typeof window === "undefined") {
    return DEFAULT_VISIBLE;
  }

  try {
    const saved = localStorage.getItem(LOGGER_VISIBLE_COLUMNS_STORAGE_KEY);
    return saved ? { ...DEFAULT_VISIBLE, ...JSON.parse(saved) } : DEFAULT_VISIBLE;
  } catch (error: unknown) {logger.warn('[request Logger Utils] JSON parse failed', error); return DEFAULT_VISIBLE; }
}

export function persistVisibleColumns(next: RequestLoggerVisibleColumns): void {
  try {
    localStorage.setItem(LOGGER_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(next));
  } catch (error: unknown) {
    const err = asErrorLike(error);
    logger.warn("[auto-fix] Empty catch block", err); }
}

export function buildLogsQuery(params: {
  search: string;
  activeFilter: string;
  selectedModel: string;
  selectedAccount: string;
  selectedProvider: string;
  selectedApiKey: string;
}): string {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.activeFilter === "error") query.set("status", "error");
  if (params.activeFilter === "ok") query.set("status", "ok");
  if (params.activeFilter === "combo") query.set("combo", "1");
  if (params.selectedModel) query.set("model", params.selectedModel);
  if (params.selectedProvider) query.set("provider", params.selectedProvider);
  if (params.selectedAccount) query.set("account", params.selectedAccount);
  if (params.selectedApiKey) query.set("apiKey", params.selectedApiKey);
  query.set("limit", REQUEST_LOGGER_LIMIT);

  return query.toString();
}

export function filterLogs(
  logs: RequestLogEntry[],
  activeFilter: string
): RequestLogEntry[] {
  if (activeFilter === "combo") {
    return logs.filter((log) => Boolean(log.comboName));
  }

  return logs;
}

export function sortLogs(
  logs: RequestLogEntry[],
  sortBy: RequestLoggerSortKey
): RequestLogEntry[] {
  const sorted = [...logs];

  sorted.sort((left, right) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(left.timestamp) - toTimestamp(right.timestamp);
      case "tokens_desc":
        return getLogTotalTokens(right) - getLogTotalTokens(left);
      case "tokens_asc":
        return getLogTotalTokens(left) - getLogTotalTokens(right);
      case "duration_desc":
        return (right.duration || 0) - (left.duration || 0);
      case "duration_asc":
        return (left.duration || 0) - (right.duration || 0);
      case "status_desc":
        return (right.status || 0) - (left.status || 0);
      case "status_asc":
        return (left.status || 0) - (right.status || 0);
      case "model_asc":
        return (left.model || "").localeCompare(right.model || "");
      case "model_desc":
        return (right.model || "").localeCompare(left.model || "");
      case "newest":
      default:
        return toTimestamp(right.timestamp) - toTimestamp(left.timestamp);
    }
  });

  return sorted;
}

function toTimestamp(value: string | undefined): number {
  if (!value) return 0;
  return new Date(value).getTime();
}

export function getUniqueAccounts(logs: RequestLogEntry[]): string[] {
  return [...new Set(logs.map((log) => log.account).filter((account) => account && account !== "-"))];
}

export function getUniqueModels(logs: RequestLogEntry[]): string[] {
  return [
    ...new Set(
      logs.flatMap((log) => [log.model, log.requestedModel]).filter((value): value is string => Boolean(value))
    ),
  ].sort();
}

export function getUniqueProviders(logs: RequestLogEntry[]): string[] {
  return [...new Set(logs.map((log) => log.provider).filter((provider): provider is string => Boolean(provider && provider !== "-")))].sort();
}

export function getUniqueApiKeys(logs: RequestLogEntry[]): string[] {
  return [...new Set(logs.map((log) => log.apiKeyId || log.apiKeyName).filter((value): value is string => Boolean(value)))].sort();
}

export function getLoggerStats(
  filteredLogs: RequestLogEntry[],
  allLogs: RequestLogEntry[],
  uniqueApiKeys: string[]
): RequestLoggerStats {
  return {
    totalCount: filteredLogs.length,
    okCount: filteredLogs.filter((log) => (log.status || 0) >= 200 && (log.status || 0) < 300).length,
    errorCount: filteredLogs.filter((log) => (log.status || 0) >= 400).length,
    comboCount: allLogs.filter((log) => Boolean(log.comboName)).length,
    apiKeyCount: uniqueApiKeys.length,
  };
}

export function getApiKeyOptionLabel(logs: RequestLogEntry[], value: string): string {
  const matched = logs.find((log) => (log.apiKeyId || log.apiKeyName) === value);
  return formatApiKeyLabel(matched?.apiKeyName, matched?.apiKeyId);
}

export function getProviderOptionLabel(
  provider: string,
  providerNodes: ProviderNode[]
): string {
  const compatLabel = getProviderDisplayLabel(provider, providerNodes);
  return compatLabel || PROVIDER_COLORS[provider]?.label || provider.toUpperCase();
}
