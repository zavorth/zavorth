"use client";

import { Card } from "@/shared/components";
import type { TranslateFn } from "./healthPageUtils";
import { formatBytes, formatUptime } from "./healthPageUtils";

type HealthPageOverviewProps = {
  cache: any;
  cbEntries: Array<[string, any]>;
  data: any;
  degradation: any;
  providerSummary: any;
  signatureCache: any;
  system: any;
  t: TranslateFn;
  telemetry: any;
};

export function HealthPageOverview(props: HealthPageOverviewProps) {
  const { cache, cbEntries, data, degradation, providerSummary, signatureCache, system, t, telemetry } = props;
  const fmtMs = (ms: number | null | undefined) =>
    ms != null ? t("millisecondsShort", { value: Math.round(ms) }) : t("notAvailable");

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl p-4 flex items-center gap-3 ${
          data.status === "healthy"
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-red-500/10 border border-red-500/20"
        }`}
      >
        <span
          className={`material-symbols-outlined text-[24px] ${
            data.status === "healthy" ? "text-green-500" : "text-red-500"
          }`}
        >
          {data.status === "healthy" ? "check_circle" : "error"}
        </span>
        <span className={data.status === "healthy" ? "text-green-400" : "text-red-400"}>
          {data.status === "healthy" ? t("allOperational") : t("issuesDetected")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[18px]">timer</span>
            </div>
            <span className="text-sm text-text-muted">{t("uptime")}</span>
          </div>
          <p className="text-xl font-semibold text-text-main">{formatUptime(system.uptime)}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-blue-500/10 text-blue-500">
              <span className="material-symbols-outlined text-[18px]">info</span>
            </div>
            <span className="text-sm text-text-muted">{t("version")}</span>
          </div>
          <p className="text-xl font-semibold text-text-main">v{system.version}</p>
          <p className="text-xs text-text-muted mt-1">
            {t("nodeVersion", { version: system.nodeVersion })}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-purple-500/10 text-purple-500">
              <span className="material-symbols-outlined text-[18px]">memory</span>
            </div>
            <span className="text-sm text-text-muted">{t("memoryRss")}</span>
          </div>
          <p className="text-xl font-semibold text-text-main">
            {formatBytes(system.memoryUsage?.rss || 0)}
          </p>
          <p className="text-xs text-text-muted mt-1">
            {t("heap")}: {formatBytes(system.memoryUsage?.heapUsed || 0)} /{" "}
            {formatBytes(system.memoryUsage?.heapTotal || 0)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-amber-500/10 text-amber-500">
              <span className="material-symbols-outlined text-[18px]">dns</span>
            </div>
            <span className="text-sm text-text-muted">{t("providers")}</span>
          </div>
          <p className="text-xl font-semibold text-text-main">
            {providerSummary?.configuredCount ?? cbEntries.length}
          </p>
          <p
            className="text-[11px] text-text-muted mt-1 inline-flex items-center gap-1"
            title={t("configuredProvidersHint")}
          >
            {t("configuredProvidersLabel")}
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              help
            </span>
          </p>
          <p
            className="text-xs text-text-muted inline-flex items-center gap-1"
            title={t("activeProvidersHint")}
          >
            {t("activeProviders", { count: providerSummary?.activeCount ?? 0 })}
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              info
            </span>
          </p>
          <p
            className="text-xs text-text-muted inline-flex items-center gap-1"
            title={t("monitoredProvidersHint")}
          >
            {t("monitoredProviders", { count: providerSummary?.monitoredCount ?? cbEntries.length })}
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              info
            </span>
          </p>
        </Card>
      </div>

      {degradation && degradation.features && degradation.features.length > 0 && (
        <Card className="p-5" role="region" aria-label="Graceful Degradation Status">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">healing</span>
              Graceful Degradation Status
            </h2>
            <div className="flex items-center gap-3 text-xs text-text-muted font-medium">
              <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400">
                Full: {degradation.summary.full}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                Reduced: {degradation.summary.reduced}
              </span>
              <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-500">
                Minimal: {degradation.summary.minimal}
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-500">
                Default: {degradation.summary.default}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {degradation.features.map((feat: any) => {
              const bg =
                feat.level === "full"
                  ? "bg-green-500/5 border-green-500/10"
                  : feat.level === "reduced"
                    ? "bg-amber-500/5 border-amber-500/20"
                    : feat.level === "minimal"
                      ? "bg-orange-500/5 border-orange-500/20"
                      : "bg-red-500/5 border-red-500/20";
              const dot =
                feat.level === "full"
                  ? "bg-green-500"
                  : feat.level === "reduced"
                    ? "bg-amber-500"
                    : feat.level === "minimal"
                      ? "bg-orange-500"
                      : "bg-red-500";
              return (
                <div key={feat.feature} className={`rounded-lg p-3 border ${bg} flex flex-col gap-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize flex items-center gap-2 text-[var(--text-primary,#fff)]">
                      <span className={`w-2 h-2 rounded-full ${dot}`} />
                      {feat.feature}
                    </span>
                    <span className="text-xs uppercase tracking-wider font-bold opacity-70">
                      {feat.level}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary,#aaa)]">{feat.capability}</div>
                  {feat.reason && (
                    <div
                      className="text-[10px] text-red-300 mt-1 bg-red-900/20 p-1.5 rounded"
                      title={feat.reason}
                    >
                      {feat.reason.length > 80 ? `${feat.reason.substring(0, 80)}...` : feat.reason}
                    </div>
                  )}
                  <div className="text-[10px] text-[var(--text-muted,#666)] text-right mt-1">
                    Since {new Date(feat.since).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-muted mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">speed</span>
            {t("latency")}
          </h3>
          {telemetry ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">{t("latencyP50")}</span>
                <span className="font-mono">{fmtMs(telemetry.p50)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("latencyP95")}</span>
                <span className="font-mono">{fmtMs(telemetry.p95)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("latencyP99")}</span>
                <span className="font-mono">{fmtMs(telemetry.p99)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 mt-2">
                <span className="text-text-muted">{t("totalRequests")}</span>
                <span className="font-mono">{telemetry.totalRequests ?? 0}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("noDataYet")}</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-muted mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">cached</span>
            {t("promptCache")}
          </h3>
          {cache ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">{t("entries")}</span>
                <span className="font-mono">
                  {cache.size}/{cache.maxSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("hitRate")}</span>
                <span className="font-mono">{cache.hitRate?.toFixed(1) ?? 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("hitsMisses")}</span>
                <span className="font-mono">
                  {cache.hits ?? 0} / {cache.misses ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("noDataYet")}</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-text-muted mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">database</span>
            {t("signatureCache")}
          </h3>
          {signatureCache ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t("signatureDefaults"), value: signatureCache.defaultCount, color: "text-text-muted" },
                { label: t("signatureTool"), value: `${signatureCache.tool.entries}/${signatureCache.tool.patterns}`, color: "text-blue-400" },
                { label: t("signatureFamily"), value: `${signatureCache.family.entries}/${signatureCache.family.patterns}`, color: "text-purple-400" },
                { label: t("signatureSession"), value: `${signatureCache.session.entries}/${signatureCache.session.patterns}`, color: "text-cyan-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-2 rounded-lg bg-surface/30 border border-border/30">
                  <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-xs text-text-muted mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">{t("noDataYet")}</p>
          )}
        </Card>
      </div>
    </>
  );
}
