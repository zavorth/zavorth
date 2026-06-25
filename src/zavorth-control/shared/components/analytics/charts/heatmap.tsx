"use client";

import { useMemo } from "react";
import Card from "../../Card";
import { fmtCompact as fmt, fmtFull } from "@/shared/utils/formatting";
import { MONTH_NAMES, buildDateKey } from "./shared";

export function ActivityHeatmap({ activityMap }) {
  const cells = useMemo(() => {
    const today = new Date();
    const days = [];
    let maxVal = 0;

    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = buildDateKey(d);
      const val = activityMap?.[key] || 0;
      if (val > maxVal) maxVal = val;
      days.push({ date: key, value: val, dayOfWeek: d.getDay() });
    }

    return { days, maxVal };
  }, [activityMap]);

  const weeks = useMemo(() => {
    const w = [];
    let current = [];
    const firstDay = cells.days[0]?.dayOfWeek || 0;
    for (let i = 0; i < firstDay; i++) {
      current.push(null);
    }
    for (const day of cells.days) {
      current.push(day);
      if (current.length === 7) {
        w.push(current);
        current = [];
      }
    }
    if (current.length > 0) w.push(current);
    return w;
  }, [cells]);

  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
      const firstDay = week.find((d) => d !== null);
      if (firstDay) {
        const m = new Date(firstDay.date).getMonth();
        if (m !== lastMonth) {
          labels.push({ weekIdx, label: MONTH_NAMES[m] });
          lastMonth = m;
        }
      }
    });
    return labels;
  }, [weeks]);

  function getCellColor(value) {
    if (!value || value === 0) return "bg-white/[0.04]";
    const intensity = Math.min(value / (cells.maxVal || 1), 1);
    if (intensity < 0.25) return "bg-primary/20";
    if (intensity < 0.5) return "bg-primary/40";
    if (intensity < 0.75) return "bg-primary/60";
    return "bg-primary/90";
  }

  return (
    <Card className="p-4 h-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Activity</h3>
        <span className="text-xs text-text-muted">
          {Object.keys(activityMap || {}).length} active days ·{" "}
          {fmt(Object.values(activityMap || {}).reduce((a: number, b: number) => a + b, 0))} tokens
          · 365 days
        </span>
      </div>

      <div className="flex gap-[3px] mb-1 ml-6" style={{ fontSize: "10px" }}>
        {monthLabels.map((m, i) => (
          <span
            key={i}
            className="text-text-muted"
            style={{
              position: "relative",
              left: `${m.weekIdx * 13}px`,
              marginLeft: i === 0 ? 0 : "-20px",
            }}
          >
            {m.label}
          </span>
        ))}
      </div>

      <div className="flex gap-[3px] overflow-x-auto">
        <div className="flex flex-col gap-[3px] shrink-0 text-[10px] text-text-muted pr-1">
          <span className="h-[10px]"></span>
          <span className="h-[10px] leading-[10px]">Mon</span>
          <span className="h-[10px]"></span>
          <span className="h-[10px] leading-[10px]">Wed</span>
          <span className="h-[10px]"></span>
          <span className="h-[10px] leading-[10px]">Fri</span>
          <span className="h-[10px]"></span>
        </div>

        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day, di) => (
              <div
                key={di}
                title={day ? `${day.date}: ${fmtFull(day.value)} tokens` : ""}
                className={`w-[10px] h-[10px] rounded-[2px] ${day ? getCellColor(day.value) : "bg-transparent"}`}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 mt-2 ml-6 text-[10px] text-text-muted">
        <span>Less</span>
        <div className="w-[10px] h-[10px] rounded-[2px] bg-white/[0.04]" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/20" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/40" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/60" />
        <div className="w-[10px] h-[10px] rounded-[2px] bg-primary/90" />
        <span>More</span>
      </div>
    </Card>
  );
}
