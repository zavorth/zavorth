"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";
import { normalizePlanTier, parseQuotaData, resolvePlanValue } from "../utils";
import {
  LS_EXPANDED_GROUPS,
  LS_GROUP_BY,
  MIN_FETCH_INTERVAL_MS,
} from "./providerLimitsConfig";

export function useProviderLimits() {
  const t = useTranslations("usage");
  const [connections, setConnections] = useState([]);
  const [quotaData, setQuotaData] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<
    Record<string, string>
  >({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<"none" | "environment">(() => {
    if (typeof window === "undefined") return "none";
    const saved = localStorage.getItem(LS_GROUP_BY);
    if (saved === "environment" || saved === "none") return saved;
    return "none";
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(LS_EXPANDED_GROUPS);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const lastFetchTimeRef = useRef({});
  const staleProbeRef = useRef({});

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/providers/client");
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      const list = data.connections || [];
      setConnections(list);
      return list;
    } catch {
      setConnections([]);
      return [];
    }
  }, []);

  const applyCachedQuotaState = useCallback((connectionList, caches) => {
    const nextQuotaData = {};
    const nextLastRefreshedAt = {};

    for (const conn of connectionList) {
      const cached = caches?.[conn.id];
      if (!cached) continue;

      nextQuotaData[conn.id] = {
        quotas: parseQuotaData(conn.provider, cached),
        plan: cached.plan || null,
        message: cached.message || null,
        raw: cached,
      };

      if (cached.fetchedAt) {
        nextLastRefreshedAt[conn.id] = cached.fetchedAt;
      }
    }

    setQuotaData(nextQuotaData);
    setLastRefreshedAt(nextLastRefreshedAt);
  }, []);

  const fetchCachedProviderLimits = useCallback(async () => {
    try {
      const response = await fetch("/api/usage/provider-limits");
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      return data.caches || {};
    } catch {
      return {};
    }
  }, []);

  const fetchQuota = useCallback(
    async (connectionId, provider, options: { force?: boolean } = {}) => {
      const force = options?.force === true;
      const now = Date.now();
      const lastFetch = lastFetchTimeRef.current[connectionId] || 0;
      if (!force && now - lastFetch < MIN_FETCH_INTERVAL_MS) {
        return;
      }
      lastFetchTimeRef.current[connectionId] = now;

      setLoading((prev) => ({ ...prev, [connectionId]: true }));
      setErrors((prev) => ({ ...prev, [connectionId]: null }));
      try {
        const response = await fetch(`/api/usage/${connectionId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.error || response.statusText;
          if (response.status === 404) return;
          if (response.status === 401) {
            setQuotaData((prev) => ({
              ...prev,
              [connectionId]: { quotas: [], message: errorMsg },
            }));
            return;
          }
          throw new Error(`HTTP ${response.status}: ${errorMsg}`);
        }
        const data = await response.json();
        const parsedQuotas = parseQuotaData(provider, data);

        const hasStaleAfterReset = parsedQuotas.some(
          (q) => q?.staleAfterReset === true,
        );
        if (hasStaleAfterReset) {
          const lastProbeAt = staleProbeRef.current[connectionId] || 0;
          if (Date.now() - lastProbeAt >= MIN_FETCH_INTERVAL_MS) {
            staleProbeRef.current[connectionId] = Date.now();
            setTimeout(() => {
              fetchQuota(connectionId, provider, { force: true }).catch(
                () => {},
              );
            }, 5000);
          }
        }

        setQuotaData((prev) => ({
          ...prev,
          [connectionId]: {
            quotas: parsedQuotas,
            plan: data.plan || null,
            message: data.message || null,
            raw: data,
          },
        }));
        setLastRefreshedAt((prev) => ({
          ...prev,
          [connectionId]: new Date().toISOString(),
        }));
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          [connectionId]: error.message || "Failed to fetch quota",
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [connectionId]: false }));
      }
    },
    [],
  );

  const refreshProvider = useCallback(
    async (connectionId, provider) => {
      await fetchQuota(connectionId, provider, { force: true });
    },
    [fetchQuota],
  );

  const refreshAll = useCallback(async () => {
    if (refreshingAll) return;
    setRefreshingAll(true);
    try {
      const response = await fetch("/api/usage/provider-limits", {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || response.statusText;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const connectionList = await fetchConnections();
      applyCachedQuotaState(connectionList, data.caches || {});
      setErrors(data.errors || {});
    } catch (error) {
      console.error("Error refreshing all:", error);
    } finally {
      setRefreshingAll(false);
    }
  }, [refreshingAll, applyCachedQuotaState, fetchConnections]);

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      const [connectionList, caches] = await Promise.all([
        fetchConnections(),
        fetchCachedProviderLimits(),
      ]);
      applyCachedQuotaState(connectionList, caches);
      setInitialLoading(false);
    };
    init().catch(() => {
      setInitialLoading(false);
    });
  }, [applyCachedQuotaState, fetchCachedProviderLimits, fetchConnections]);

  const filteredConnections = useMemo(
    () =>
      connections.filter(
        (conn) =>
          USAGE_SUPPORTED_PROVIDERS.includes(conn.provider) &&
          (conn.authType === "oauth" || conn.authType === "apikey"),
      ),
    [connections],
  );

  const sortedConnections = useMemo(() => {
    const priority = {
      zavorthBridge: 1,
      "gemini-cli": 2,
      github: 3,
      codex: 4,
      claude: 5,
      kiro: 6,
      glm: 7,
      "kimi-coding": 8,
    };
    return [...filteredConnections].sort(
      (a, b) => (priority[a.provider] || 9) - (priority[b.provider] || 9),
    );
  }, [filteredConnections]);

  const resolvedPlanByConnection = useMemo(() => {
    const out = {};
    for (const conn of sortedConnections) {
      out[conn.id] = resolvePlanValue(
        quotaData[conn.id]?.plan,
        conn.providerSpecificData,
      );
    }
    return out;
  }, [sortedConnections, quotaData]);

  const tierByConnection = useMemo(() => {
    const out = {};
    for (const conn of sortedConnections) {
      out[conn.id] = normalizePlanTier(resolvedPlanByConnection[conn.id]);
    }
    return out;
  }, [sortedConnections, resolvedPlanByConnection]);

  const tierCounts = useMemo(() => {
    const counts = {
      all: sortedConnections.length,
      enterprise: 0,
      team: 0,
      business: 0,
      ultra: 0,
      pro: 0,
      plus: 0,
      free: 0,
      unknown: 0,
    };
    for (const conn of sortedConnections) {
      const tierKey = tierByConnection[conn.id]?.key || "unknown";
      counts[tierKey] = (counts[tierKey] || 0) + 1;
    }
    return counts;
  }, [sortedConnections, tierByConnection]);

  const visibleConnections = useMemo(() => {
    if (tierFilter === "all") return sortedConnections;
    return sortedConnections.filter(
      (conn) => (tierByConnection[conn.id]?.key || "unknown") === tierFilter,
    );
  }, [sortedConnections, tierByConnection, tierFilter]);

  const groupedConnections = useMemo(() => {
    if (groupBy !== "environment") return null;
    const groups = new Map();
    for (const conn of visibleConnections) {
      const key =
        (conn.providerSpecificData?.tag as string | undefined)?.trim() ||
        t("ungrouped");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(conn);
    }

    return new Map(
      [...groups.entries()].sort(([a], [b]) => {
        if (a === t("ungrouped")) return 1;
        if (b === t("ungrouped")) return -1;
        return a.localeCompare(b);
      }),
    );
  }, [groupBy, visibleConnections, t]);

  const handleSetGroupBy = (value: "none" | "environment") => {
    setGroupBy(value);
    localStorage.setItem(LS_GROUP_BY, value);
  };

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupName) ? next.delete(groupName) : next.add(groupName);
      localStorage.setItem(LS_EXPANDED_GROUPS, JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSaved = localStorage.getItem(LS_GROUP_BY) !== null;
    if (
      !hasSaved &&
      connections.some((c) =>
        (c.providerSpecificData?.tag as string | undefined)?.trim(),
      )
    ) {
      setGroupBy("environment");
    }
  }, [connections]);

  useEffect(() => {
    if (groupBy !== "environment" || !groupedConnections) return;
    setExpandedGroups((prev) => {
      if (prev.size === 0) {
        const allGroups = new Set([...groupedConnections.keys()]);
        localStorage.setItem(LS_EXPANDED_GROUPS, JSON.stringify([...allGroups]));
        return allGroups;
      }
      return prev;
    });
  }, [groupBy, groupedConnections]);

  return {
    t,
    sortedConnections,
    visibleConnections,
    tierCounts,
    tierFilter,
    setTierFilter,
    groupBy,
    handleSetGroupBy,
    refreshingAll,
    refreshAll,
    initialLoading,
    groupedConnections,
    expandedGroups,
    toggleGroup,
    quotaData,
    loading,
    errors,
    lastRefreshedAt,
    tierByConnection,
    resolvedPlanByConnection,
    refreshProvider,
  };
}
