import { useMemo } from "react";
import { buildDateKey, createDateFormatter, DarkTooltip, CostTooltip } from "./shared";
"use client";


import { useLocale } from "next-intl";
import Card from "../../Card";
import { getModelColor } from "@/shared/constants/colors";
import { fmtCompact as fmt, fmtFull } from "@/shared/utils/formatting";
import {
  BarChart,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

export function DailyTrendChart({ dailyTrend }) {
  const chartData = useMemo(() => {
    return (dailyTrend || []).map((d) => ({
      date: d.date.slice(5),
      Input: d.promptTokens,
      Output: d.completionTokens,
      Cost: d.cost || 0,
    }));
  }, [dailyTrend]);

  const hasCost = useMemo(() => chartData.some((d) => d.Cost > 0), [chartData]);

  if (!chartData.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Token Trend
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Token &amp; Cost Trend
      </h3>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart
          data={chartData}
          margin={{ top: 0, right: hasCost ? 40 : 0, left: 0, bottom: 0 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(Math.floor(chartData.length / 6), 0)}
          />
          {hasCost && (
            <YAxis
              yAxisId="cost"
              orientation="right"
              tick={{ fontSize: 8, fill: "#f59e0b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              width={36}
            />
          )}
          <Tooltip content={<CostTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar
            dataKey="Input"
            stackId="a"
            fill="var(--primary)"
            opacity={0.7}
            radius={[0, 0, 0, 0]}
            animationDuration={600}
          />
          <Bar
            dataKey="Output"
            stackId="a"
            fill="#10b981"
            opacity={0.7}
            radius={[3, 3, 0, 0]}
            animationDuration={600}
          />
          {hasCost && (
            <Line
              yAxisId="cost"
              type="monotone"
              dataKey="Cost"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              animationDuration={600}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary/70" /> Input
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500/70" /> Output
        </span>
        {hasCost && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500/70" /> Cost ($)
          </span>
        )}
      </div>
    </Card>
  );
}

export function WeeklyPattern({ weeklyPattern }) {
  const chartData = useMemo(() => {
    return (weeklyPattern || []).map((w) => ({
      day: w.day.slice(0, 3),
      Tokens: w.totalTokens,
    }));
  }, [weeklyPattern]);

  return (
    <Card className="px-4 py-3">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
        Weekly
      </h3>
      <ResponsiveContainer width="100%" height={48}>
        <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 9, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<DarkTooltip formatter={fmt} />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="Tokens"
            fill="var(--text-muted)"
            opacity={0.3}
            radius={[3, 3, 0, 0]}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export function MostActiveDay7d({ activityMap }) {
  const locale = useLocale();
  const weekdayFormatter = useMemo(
    () => createDateFormatter(locale, { weekday: "long" }),
    [locale]
  );
  const dateFormatter = useMemo(
    () => createDateFormatter(locale, { month: "short", day: "numeric" }),
    [locale]
  );
  const data = useMemo(() => {
    if (!activityMap) return null;
    const today = new Date();
    let peakKey = null;
    let peakVal = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = buildDateKey(d);
      const val = activityMap[key] || 0;
      if (val > peakVal) {
        peakVal = val;
        peakKey = key;
      }
    }
    if (!peakKey || peakVal === 0) return null;

    const peakDate = new Date(peakKey + "T12:00:00");
    return {
      weekday: weekdayFormatter.format(peakDate),
      label: dateFormatter.format(peakDate),
      tokens: peakVal,
    };
  }, [activityMap, dateFormatter, weekdayFormatter]);

  return (
    <Card className="p-4 flex flex-col justify-center" style={{ flex: 1, minHeight: 0 }}>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        Most Active Day
      </h3>
      {data ? (
        <>
          <span className="text-xl font-bold capitalize" style={{ lineHeight: 1.2 }}>
            {data.weekday}
          </span>
          <span className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {data.label} · {fmt(data.tokens)} tokens
          </span>
        </>
      ) : (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          No data in the last 7 days
        </span>
      )}
    </Card>
  );
}

export function WeeklySquares7d({ activityMap }) {
  const locale = useLocale();
  const weekdayFormatter = useMemo(
    () => createDateFormatter(locale, { weekday: "short" }),
    [locale]
  );
  const dateFormatter = useMemo(
    () => createDateFormatter(locale, { month: "short", day: "numeric" }),
    [locale]
  );
  const days = useMemo(() => {
    if (!activityMap) return [];
    const today = new Date();
    const result = [];
    let maxVal = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = buildDateKey(d);
      const val = activityMap[key] || 0;
      if (val > maxVal) maxVal = val;
      result.push({
        key,
        val,
        label: weekdayFormatter.format(d),
        dateLabel: dateFormatter.format(d),
      });
    }
    return result.map((d) => ({ ...d, intensity: maxVal > 0 ? d.val / maxVal : 0 }));
  }, [activityMap, dateFormatter, weekdayFormatter]);

  function getSquareStyle(intensity) {
    if (intensity === 0) return { background: "rgba(255,255,255,0.04)" };
    const opacity = 0.15 + intensity * 0.75;
    return { background: `rgba(229, 77, 94, ${opacity.toFixed(2)})` };
  }

  return (
    <Card className="p-4 flex flex-col justify-center" style={{ flex: 1, minHeight: 0 }}>
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        Weekly
      </h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, justifyContent: "center" }}>
        {days.map((d) => (
          <div
            key={d.key}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
          >
            <div
              title={`${d.dateLabel}: ${fmtFull(d.val)} tokens`}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                ...getSquareStyle(d.intensity),
                transition: "all 0.2s",
                cursor: "default",
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.03em",
              }}
            >
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ModelOverTimeChart({ dailyByModel, modelNames }) {
  const data = useMemo(() => dailyByModel || [], [dailyByModel]);
  const models = useMemo(() => modelNames || [], [modelNames]);

  const chartData = useMemo(() => {
    return data.map((d) => {
      const row = { ...d };
      if (d.date) {
        const parts = d.date.split("-");
        row.dateLabel = `${parts[1]}/${parts[2]}`;
      }
      return row;
    });
  }, [data]);

  if (!data.length || !models.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Model Usage Over Time
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Model Usage Over Time
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickFormatter={(v) => fmt(v)}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<DarkTooltip formatter={fmt} />} />
          {models.map((m, i) => (
            <Area
              key={m}
              type="monotone"
              dataKey={m}
              stackId="1"
              stroke={getModelColor(i)}
              fill={getModelColor(i)}
              fillOpacity={0.4}
              strokeWidth={1.5}
              animationDuration={600}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-text-muted">
        {models.map((m, i) => (
          <span key={m} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: getModelColor(i) }}
            />
            {m}
          </span>
        ))}
      </div>
    </Card>
  );
}
