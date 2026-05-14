"use client";

import Card from "@/shared/components/Card";
import { CardSkeleton } from "@/shared/components/Loading";
import { ProviderLimitsHeader } from "./provider-limits/ProviderLimitsHeader";
import { ProviderLimitsTable } from "./provider-limits/ProviderLimitsTable";
import { ProviderLimitsTierFilters } from "./provider-limits/ProviderLimitsTierFilters";
import { useProviderLimits } from "./provider-limits/useProviderLimits";

export default function ProviderLimits() {
  const limits = useProviderLimits();
  const {
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
  } = limits;

  if (initialLoading) {
    return (
      <div className="flex flex-col gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (sortedConnections.length === 0) {
    return (
      <Card padding="lg">
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-[64px] opacity-15">
            cloud_off
          </span>
          <h3 className="mt-4 text-lg font-semibold text-text-main">
            {t("noProviders")}
          </h3>
          <p className="mt-2 text-sm text-text-muted max-w-[400px] mx-auto">
            {t("connectProvidersForQuota")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProviderLimitsHeader
        t={t}
        visibleCount={visibleConnections.length}
        totalCount={sortedConnections.length}
        groupBy={groupBy}
        onSetGroupBy={handleSetGroupBy}
        onRefreshAll={refreshAll}
        refreshingAll={refreshingAll}
      />
      <ProviderLimitsTierFilters
        t={t}
        tierCounts={tierCounts}
        tierFilter={tierFilter}
        onSetTierFilter={setTierFilter}
      />
      <ProviderLimitsTable
        t={t}
        visibleConnections={visibleConnections}
        groupedConnections={groupedConnections}
        expandedGroups={expandedGroups}
        onToggleGroup={toggleGroup}
        quotaData={quotaData}
        loading={loading}
        errors={errors}
        lastRefreshedAt={lastRefreshedAt}
        tierByConnection={tierByConnection}
        resolvedPlanByConnection={resolvedPlanByConnection}
        onRefreshProvider={refreshProvider}
        tierFilter={tierFilter}
      />
    </div>
  );
}
