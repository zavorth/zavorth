"use client";

import Image from "next/image";
import Badge from "@/shared/components/Badge";
import { pickMaskedDisplayValue } from "@/shared/utils/maskEmail";
import {
  calculatePercentage,
  formatQuotaLabel,
  normalizePlanTier,
} from "../utils";
import {
  formatCountdown,
  getBarColor,
  PROVIDER_CONFIG,
} from "./providerLimitsConfig";

export function ProviderLimitRow({
  t,
  conn,
  isLast,
  quota,
  isLoading,
  error,
  tierMeta,
  resolvedPlan,
  refreshedAt,
  onRefreshProvider,
}) {
  const config = PROVIDER_CONFIG[conn.provider] || {
    label: conn.provider,
    color: "#666",
  };
  const normalizedTier = tierMeta || normalizePlanTier(null);

  return (
    <div
      key={conn.id}
      className="items-center px-4 py-3.5 transition-[background] duration-150 hover:bg-black/[0.03] dark:hover:bg-white/[0.02]"
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 128px 48px",
        borderBottom: !isLast ? "1px solid var(--color-border)" : "none",
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
          <Image
            src={`/providers/${conn.provider}.png`}
            alt={conn.provider}
            width={32}
            height={32}
            className="object-contain"
            sizes="32px"
          />
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text-main truncate">
            {pickMaskedDisplayValue(
              [conn.name, conn.displayName, conn.email],
              config.label,
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 min-h-5">
            <span
              title={
                resolvedPlan
                  ? t("rawPlanWithValue", { plan: resolvedPlan })
                  : t("noPlanFromProvider")
              }
              className="inline-flex items-center shrink-0"
            >
              <Badge
                variant={normalizedTier.variant}
                size="sm"
                dot
                className="h-5 leading-none"
              >
                {normalizedTier.label}
              </Badge>
            </span>
            <span className="text-[11px] leading-none text-text-muted">
              {config.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 pr-3">
        {isLoading ? (
          <div className="flex items-center gap-1.5 text-text-muted text-xs">
            <span className="material-symbols-outlined animate-spin text-[14px]">
              progress_activity
            </span>
            {t("loadingQuotas")}
          </div>
        ) : error ? (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <span className="material-symbols-outlined text-[14px]">error</span>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[300px]">
              {error}
            </span>
          </div>
        ) : quota?.message && (!quota.quotas || quota.quotas.length === 0) ? (
          <div className="text-xs text-text-muted italic">{quota.message}</div>
        ) : quota?.quotas?.length > 0 ? (
          quota.quotas.map((q, i) => {
            const remainingPercentage = q.unlimited
              ? 100
              : (q.remainingPercentage ?? calculatePercentage(q.used, q.total));
            const colors = getBarColor(remainingPercentage);
            const cd = formatCountdown(q.resetAt);
            const shortName = formatQuotaLabel(q.name);
            const staleAfterReset = q.staleAfterReset === true;

            return (
              <div
                key={i}
                className={`flex items-center gap-1.5 min-w-[200px] shrink-0 ${
                  i > 0 ? "border-l border-border/80 pl-3 ml-1" : ""
                }`}
              >
                <span
                  title={q.modelKey || q.name}
                  className="text-[11px] font-semibold py-0.5 px-2 rounded whitespace-nowrap min-w-[60px] text-center"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {shortName}
                </span>

                {staleAfterReset ? (
                  <span className="text-[10px] text-text-muted whitespace-nowrap">
                    Refreshing...
                  </span>
                ) : cd ? (
                  <span className="text-[10px] text-text-muted whitespace-nowrap">
                    {cd}
                  </span>
                ) : null}

                <div className="flex-1 h-1.5 rounded-sm bg-black/[0.06] dark:bg-white/[0.06] min-w-[60px] overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-[width] duration-300 ease-out"
                    style={{
                      width: `${Math.min(remainingPercentage, 100)}%`,
                      background: colors.bar,
                    }}
                  />
                </div>

                <span
                  className="text-[11px] font-semibold min-w-[32px] text-right"
                  style={{ color: colors.text }}
                >
                  {remainingPercentage}%
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-text-muted italic">
            {t("noQuotaData")}
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-text-muted">
        {refreshedAt ? (
          <span>
            {new Date(refreshedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })}
          </span>
        ) : (
          "-"
        )}
      </div>

      <div className="flex justify-center gap-0.5">
        <button
          onClick={() => onRefreshProvider(conn.id, conn.provider)}
          disabled={isLoading}
          title={t("refreshQuota")}
          className="p-1 rounded-md border-none bg-transparent cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 opacity-60 hover:opacity-100 flex items-center justify-center transition-opacity duration-150"
        >
          <span
            className={`material-symbols-outlined text-[16px] text-text-muted ${isLoading ? "animate-spin" : ""}`}
          >
            refresh
          </span>
        </button>
      </div>
    </div>
  );
}
