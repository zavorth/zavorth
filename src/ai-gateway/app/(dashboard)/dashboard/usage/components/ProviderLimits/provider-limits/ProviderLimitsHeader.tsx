"use client";

export function ProviderLimitsHeader({
  t,
  visibleCount,
  totalCount,
  groupBy,
  onSetGroupBy,
  onRefreshAll,
  refreshingAll,
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-text-main m-0">
          {t("providerLimits")}
        </h2>
        <span className="text-[13px] text-text-muted">
          {t("accountsCount", { count: visibleCount })}
          {visibleCount !== totalCount &&
            ` ${t("filteredFromCount", { count: totalCount })}`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => onSetGroupBy("none")}
            className="px-2.5 py-1.5 text-[12px] font-medium cursor-pointer border-none"
            style={{
              background:
                groupBy === "none" ? "var(--color-bg-subtle)" : "transparent",
              color:
                groupBy === "none"
                  ? "var(--color-text-main)"
                  : "var(--color-text-muted)",
            }}
          >
            {t("viewFlat")}
          </button>
          <button
            onClick={() => onSetGroupBy("environment")}
            className="px-2.5 py-1.5 text-[12px] font-medium cursor-pointer border-none"
            style={{
              background:
                groupBy === "environment"
                  ? "var(--color-bg-subtle)"
                  : "transparent",
              color:
                groupBy === "environment"
                  ? "var(--color-text-main)"
                  : "var(--color-text-muted)",
              borderLeft: "1px solid var(--color-border)",
            }}
          >
            {t("viewByEnvironment")}
          </button>
        </div>

        <button
          onClick={onRefreshAll}
          disabled={refreshingAll}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-bg-subtle border border-border text-text-main text-[13px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${refreshingAll ? "animate-spin" : ""}`}
          >
            refresh
          </span>
          {t("refreshAll")}
        </button>
      </div>
    </div>
  );
}
