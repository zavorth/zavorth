"use client";

import { TIER_FILTERS } from "./providerLimitsConfig";

export function ProviderLimitsTierFilters({
  t,
  tierCounts,
  tierFilter,
  onSetTierFilter,
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {TIER_FILTERS.map((tier) => {
        if (tier.key !== "all" && !tierCounts[tier.key]) return null;
        const active = tierFilter === tier.key;
        return (
          <button
            key={tier.key}
            onClick={() => onSetTierFilter(tier.key)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer"
            style={{
              border: active
                ? "1px solid var(--color-primary, #E54D5E)"
                : "1px solid var(--color-border)",
              background: active ? "rgba(229,77,94,0.1)" : "transparent",
              color: active
                ? "var(--color-primary, #E54D5E)"
                : "var(--color-text-muted)",
            }}
          >
            <span>{t(tier.labelKey)}</span>
            <span className="opacity-85">{tierCounts[tier.key] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}
