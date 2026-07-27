"use client";

import Card from "../../Card";

export type CompactStatSection = {
  title: string;
  items: Array<{ icon: string; label: string; value: any; color?: string }>;
  /** On mobile use 1 column instead of 2 - useful when values can be long (model names, etc.) */
  wideValues?: boolean;
};

export function StatCard({
  icon,
  label,
  value,
  subValue,
  color = "text-text-main",
}: {
  icon: any;
  label: any;
  value: any;
  subValue?: any;
  color?: string;
}) {
  return (
    <Card className="px-4 py-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5 text-text-muted text-[11px] uppercase font-semibold tracking-wide min-w-0">
        <span className="material-symbols-outlined text-[14px] shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <span className={`text-2xl font-bold ${color} truncate`} title={String(value)}>
        {value}
      </span>
      {subValue && <span className="text-xs text-text-muted truncate">{subValue}</span>}
    </Card>
  );
}

export function CompactStatGrid({ sections }: { sections: CompactStatSection[] }) {
  return (
    <Card className="px-5 py-4">
      <div className="flex flex-col gap-3">
        {sections.map((section, si) => (
          <div key={si}>
            {si > 0 && <div className="border-t border-black/[0.06] dark:border-white/[0.06] mb-3" />}
            <div className="text-[10px] uppercase font-semibold tracking-widest text-text-muted/50 mb-2">
              {section.title}
            </div>
            <div
              className={
                section.wideValues ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2"
                  : "grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2"
              }
            >
              {section.items.map((stat, i) => (
                <div key={i} className="flex items-center justify-between gap-2 min-w-0 py-0.5">
                  <div
                    className={`flex items-center gap-1.5 ${section.wideValues ? "shrink-0" : "min-w-0"}`}
                  >
                    <span className="material-symbols-outlined text-[14px] text-text-muted shrink-0">
                      {stat.icon}
                    </span>
                    <span
                      className={`text-[11px] uppercase font-semibold tracking-wide text-text-muted ${section.wideValues ? "whitespace-nowrap" : "truncate"}`}
                    >
                      {stat.label}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold text-right ${section.wideValues ? "truncate min-w-0" : "shrink-0"} ${stat.color || "text-text-main"}`}
                    title={String(stat.value)}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
