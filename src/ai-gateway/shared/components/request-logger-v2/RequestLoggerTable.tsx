import type { ReactNode } from "react";
import Card from "../Card";
import {
  PROTOCOL_COLORS,
  PROVIDER_COLORS,
  getHttpStatusStyle as getStatusStyle,
} from "@/shared/constants/colors";
import { formatApiKeyLabel, formatDuration, formatTime, maskAccount } from "@/shared/utils/formatting";
import { getProviderDisplayLabel } from "./requestLoggerUtils";
import type { ProviderNode, RequestLogEntry, RequestLoggerVisibleColumns } from "./requestLoggerTypes";

interface RequestLoggerTableProps {
  logs: RequestLogEntry[];
  sortedLogs: RequestLogEntry[];
  loading: boolean;
  visibleColumns: RequestLoggerVisibleColumns;
  providerNodes: ProviderNode[];
  onOpenDetail: (log: RequestLogEntry) => void;
}

export function RequestLoggerTable({
  logs,
  sortedLogs,
  loading,
  visibleColumns,
  providerNodes,
  onOpenDetail,
}: RequestLoggerTableProps) {
  return (
    <Card className="overflow-hidden bg-black/5 dark:bg-black/20">
      <div className="p-0 overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
        {loading && logs.length === 0 ? (
          <div className="p-8 text-center text-text-muted">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <span className="material-symbols-outlined text-[48px] mb-2 block opacity-40">
              receipt_long
            </span>
            No logs recorded yet. Make some API calls to see them here.
          </div>
        ) : sortedLogs.length === 0 ? (
          <div className="p-8 text-center text-text-muted">No logs match the current filters.</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10" style={{ backgroundColor: "var(--color-bg, #fff)" }}>
              <tr className="border-b border-border" style={{ backgroundColor: "var(--color-bg, #fff)" }}>
                {visibleColumns.status && <HeaderCell>Status</HeaderCell>}
                {visibleColumns.model && <HeaderCell>Model</HeaderCell>}
                {visibleColumns.requestedModel && <HeaderCell>Requested</HeaderCell>}
                {visibleColumns.provider && <HeaderCell>Provider</HeaderCell>}
                {visibleColumns.protocol && <HeaderCell>Req Protocol</HeaderCell>}
                {visibleColumns.account && <HeaderCell>Account</HeaderCell>}
                {visibleColumns.apiKey && <HeaderCell>API Key</HeaderCell>}
                {visibleColumns.combo && <HeaderCell>Combo</HeaderCell>}
                {visibleColumns.tokens && <HeaderCell className="text-right">Tokens</HeaderCell>}
                {visibleColumns.duration && <HeaderCell className="text-right">Duration</HeaderCell>}
                {visibleColumns.time && <HeaderCell className="text-right">Time</HeaderCell>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sortedLogs.map((log) => {
                const statusStyle = getStatusStyle(log.status);
                const protocolKey = (log.sourceFormat || log.provider || "") as string;
                const protocol = PROTOCOL_COLORS[protocolKey] || PROTOCOL_COLORS[log.provider || ""] || {
                  bg: "#6B7280",
                  text: "#fff",
                  label: (protocolKey || log.provider || "-").toUpperCase(),
                };
                const compatLabel = getProviderDisplayLabel(log.provider, providerNodes);
                const providerColor = PROVIDER_COLORS[log.provider || ""] || {
                  bg: "#374151",
                  text: "#fff",
                  label: compatLabel || (log.provider || "-").toUpperCase(),
                };
                const isError = (log.status || 0) >= 400;

                return (
                  <tr
                    key={log.id}
                    onClick={() => onOpenDetail(log)}
                    className={`cursor-pointer hover:bg-primary/5 transition-colors ${isError ? "bg-red-500/5" : ""}`}
                  >
                    {visibleColumns.status && (
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-bold min-w-[36px] text-center"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
                        >
                          {log.status || "..."}
                        </span>
                      </td>
                    )}
                    {visibleColumns.model && (
                      <td className="px-3 py-2 font-medium text-primary font-mono text-[11px]">
                        {log.model}
                      </td>
                    )}
                    {visibleColumns.requestedModel && (
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {log.requestedModel ? (
                          <span
                            className={
                              log.requestedModel !== log.model
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-text-muted"
                            }
                            title={
                              log.requestedModel !== log.model
                                ? `Requested ${log.requestedModel}, routed as ${log.model}`
                                : log.requestedModel
                            }
                          >
                            {log.requestedModel}
                          </span>
                        ) : (
                          <span className="text-text-muted text-[10px]">---</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.provider && (
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                          style={{ backgroundColor: providerColor.bg, color: providerColor.text }}
                        >
                          {compatLabel || providerColor.label}
                        </span>
                      </td>
                    )}
                    {visibleColumns.protocol && (
                      <td className="px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                          style={{ backgroundColor: protocol.bg, color: protocol.text }}
                        >
                          {protocol.label}
                        </span>
                      </td>
                    )}
                    {visibleColumns.account && (
                      <td className="px-3 py-2 text-text-muted truncate max-w-[120px]" title={log.account}>
                        {maskAccount(log.account)}
                      </td>
                    )}
                    {visibleColumns.apiKey && (
                      <td
                        className="px-3 py-2 text-text-muted truncate max-w-[140px]"
                        title={log.apiKeyName || log.apiKeyId || "No API key"}
                      >
                        {formatApiKeyLabel(log.apiKeyName, log.apiKeyId)}
                      </td>
                    )}
                    {visibleColumns.combo && (
                      <td className="px-3 py-2">
                        {log.comboName ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-500/20 text-violet-800 dark:text-violet-300 border border-violet-500/40">
                            {log.comboName}
                          </span>
                        ) : (
                          <span className="text-text-muted text-[10px]">---</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.tokens && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="text-text-muted">TI:</span>{" "}
                        <span className="text-primary">{log.tokens?.in?.toLocaleString() || 0}</span>
                        <span className="mx-1 text-border">|</span>
                        <span className="text-text-muted">TO:</span>{" "}
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {log.tokens?.out?.toLocaleString() || 0}
                        </span>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td className="px-3 py-2 text-right text-text-muted font-mono">
                        {formatDuration(log.duration)}
                      </td>
                    )}
                    {visibleColumns.time && (
                      <td className="px-3 py-2 text-right text-text-muted">
                        {formatTime(log.timestamp)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function HeaderCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2.5 font-semibold text-text-muted uppercase tracking-wider text-[10px] ${className}`}
    >
      {children}
    </th>
  );
}
