import { fmtCompact as fmt, fmtCost } from "@/shared/utils/formatting";
"use client";


export function createDateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch (error: unknown) {return new Intl.DateTimeFormat(undefined, options);
  }
}

export function buildDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type TooltipEntry = {
  color?: string;
  name?: string;
  value?: any;
};

export function DarkTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: any;
  formatter?: (value: any) => any;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-semibold text-text-main mb-1">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-text-muted">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-mono font-medium text-text-main">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CostTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: any;
  formatter?: (value: any) => any;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-surface px-3 py-2 text-xs shadow-lg">
      {label && <div className="font-semibold text-text-main mb-1">{label}</div>}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5 text-text-muted">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-mono font-medium text-text-main">
            {formatter
              ? formatter(entry.value)
              : entry.name === "Cost"
                ? fmtCost(entry.value)
                : fmt(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SortIndicator({ active, sortOrder }: { active: boolean; sortOrder: string }) {
  if (!active) {
    return (
      <span className="material-symbols-outlined text-[12px] opacity-0 group-hover:opacity-30">
        unfold_more
      </span>
    );
  }
  return (
    <span className="material-symbols-outlined text-[12px] text-primary">
      {sortOrder === "asc" ? "expand_less" : "expand_more"}
    </span>
  );
}

export const PROVIDER_COLORS = [
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
];
