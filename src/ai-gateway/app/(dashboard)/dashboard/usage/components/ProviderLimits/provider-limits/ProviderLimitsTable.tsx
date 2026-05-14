"use client";

import { TIER_FILTERS } from "./providerLimitsConfig";
import { ProviderLimitRow } from "./ProviderLimitRow";

export function ProviderLimitsTable({
  t,
  visibleConnections,
  groupedConnections,
  expandedGroups,
  onToggleGroup,
  quotaData,
  loading,
  errors,
  lastRefreshedAt,
  tierByConnection,
  resolvedPlanByConnection,
  onRefreshProvider,
  tierFilter,
}) {
  const renderRow = (conn, isLast) => (
    <ProviderLimitRow
      key={conn.id}
      t={t}
      conn={conn}
      isLast={isLast}
      quota={quotaData[conn.id]}
      isLoading={loading[conn.id]}
      error={errors[conn.id]}
      tierMeta={tierByConnection[conn.id]}
      resolvedPlan={resolvedPlanByConnection[conn.id]}
      refreshedAt={lastRefreshedAt[conn.id]}
      onRefreshProvider={onRefreshProvider}
    />
  );

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-surface">
      <div
        className="items-center px-4 py-2.5 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-text-muted"
        style={{ display: "grid", gridTemplateColumns: "280px 1fr 128px 48px" }}
      >
        <div>{t("account")}</div>
        <div>{t("modelQuotas")}</div>
        <div className="text-center">{t("lastUsed")}</div>
        <div className="text-center">{t("actions")}</div>
      </div>

      {groupedConnections
        ? [...groupedConnections.entries()].map(([groupName, conns]) => (
            <div
              key={groupName}
              className="border border-border rounded-lg overflow-hidden mb-2"
            >
              <button
                onClick={() => onToggleGroup(groupName)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-bg-subtle hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors text-left border-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-text-muted">
                  {expandedGroups.has(groupName)
                    ? "expand_less"
                    : "expand_more"}
                </span>
                <span className="material-symbols-outlined text-[16px] text-text-muted">
                  folder
                </span>
                <span className="text-[12px] font-semibold text-text-main uppercase tracking-wider flex-1">
                  {groupName}
                </span>
                <span className="text-[11px] text-text-muted bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-full">
                  {conns.length}
                </span>
              </button>
              {expandedGroups.has(groupName) && (
                <div>
                  {conns.map((conn, idx) =>
                    renderRow(conn, idx === conns.length - 1),
                  )}
                </div>
              )}
            </div>
          ))
        : visibleConnections.map((conn, idx) =>
            renderRow(conn, idx === visibleConnections.length - 1),
          )}

      {visibleConnections.length === 0 && (
        <div className="py-6 px-4 text-center text-text-muted text-[13px]">
          {t("noAccountsForTierFilter")}{" "}
          <strong>
            {t(
              TIER_FILTERS.find((tier) => tier.key === tierFilter)?.labelKey ||
                "tierUnknown",
            )}
          </strong>
          .
        </div>
      )}
    </div>
  );
}
