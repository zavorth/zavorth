import { PROVIDER_COLORS } from "@/shared/constants/colors";
import { COLUMNS, STATUS_FILTERS } from "./requestLoggerConfig";
import { getProviderDisplayLabel } from "./requestLoggerUtils";
import type {
  ProviderNode,
  RequestLoggerColumnKey,
  RequestLoggerStatusFilter,
  RequestLoggerVisibleColumns,
} from "./requestLoggerTypes";

interface RequestLoggerQuickFiltersProps {
  activeFilter: RequestLoggerStatusFilter;
  onActiveFilterChange: (value: RequestLoggerStatusFilter) => void;
  uniqueProviders: string[];
  selectedProvider: string;
  onProviderChange: (value: string) => void;
  providerNodes: ProviderNode[];
  visibleColumns: RequestLoggerVisibleColumns;
  onToggleColumn: (key: RequestLoggerColumnKey) => void;
}

export function RequestLoggerQuickFilters({
  activeFilter,
  onActiveFilterChange,
  uniqueProviders,
  selectedProvider,
  onProviderChange,
  providerNodes,
  visibleColumns,
  onToggleColumn,
}: RequestLoggerQuickFiltersProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => onActiveFilterChange(activeFilter === filter.key ? "all" : filter.key)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              activeFilter === filter.key
                ? filter.key === "error"
                  ? "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/40"
                  : filter.key === "ok"
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
                    : filter.key === "combo"
                      ? "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/40"
                      : "bg-primary text-white border-primary"
                : "bg-bg-subtle border-border text-text-muted hover:border-text-muted"
            }`}
          >
            {filter.icon && <span className="material-symbols-outlined text-[14px]">{filter.icon}</span>}
            {filter.label}
          </button>
        ))}

        {uniqueProviders.length > 0 && <span className="w-px h-5 bg-border mx-1" />}

        {uniqueProviders.map((provider) => {
          const compatLabel = getProviderDisplayLabel(provider, providerNodes);
          const providerColor = PROVIDER_COLORS[provider] || {
            bg: "#374151",
            text: "#fff",
            label: compatLabel || provider.toUpperCase(),
          };
          const isActive = selectedProvider === provider;

          return (
            <button
              key={provider}
              onClick={() => onProviderChange(isActive ? "" : provider)}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase border transition-all ${
                isActive
                  ? "border-white/40 ring-1 ring-white/20"
                  : "border-transparent opacity-70 hover:opacity-100"
              }`}
              style={{
                backgroundColor: isActive ? providerColor.bg : `${providerColor.bg}33`,
                color: isActive ? providerColor.text : providerColor.bg,
              }}
            >
              {compatLabel || providerColor.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">Columns</span>
        {COLUMNS.map((column) => (
          <button
            key={column.key}
            onClick={() => onToggleColumn(column.key)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
              visibleColumns[column.key]
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-bg-subtle text-text-muted border-border opacity-50 hover:opacity-80"
            }`}
          >
            {column.label}
          </button>
        ))}
      </div>
    </>
  );
}
