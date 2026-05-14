"use client";

import { Card } from "@/shared/components";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import type { TranslateFn } from "./healthPageUtils";
import { CB_STYLES } from "./healthPageUtils";

type HealthPageProvidersProps = {
  cbEntries: Array<[string, any]>;
  lockoutEntries: Array<[string, any]>;
  onResetHealth: () => void;
  rateLimitStatus: Record<string, any> | null | undefined;
  resetting: boolean;
  t: TranslateFn;
  tc: TranslateFn;
  tp: TranslateFn;
};

export function HealthPageProviders(props: HealthPageProvidersProps) {
  const { cbEntries, lockoutEntries, onResetHealth, rateLimitStatus, resetting, t, tc, tp } = props;

  return (
    <>
      <Card className="p-5" role="region" aria-label={t("providerHealthStatusAria")}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">health_and_safety</span>
            {t("providerHealth")}
          </h2>
          <div className="flex items-center gap-3">
            {cbEntries.some(([, cb]) => cb.state !== "CLOSED") && (
              <button
                onClick={onResetHealth}
                disabled={resetting}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  resetting
                    ? "bg-surface/50 text-text-muted cursor-wait"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-red-500/20"
                }`}
                title={t("resetAllTitle")}
              >
                {resetting ? (
                  <>
                    <span className="material-symbols-outlined text-[14px] animate-spin">
                      progress_activity
                    </span>
                    {t("resetting")}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    {t("resetAll")}
                  </>
                )}
              </button>
            )}
            {cbEntries.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-green-500" /> {t("healthy")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-amber-500" /> {t("recovering")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-red-500" /> {t("down")}
                </span>
              </div>
            )}
          </div>
        </div>
        {cbEntries.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">{t("noCBData")}</p>
        ) : (
          <ProviderHealthGrid cbEntries={cbEntries} t={t} />
        )}
      </Card>

      {rateLimitStatus && Object.keys(rateLimitStatus).length > 0 && (
        <RateLimitCard rateLimitStatus={rateLimitStatus} t={t} tc={tc} tp={tp} />
      )}

      {lockoutEntries.length > 0 && (
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-text-main mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-red-500">lock</span>
            {t("activeLockouts")}
          </h2>
          <div className="space-y-2">
            {lockoutEntries.map(([key, lockout]) => (
              <div
                key={key}
                className="rounded-lg p-3 bg-red-500/5 border border-red-500/10 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-text-main">{key}</span>
                  {lockout.reason && (
                    <span className="text-xs text-text-muted ml-2">({lockout.reason})</span>
                  )}
                </div>
                {lockout.until && (
                  <span className="text-xs text-red-400">
                    {t("until", { time: new Date(lockout.until).toLocaleTimeString() })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function ProviderHealthGrid({ cbEntries, t }: { cbEntries: Array<[string, any]>; t: TranslateFn }) {
  const unhealthy = cbEntries.filter(([, cb]) => cb.state !== "CLOSED");
  const healthy = cbEntries.filter(([, cb]) => cb.state === "CLOSED");

  return (
    <div className="space-y-4">
      {unhealthy.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-red-400 uppercase tracking-wide">{t("issuesLabel")}</p>
          {unhealthy.map(([provider, cb]) => {
            const style = CB_STYLES[cb.state] || CB_STYLES.OPEN;
            const providerInfo = AI_PROVIDERS[provider];
            const displayName = providerInfo?.name || provider;
            return (
              <div
                key={provider}
                className={`rounded-lg p-3 ${style.bg} border border-white/5 flex items-center gap-3`}
              >
                <div
                  className="size-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    backgroundColor: `${providerInfo?.color || "#888"}15`,
                    color: providerInfo?.color || "#888",
                  }}
                >
                  {providerInfo?.textIcon || provider.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-main truncate">{displayName}</span>
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                      {t(style.labelKey)}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    {cb.failures === 1 ? t("failures", { count: cb.failures }) : t("failuresPlural", { count: cb.failures })}
                    {cb.lastFailure && (
                      <span className="ml-2">
                        · {t("lastFailure")}: {new Date(cb.lastFailure).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {healthy.length > 0 && (
        <div>
          {unhealthy.length > 0 && (
            <p className="text-xs font-medium text-green-400 uppercase tracking-wide mb-2">
              {t("operational")}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {healthy.map(([provider]) => {
              const providerInfo = AI_PROVIDERS[provider];
              const displayName = providerInfo?.name || provider;
              return (
                <div
                  key={provider}
                  className="rounded-lg p-2.5 bg-green-500/5 border border-white/5 flex items-center gap-2"
                >
                  <span className="size-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs font-medium text-text-main truncate" title={displayName}>
                    {displayName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RateLimitCard(props: {
  rateLimitStatus: Record<string, any>;
  t: TranslateFn;
  tc: TranslateFn;
  tp: TranslateFn;
}) {
  const { rateLimitStatus, t, tc, tp } = props;

  const entries = Object.entries(rateLimitStatus)
    .map(([key, status]) => ({ key, status, ...parseRateLimitKey(key, tp) }))
    .sort((a, b) => {
      const aActive = (a.status.queued || 0) + (a.status.running || 0);
      const bActive = (b.status.queued || 0) + (b.status.running || 0);
      if (aActive !== bActive) return bActive - aActive;
      return a.displayName.localeCompare(b.displayName);
    });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-amber-500">speed</span>
          {t("rateLimitStatus")}
        </h2>
        <span className="text-xs text-text-muted">
          {entries.length === 1
            ? t("activeLimiters", { count: entries.length })
            : t("activeLimitersPlural", { count: entries.length })}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(({ key, displayName, providerInfo, connectionId, model, status }) => {
          const isActive = (status.queued || 0) + (status.running || 0) > 0;
          const isQueued = (status.queued || 0) > 0;
          return (
            <div
              key={key}
              className={`rounded-lg p-3 border transition-colors ${
                isQueued
                  ? "bg-amber-500/5 border-amber-500/20"
                  : isActive
                    ? "bg-blue-500/5 border-blue-500/15"
                    : "bg-surface/30 border-white/5"
              }`}
              title={key}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className="size-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold"
                  style={{
                    backgroundColor: `${providerInfo?.color || "#888"}15`,
                    color: providerInfo?.color || "#888",
                  }}
                >
                  {providerInfo?.textIcon || displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-main truncate">{displayName}</p>
                  {connectionId && (
                    <p className="text-[10px] text-text-muted font-mono truncate">
                      {connectionId.length > 12 ? `${connectionId.slice(0, 8)}…` : connectionId}
                      {model && <span className="ml-1 text-text-muted/60">· {model}</span>}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    isQueued
                      ? "bg-amber-500/15 text-amber-400"
                      : isActive
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-green-500/10 text-green-400"
                  }`}
                >
                  {isQueued ? t("queued") : isActive ? tc("active") : t("ok")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">schedule</span>
                  {t("queuedCount", { count: status.queued || 0 })}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">play_arrow</span>
                  {t("runningCount", { count: status.running || 0 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function parseRateLimitKey(key: string, tp: TranslateFn) {
  const parts = key.split(":");
  const providerId = parts[0];
  const connectionId = parts[1] || "";
  const model = parts.slice(2).join(":") || null;

  let displayName: string;
  let providerInfo = AI_PROVIDERS[providerId];

  if (providerId.startsWith("openai-compatible-")) {
    const customName = providerId.replace("openai-compatible-", "");
    displayName = tp("openaiCompatibleName");
    providerInfo = { color: "#10A37F", textIcon: "OC" };
    if (customName.length > 12) displayName += ` (${customName.slice(0, 8)}…)`;
    else if (customName) displayName += ` (${customName})`;
  } else if (providerId.startsWith("anthropic-compatible-")) {
    const customName = providerId.replace("anthropic-compatible-", "");
    displayName = tp("anthropicCompatibleName");
    providerInfo = { color: "#D97757", textIcon: "AC" };
    if (customName.length > 12) displayName += ` (${customName.slice(0, 8)}…)`;
    else if (customName) displayName += ` (${customName})`;
  } else {
    displayName = providerInfo?.name || providerId;
  }

  return { connectionId, displayName, model, providerId, providerInfo };
}
