import { useCallback, useMemo, useState } from "react";
"use client";


import Card from "../../Card";
import { getModelColor } from "@/shared/constants/colors";
import { fmtCompact as fmt, fmtFull, fmtCost, formatApiKeyLabel as maskApiKeyLabel } from "@/shared/utils/formatting";
import { SortIndicator, PROVIDER_COLORS } from "./shared";

export function ApiKeyTable({ byApiKey }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("totalTokens");
  const [sortOrder, setSortOrder] = useState("desc");

  const data = useMemo(() => byApiKey || [], [byApiKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (row) =>
        (row.apiKeyName || "").toLowerCase().includes(q) ||
        (row.apiKeyId || "").toLowerCase().includes(q)
    );
  }, [data, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      if (typeof va === "string") {
        return sortOrder === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortOrder === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [filtered, sortBy, sortOrder]);

  const toggleSort = useCallback(
    (field) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
        return;
      }
      setSortBy(field);
      setSortOrder("desc");
    },
    [sortBy]
  );

  const hasData = data.length > 0;

  if (!hasData) {
    return (
      <Card className="p-4 flex-1">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          API Key Breakdown
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          API Key Breakdown
        </h3>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter API key..."
          className="w-full max-w-[220px] px-3 py-1.5 rounded-lg bg-bg-subtle border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-text-muted uppercase bg-black/[0.02] dark:bg-white/[0.02]">
            <tr>
              <th
                className="px-4 py-2.5 text-left cursor-pointer group"
                onClick={() => toggleSort("apiKeyName")}
              >
                API Key <SortIndicator active={sortBy === "apiKeyName"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("requests")}
              >
                Requests <SortIndicator active={sortBy === "requests"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("promptTokens")}
              >
                Input <SortIndicator active={sortBy === "promptTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("completionTokens")}
              >
                Output{" "}
                <SortIndicator active={sortBy === "completionTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("totalTokens")}
              >
                Total Tokens{" "}
                <SortIndicator active={sortBy === "totalTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("cost")}
              >
                Cost <SortIndicator active={sortBy === "cost"} sortOrder={sortOrder} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row, i) => (
              <tr
                key={`${row.apiKeyId || row.apiKeyName || "key"}-${i}`}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5">
                  <span className="font-medium" title={row.apiKeyName || row.apiKeyId || "unknown"}>
                    {maskApiKeyLabel(row.apiKeyName, row.apiKeyId)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                  {fmtFull(row.requests)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {fmt(row.promptTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-500">
                  {fmt(row.completionTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  {fmt(row.totalTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-amber-500">
                  {fmtCost(row.cost)}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No API key matches this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ModelTable({ byModel, summary }) {
  const [sortBy, setSortBy] = useState("totalTokens");
  const [sortOrder, setSortOrder] = useState("desc");

  const toggleSort = useCallback(
    (field) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortOrder("desc");
      }
    },
    [sortBy]
  );

  const sorted = useMemo(() => {
    const arr = [...(byModel || [])];
    arr.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      if (typeof va === "string")
        return sortOrder === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortOrder === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [byModel, sortBy, sortOrder]);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Model Breakdown
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-text-muted uppercase bg-black/[0.02] dark:bg-white/[0.02]">
            <tr>
              <th
                className="px-4 py-2.5 text-left cursor-pointer group"
                onClick={() => toggleSort("model")}
              >
                Model <SortIndicator active={sortBy === "model"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("requests")}
              >
                Requests <SortIndicator active={sortBy === "requests"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("promptTokens")}
              >
                Input <SortIndicator active={sortBy === "promptTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("completionTokens")}
              >
                Output{" "}
                <SortIndicator active={sortBy === "completionTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("totalTokens")}
              >
                Total <SortIndicator active={sortBy === "totalTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("cost")}
              >
                Cost <SortIndicator active={sortBy === "cost"} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-2.5 text-right w-36">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((m, i) => (
              <tr
                key={m.model}
                className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getModelColor(i) }}
                    />
                    <span className="font-medium">{m.model}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                  {fmtFull(m.requests)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-primary">
                  {fmt(m.promptTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-emerald-500">
                  {fmt(m.completionTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold">
                  {fmt(m.totalTokens)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-amber-500">
                  {fmtCost(m.cost)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${m.pct}%`, backgroundColor: getModelColor(i) }}
                      />
                    </div>
                    <span className="text-xs font-mono text-text-muted w-10 text-right">
                      {m.pct}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function UsageDetail({ summary }) {
  const items = [
    { label: "Input", value: summary?.promptTokens, color: "text-primary" },
    { label: "Cache read", value: 0, color: "text-text-muted" },
    { label: "Output", value: summary?.completionTokens, color: "text-emerald-500" },
  ];

  return (
    <Card className="p-4 flex-1">
      <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
        Usage Detail
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className={`text-sm ${item.color}`}>{item.label}</span>
            <span className="font-mono font-medium text-sm">{fmtFull(item.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ProviderTable({ byProvider }) {
  const [sortBy, setSortBy] = useState("totalTokens");
  const [sortOrder, setSortOrder] = useState("desc");

  const data = useMemo(() => byProvider || [], [byProvider]);
  const totalTokens = useMemo(() => data.reduce((acc, p) => acc + p.totalTokens, 0), [data]);

  const toggleSort = useCallback(
    (field) => {
      if (sortBy === field) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(field);
        setSortOrder("desc");
      }
    },
    [sortBy]
  );

  const sorted = useMemo(() => {
    const arr = [...data];
    arr.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      if (typeof va === "string")
        return sortOrder === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortOrder === "asc" ? va - vb : vb - va;
    });
    return arr;
  }, [data, sortBy, sortOrder]);

  if (!data.length) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Provider Breakdown
        </h3>
        <div className="text-center text-text-muted text-sm py-8">No data</div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">
          Provider Breakdown
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-text-muted uppercase bg-black/[0.02] dark:bg-white/[0.02]">
            <tr>
              <th
                className="px-4 py-2.5 text-left cursor-pointer group"
                onClick={() => toggleSort("provider")}
              >
                Provider <SortIndicator active={sortBy === "provider"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("requests")}
              >
                Requests <SortIndicator active={sortBy === "requests"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("promptTokens")}
              >
                Input <SortIndicator active={sortBy === "promptTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("completionTokens")}
              >
                Output{" "}
                <SortIndicator active={sortBy === "completionTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("totalTokens")}
              >
                Total <SortIndicator active={sortBy === "totalTokens"} sortOrder={sortOrder} />
              </th>
              <th
                className="px-4 py-2.5 text-right cursor-pointer group"
                onClick={() => toggleSort("cost")}
              >
                Cost <SortIndicator active={sortBy === "cost"} sortOrder={sortOrder} />
              </th>
              <th className="px-4 py-2.5 text-right w-36">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((p, i) => {
              const pct = totalTokens > 0 ? ((p.totalTokens / totalTokens) * 100).toFixed(1) : "0";
              return (
                <tr
                  key={p.provider}
                  className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: PROVIDER_COLORS[i % PROVIDER_COLORS.length] }}
                      />
                      <span className="font-medium capitalize">{p.provider}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                    {fmtFull(p.requests)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-primary">
                    {fmt(p.promptTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-500">
                    {fmt(p.completionTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">
                    {fmt(p.totalTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-amber-500">
                    {fmtCost(p.cost)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-text-muted w-10 text-right">
                        {pct}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
