"use client";

import PropTypes from "prop-types";
import { useTranslations } from "next-intl";

export function ProviderTestResultsView({ results }) {
  const t = useTranslations("providers");
  const tc = useTranslations("common");

  if (!results || typeof results !== "object") {
    return null;
  }

  if (results.error && (!results.results || results.results.length === 0)) {
    return (
      <div className="text-center py-6">
        <span className="material-symbols-outlined text-red-500 text-[32px] mb-2 block">error</span>
        <p className="text-sm text-red-400">
          {typeof results.error === "object"
            ? results.error?.message || JSON.stringify(results.error)
            : String(results.error)}
        </p>
      </div>
    );
  }

  const summary = results.summary ?? null;
  const mode = results.mode ?? "";
  const items = Array.isArray(results.results) ? results.results : [];
  const modeLabel =
    {
      oauth: t("oauthLabel"),
      free: tc("free"),
      apikey: t("apiKeyLabel"),
      compatible: t("compatibleLabel"),
      provider: t("providerLabel"),
      all: tc("all"),
    }[mode] || mode;

  return (
    <div className="flex flex-col gap-3">
      {summary && (
        <div className="flex items-center gap-3 text-xs mb-1">
          <span className="text-text-muted">{t("modeTest", { mode: modeLabel })}</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">
            {t("passedCount", { count: summary.passed })}
          </span>
          {summary.failed > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
              {t("failedCount", { count: summary.failed })}
            </span>
          )}
          <span className="text-text-muted ml-auto">
            {t("testedCount", { count: summary.total })}
          </span>
        </div>
      )}

      {items.map((result, index) => (
        <div
          key={result.connectionId || index}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.03]"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${
              result.valid ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {result.valid ? "check_circle" : "error"}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-medium">{result.connectionName}</span>
            <span className="text-text-muted ml-1.5">({result.provider})</span>
          </div>
          {result.latencyMs !== undefined && (
            <span className="text-text-muted font-mono tabular-nums">
              {t("millisecondsAbbr", { value: result.latencyMs })}
            </span>
          )}
          <span
            className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
              result.valid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {result.valid ? t("okShort") : result.diagnosis?.type || t("errorShort")}
          </span>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-4 text-text-muted text-sm">
          {t("noActiveConnectionsInGroup")}
        </div>
      )}
    </div>
  );
}

ProviderTestResultsView.propTypes = {
  results: PropTypes.shape({
    mode: PropTypes.string,
    results: PropTypes.array,
    summary: PropTypes.shape({
      total: PropTypes.number,
      passed: PropTypes.number,
      failed: PropTypes.number,
    }),
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  }).isRequired,
};
