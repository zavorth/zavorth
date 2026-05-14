"use client";

import { useCallback, useEffect, useState } from "react";

export function useHealthDashboardModel() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [cache, setCache] = useState<any>(null);
  const [signatureCache, setSignatureCache] = useState<any>(null);
  const [degradation, setDegradation] = useState<any>(null);
  const [resetting, setResetting] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const fetchExtras = useCallback(async () => {
    const results = await Promise.allSettled([
      fetch("/api/telemetry/summary").then((r) => r.json()),
      fetch("/api/cache/stats").then((r) => r.json()),
      fetch("/api/rate-limits").then((r) => r.json()),
      fetch("/api/health/degradation").then((r) => r.json()),
    ]);
    if (results[0].status === "fulfilled") setTelemetry(results[0].value);
    if (results[1].status === "fulfilled") setCache(results[1].value);
    if (results[2].status === "fulfilled" && results[2].value.cacheStats) {
      setSignatureCache(results[2].value.cacheStats);
    }
    if (results[3].status === "fulfilled") setDegradation(results[3].value);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchHealth(), fetchExtras()]);
  }, [fetchExtras, fetchHealth]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  const resetHealth = useCallback(
    async (confirmMessage: string) => {
      if (!window.confirm(confirmMessage)) return;
      setResetting(true);
      try {
        const res = await fetch("/api/monitoring/health", { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await refresh();
      } catch (err) {
        console.error("Failed to reset health:", err);
      } finally {
        setResetting(false);
      }
    },
    [refresh],
  );

  return {
    cache,
    data,
    degradation,
    error,
    lastRefresh,
    refresh,
    resetHealth,
    resetting,
    signatureCache,
    telemetry,
  };
}
