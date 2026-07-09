import { useMemo } from "react";
"use client";


import Card from "../../Card";
import { getModelColor } from "@/shared/constants/colors";
import { fmtCompact as fmt, formatApiKeyLabel as maskApiKeyLabel, fmtCost } from "@/shared/utils/formatting";
import { ResponsiveContainer, Cell, PieChart, Pie, Tooltip } from "recharts";
import { DarkTooltip, PROVIDER_COLORS } from "./shared";

export function AccountDonut({ byAccount }) {
  const data = useMemo(() => byAccount || [], [byAccount]);
  const hasData = data.length > 0;

  const pieData = useMemo(() => {
    return data.slice(0, 8).map((item, i) => ({
      name: item.account,
      value: item.totalTokens,
      fill: getModelColor(i),
    }));
  }, [data]);

  if (!hasData) {
    return (
      <Card className="p-4 flex-1">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          By Account
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        By Account
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={55}
              paddingAngle={1}
              animationDuration={600}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<DarkTooltip formatter={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {pieData.map((seg, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: seg.fill }}
                />
                <span className="truncate text-text-main">{seg.name}</span>
              </div>
              <span className="font-mono font-medium text-text-muted shrink-0">
                {fmt(seg.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ApiKeyDonut({ byApiKey }) {
  const data = useMemo(() => byApiKey || [], [byApiKey]);
  const hasData = data.length > 0;

  const pieData = useMemo(() => {
    return data.slice(0, 8).map((item, i) => ({
      name: maskApiKeyLabel(item.apiKeyName, item.apiKeyId),
      fullName: item.apiKeyName || item.apiKeyId || "unknown",
      value: item.totalTokens,
      fill: getModelColor(i),
    }));
  }, [data]);

  if (!hasData) {
    return (
      <Card className="p-4 flex-1">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          By API Key
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        By API Key
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={55}
              paddingAngle={1}
              animationDuration={600}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<DarkTooltip formatter={fmt} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {pieData.map((seg, i) => (
            <div
              key={`${seg.fullName}-${i}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: seg.fill }}
                />
                <span className="truncate text-text-main" title={seg.fullName}>
                  {seg.name}
                </span>
              </div>
              <span className="font-mono font-medium text-text-muted shrink-0">
                {fmt(seg.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ProviderCostDonut({ byProvider }) {
  const data = useMemo(() => byProvider || [], [byProvider]);
  const hasData = data.length > 0 && data.some((p) => p.cost > 0);

  const pieData = useMemo(() => {
    return data
      .filter((item) => item.cost > 0)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 8)
      .map((item, i) => ({
        name: item.provider,
        value: item.cost,
        fill: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
      }));
  }, [data]);

  if (!hasData) {
    return (
      <Card className="p-4 flex-1">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Cost by Provider
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No cost data</div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Cost by Provider
      </h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={55}
              paddingAngle={1}
              animationDuration={600}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip content={<DarkTooltip formatter={fmtCost} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {pieData.map((seg, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: seg.fill }}
                />
                <span className="truncate text-text-main capitalize">{seg.name}</span>
              </div>
              <span className="font-mono font-medium text-amber-500 shrink-0">
                {fmtCost(seg.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
