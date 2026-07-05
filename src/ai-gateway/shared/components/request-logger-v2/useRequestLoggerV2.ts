import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { persistVisibleColumns, loadVisibleColumns, buildLogsQuery, filterLogs, sortLogs, getUniqueAccounts, getUniqueApiKeys, getUniqueModels, getUniqueProviders, getLoggerStats } from "./requestLoggerUtils";
import { REQUEST_LOGGER_REFRESH_MS } from "./requestLoggerConfig";
import { logger } from '../logger.js';
import type {
ProviderNode,
  RequestLogEntry,
  RequestLoggerSortKey,
  RequestLoggerStatusFilter,
  RequestLoggerVisibleColumns,
} from "./requestLoggerTypes";

type RequestLoggerDetailState = Record<string, unknown> | null;

export function useRequestLoggerV2() {
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<RequestLoggerStatusFilter>("all");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [sortBy, setSortBy] = useState<RequestLoggerSortKey>("newest");
  const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<RequestLoggerDetailState>(null);
  const [detailLoggingEnabled, setDetailLoggingEnabled] = useState(false);
  const [detailLoggingLoading, setDetailLoggingLoading] = useState(false);
  const [providerNodes, setProviderNodes] = useState<ProviderNode[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<RequestLoggerVisibleColumns>(loadVisibleColumns);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchLogs = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }

      try {
        const query = buildLogsQuery({
          search,
          activeFilter,
          selectedModel,
          selectedAccount,
          selectedProvider,
          selectedApiKey,
        });

        const response = await fetch(`/api/usage/call-logs?${query}`);
        if (response.ok) {
          const data = (await response.json()) as RequestLogEntry[];
          setLogs(data);
        }
      } catch (error) {
        console.error("Failed to fetch call logs:", error);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    },
    [activeFilter, search, selectedAccount, selectedApiKey, selectedModel, selectedProvider]
  );

  useEffect(() => {
    const showLoading = !hasLoadedRef.current;
    hasLoadedRef.current = true;
    void fetchLogs(showLoading);
  }, [fetchLogs]);

  useEffect(() => {
    void fetch("/api/provider-nodes")
      .then((response) => (response.ok ? response.json() : { nodes: [] }))
      .then((data) => setProviderNodes(((data?.nodes as ProviderNode[]) || [])))
      .catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
  }, []);

  useEffect(() => {
    void fetch("/api/logs/detail?limit=1")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { enabled?: boolean } | null;
      })
      .then((data) => {
        if (!data) return;
        setDetailLoggingEnabled(data.enabled === true);
      })
      .catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (recording) {
      intervalRef.current = setInterval(() => {
        void fetchLogs(false);
      }, REQUEST_LOGGER_REFRESH_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLogs, recording]);

  const filteredLogs = useMemo(() => filterLogs(logs, activeFilter), [activeFilter, logs]);
  const sortedLogs = useMemo(() => sortLogs(filteredLogs, sortBy), [filteredLogs, sortBy]);
  const uniqueAccounts = useMemo(() => getUniqueAccounts(logs), [logs]);
  const uniqueModels = useMemo(() => getUniqueModels(logs), [logs]);
  const uniqueProviders = useMemo(() => getUniqueProviders(logs), [logs]);
  const uniqueApiKeys = useMemo(() => getUniqueApiKeys(logs), [logs]);
  const stats = useMemo(
    () => getLoggerStats(filteredLogs, logs, uniqueApiKeys),
    [filteredLogs, logs, uniqueApiKeys]
  );

  const toggleRecording = useCallback(() => {
    setRecording((current) => !current);
  }, []);

  const toggleColumn = useCallback((key: keyof RequestLoggerVisibleColumns) => {
    setVisibleColumns((previous) => {
      const next = { ...previous, [key]: !previous[key] };
      persistVisibleColumns(next);
      return next;
    });
  }, []);

  const openDetail = useCallback(async (logEntry: RequestLogEntry) => {
    setSelectedLog(logEntry);
    setDetailLoading(true);
    setDetailData(null);

    try {
      const response = await fetch(`/api/usage/call-logs/${logEntry.id}`);
      if (response.ok) {
        setDetailData((await response.json()) as Record<string, unknown>);
      }
    } catch (error) {
      console.error("Failed to fetch log detail:", error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedLog(null);
    setDetailData(null);
  }, []);

  const toggleDetailLogging = useCallback(async () => {
    setDetailLoggingLoading(true);

    try {
      const nextEnabled = !detailLoggingEnabled;
      const response = await fetch("/api/logs/detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update pipeline logging");
      }

      setDetailLoggingEnabled(nextEnabled);
    } catch (error) {
      console.error("Failed to toggle pipeline logging:", error);
    } finally {
      setDetailLoggingLoading(false);
    }
  }, [detailLoggingEnabled]);

  const refreshLogs = useCallback(() => {
    void fetchLogs(false);
  }, [fetchLogs]);

  return {
    logs,
    loading,
    recording,
    search,
    activeFilter,
    selectedModel,
    selectedAccount,
    selectedProvider,
    selectedApiKey,
    sortBy,
    selectedLog,
    detailLoading,
    detailData,
    detailLoggingEnabled,
    detailLoggingLoading,
    providerNodes,
    visibleColumns,
    sortedLogs,
    uniqueAccounts,
    uniqueModels,
    uniqueProviders,
    uniqueApiKeys,
    stats,
    setSearch,
    setActiveFilter,
    setSelectedModel,
    setSelectedAccount,
    setSelectedProvider,
    setSelectedApiKey,
    setSortBy,
    toggleRecording,
    toggleColumn,
    refreshLogs,
    openDetail,
    closeDetail,
    toggleDetailLogging,
  };
}
