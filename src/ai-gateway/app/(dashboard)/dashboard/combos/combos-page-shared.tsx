"use client";

import { Card, Button, Toggle } from "@/shared/components";
import Tooltip from "@/shared/components/Tooltip";
import { useTranslations } from "next-intl";
import {
  getI18nOrFallback,
  getStrategyBadgeClass,
  getStrategyDescription,
  getStrategyGuideText,
  getStrategyLabel,
  getStrategyMeta,
  getStrategyRecommendationText,
  normalizeModelEntry,
} from "./combos-page-helpers";
export function ComboUsageGuide({ onHide, onHideForever }) {
  const t = useTranslations("combos");
  const guideStrategies = ["priority", "cost-optimized", "least-used"];

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[16px]">
              tips_and_updates
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t("routingStrategy")}</h2>
            <p className="text-xs text-text-muted mt-0.5">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onHide} className="!h-6 px-2 text-[10px]">
            {getI18nOrFallback(t, "usageGuideHide", "Hide")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onHideForever}
            className="!h-6 px-2 text-[10px]"
          >
            {getI18nOrFallback(t, "usageGuideDontShowAgain", "Don't show again")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        {guideStrategies.map((strategyValue) => {
          const strategyMeta = getStrategyMeta(strategyValue);
          return (
            <div
              key={strategyValue}
              className="rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-primary">
                  {strategyMeta.icon}
                </span>
                <span className="text-xs font-medium">{getStrategyLabel(t, strategyValue)}</span>
              </div>
              <p className="text-[11px] leading-4 text-text-muted mt-1.5">
                {getStrategyDescription(t, strategyValue)}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function StrategyGuidanceCard({ strategy }) {
  const t = useTranslations("combos");
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-2.5">
      <div className="text-[11px] text-text-muted">
        {getI18nOrFallback(t, "strategyGuideTitle", "How to use this strategy")}
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5 text-[11px]">
        <p className="text-text-main">
          <span className="font-semibold">
            {getI18nOrFallback(t, "strategyGuideWhen", "When to use")}:
          </span>{" "}
          {getStrategyGuideText(t, strategy, "when")}
        </p>
        <p className="text-text-main">
          <span className="font-semibold">
            {getI18nOrFallback(t, "strategyGuideAvoid", "Avoid when")}:
          </span>{" "}
          {getStrategyGuideText(t, strategy, "avoid")}
        </p>
        <p className="text-text-main">
          <span className="font-semibold">
            {getI18nOrFallback(t, "strategyGuideExample", "Example")}:
          </span>{" "}
          {getStrategyGuideText(t, strategy, "example")}
        </p>
      </div>
    </div>
  );
}

export function StrategyRecommendationsPanel({ strategy, onApply, showNudge }) {
  const t = useTranslations("combos");
  const strategyLabel = getStrategyLabel(t, strategy);
  const title = getStrategyRecommendationText(t, strategy, "title");
  const description = getStrategyRecommendationText(t, strategy, "description");
  const tips = getStrategyRecommendationText(t, strategy, "tips");

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-text-muted">
            {getI18nOrFallback(t, "recommendationsLabel", "Recommended setup")}
          </p>
          <p className="text-xs font-semibold text-text-main mt-0.5">
            {title} Â· <span className="text-primary">{strategyLabel}</span>
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">{description}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onApply} className="!h-6 px-2 text-[10px]">
          {getI18nOrFallback(t, "applyRecommendations", "Apply recommendations")}
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-1">
        {tips.map((tip, index) => (
          <div
            key={`${strategy}-tip-${index + 1}`}
            className="flex items-start gap-1 rounded-md bg-black/[0.02] dark:bg-white/[0.03] px-1.5 py-1"
          >
            <span className="material-symbols-outlined text-[12px] text-primary mt-0.5">check</span>
            <p className="text-[10px] text-text-main">{tip}</p>
          </div>
        ))}
      </div>

      {showNudge && (
        <div
          data-testid="strategy-change-nudge"
          className="mt-2 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] text-primary"
        >
          {getI18nOrFallback(
            t,
            "recommendationsUpdated",
            "Recommendations updated for {strategy}."
          ).replace("{strategy}", strategyLabel)}
        </div>
      )}
    </div>
  );
}

export function FieldLabelWithHelp({ label, help }) {
  return (
    <div className="flex items-center gap-1 mb-0.5">
      <label className="text-[10px] text-text-muted">{label}</label>
      <Tooltip content={help}>
        <span className="material-symbols-outlined text-[12px] text-text-muted cursor-help">
          help
        </span>
      </Tooltip>
    </div>
  );
}

export function ComboReadinessPanel({ checks, blockers }) {
  const t = useTranslations("combos");
  const hasBlockers = blockers.length > 0;

  return (
    <div
      data-testid="combo-readiness-panel"
      className={`rounded-lg border px-2.5 py-2 ${
        hasBlockers
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-emerald-500/20 bg-emerald-500/[0.04]"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`material-symbols-outlined text-[14px] ${
            hasBlockers
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {hasBlockers ? "rule" : "check_circle"}
        </span>
        <p className="text-[11px] font-medium text-text-main">
          {getI18nOrFallback(t, "readinessTitle", "Ready to save?")}
        </p>
      </div>

      <p className="text-[10px] text-text-muted mt-0.5">
        {getI18nOrFallback(
          t,
          "readinessDescription",
          "Review the checklist before creating or updating this combo."
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-2">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 bg-black/[0.02] dark:bg-white/[0.02]"
          >
            <span
              className={`material-symbols-outlined text-[12px] ${
                check.ok ? "text-emerald-500" : "text-amber-500"
              }`}
            >
              {check.ok ? "task_alt" : "pending"}
            </span>
            <span className="text-[10px] text-text-main">{check.label}</span>
          </div>
        ))}
      </div>

      {hasBlockers && (
        <div
          data-testid="combo-save-blockers"
          className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5"
        >
          <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
            {getI18nOrFallback(
              t,
              "saveBlockedTitle",
              "Save is blocked until the following items are fixed:"
            )}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {blockers.map((blocker, index) => (
              <p
                key={`${blocker}-${index}`}
                className="text-[10px] text-amber-700 dark:text-amber-300"
              >
                â€¢ {blocker}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Combo Card
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function ComboCard({
  combo,
  metrics,
  copied,
  onCopy,
  onEdit,
  onDelete,
  onDuplicate,
  onTest,
  testing,
  onProxy,
  hasProxy,
  onToggle,
  providerNodes,
  dragDisabled,
  isDragged,
  isDropTarget,
  onDragStart,
  onDragEnd,
}) {
  const strategy = combo.strategy || "priority";
  const models = combo.models || [];
  const isDisabled = combo.isActive === false;
  const t = useTranslations("combos");
  const tc = useTranslations("common");
  const strategyDescription = getStrategyDescription(t, strategy);

  // Resolve provider UUID to user-defined name
  const formatModelDisplay = (modelValue) => {
    const parts = modelValue.split("/");
    if (parts.length !== 2) return modelValue;
    const [providerIdentifier, modelId] = parts;
    const matchedNode = (providerNodes || []).find(
      (node) => node.id === providerIdentifier || node.prefix === providerIdentifier
    );
    return matchedNode ? `${matchedNode.name}/${modelId}` : modelValue;
  };

  return (
    <Card
      padding="sm"
      className={`group transition-all ${
        isDisabled ? "opacity-50" : ""
      } ${isDropTarget ? "border border-primary/30 bg-primary/5" : ""} ${
        isDragged ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            draggable={!dragDisabled}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            data-testid={`combo-drag-handle-${combo.id}`}
            className={`p-1 rounded-md transition-colors shrink-0 ${
              dragDisabled
                ? "cursor-not-allowed text-text-muted/40"
                : "cursor-grab active:cursor-grabbing text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"
            }`}
            title={getI18nOrFallback(t, "reorderHandle", "Drag to reorder combo")}
            aria-label={getI18nOrFallback(t, "reorderHandle", "Drag to reorder combo")}
          >
            <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
          </button>

          {/* Icon */}
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[18px]">layers</span>
          </div>
          <div className="min-w-0 flex-1">
            {/* Name + Strategy Badge + Copy */}
            <div className="flex items-center gap-2">
              <code className="text-sm font-medium font-mono truncate">{combo.name}</code>
              <Tooltip content={strategyDescription}>
                <span
                  className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full ${getStrategyBadgeClass(
                    strategy
                  )}`}
                >
                  {getStrategyLabel(t, strategy)}
                </span>
              </Tooltip>
              {hasProxy && (
                <span
                  className="text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5"
                  title={t("proxyConfigured")}
                >
                  <span className="material-symbols-outlined text-[11px]">vpn_lock</span>
                  proxy
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(combo.name, `combo-${combo.id}`);
                }}
                className="p-0.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                title={t("copyComboName")}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {copied === `combo-${combo.id}` ? "check" : "content_copy"}
                </span>
              </button>
            </div>

            {/* Model tags with weights */}
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {models.length === 0 ? (
                <span className="text-xs text-text-muted italic">{t("noModels")}</span>
              ) : (
                models.slice(0, 3).map((entry, index) => {
                  const { model, weight } = normalizeModelEntry(entry);
                  return (
                    <code
                      key={index}
                      className="text-[10px] font-mono bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded text-text-muted"
                    >
                      {formatModelDisplay(model)}
                      {strategy === "weighted" && weight > 0 ? ` (${weight}%)` : ""}
                    </code>
                  );
                })
              )}
              {models.length > 3 && (
                <span className="text-[10px] text-text-muted">
                  {t("more", { count: models.length - 3 })}
                </span>
              )}
            </div>

            {/* Metrics row */}
            {metrics && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-text-muted">
                  <span className="text-emerald-500">{metrics.totalSuccesses}</span>/
                  {metrics.totalRequests} {t("reqs")}
                </span>
                <span className="text-[10px] text-text-muted">
                  {metrics.successRate}% {t("success")}
                </span>
                <span className="text-[10px] text-text-muted">~{metrics.avgLatencyMs}ms</span>
                {metrics.fallbackRate > 0 && (
                  <span className="text-[10px] text-amber-500">
                    {metrics.fallbackRate}% fallback
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <Toggle
            size="sm"
            checked={!isDisabled}
            onChange={onToggle}
            title={isDisabled ? t("enableCombo") : t("disableCombo")}
          />
          <div className="flex items-center gap-1 transition-opacity">
            <button
              onClick={onTest}
              disabled={testing}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-emerald-500 transition-colors"
              title={t("testCombo")}
            >
              <span
                className={`material-symbols-outlined text-[16px] ${testing ? "animate-spin" : ""}`}
              >
                {testing ? "progress_activity" : "play_arrow"}
              </span>
            </button>
            <button
              onClick={onDuplicate}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
              title={t("duplicate")}
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
            </button>
            <button
              onClick={onProxy}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
              title={t("proxyConfig")}
            >
              <span className="material-symbols-outlined text-[16px]">vpn_lock</span>
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded text-text-muted hover:text-primary transition-colors"
              title={tc("edit")}
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 hover:bg-red-500/10 rounded text-red-500 transition-colors"
              title={tc("delete")}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Test Results View
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function TestResultsView({ results }) {
  if (results.error) {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm">
        <span className="material-symbols-outlined text-[18px]">error</span>
        {typeof results.error === "string" ? results.error : JSON.stringify(results.error)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {results.resolvedBy && (
        <div className="flex items-center gap-2 text-sm">
          <span className="material-symbols-outlined text-emerald-500 text-[18px]">
            check_circle
          </span>
          <span>
            Resolved by:{" "}
            <code className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
              {results.resolvedBy}
            </code>
          </span>
        </div>
      )}
      {results.results?.map((r, i) => (
        <div
          key={i}
          title={r.error || undefined}
          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-black/[0.02] dark:bg-white/[0.02]"
        >
          <span
            className={`material-symbols-outlined text-[14px] ${
              r.status === "ok"
                ? "text-emerald-500"
                : r.status === "skipped"
                  ? "text-text-muted"
                  : "text-red-500"
            }`}
          >
            {r.status === "ok" ? "check_circle" : r.status === "skipped" ? "skip_next" : "error"}
          </span>
          <code className="font-mono flex-1">{r.model}</code>
          {r.latencyMs !== undefined && <span className="text-text-muted">{r.latencyMs}ms</span>}
          <span
            className={`text-[10px] uppercase font-medium ${
              r.status === "ok"
                ? "text-emerald-500"
                : r.status === "skipped"
                  ? "text-text-muted"
                  : "text-red-500"
            }`}
          >
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WeightTotalBar({ models }) {
  const total = models.reduce((sum, m) => sum + (m.weight || 0), 0);
  const isValid = total === 100;
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-indigo-500",
  ];

  return (
    <div className="mt-1.5">
      {/* Visual bar */}
      <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden flex">
        {models.map((m, i) => {
          if (!m.weight) return null;
          return (
            <div
              key={i}
              className={`${colors[i % colors.length]} transition-all duration-300`}
              style={{ width: `${Math.min(m.weight, 100)}%` }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex gap-1">
          {models.map(
            (m, i) =>
              m.weight > 0 && (
                <span key={i} className="flex items-center gap-0.5 text-[9px] text-text-muted">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${colors[i % colors.length]}`}
                  />
                  {m.weight}%
                </span>
              )
          )}
        </div>
        <span
          className={`text-[10px] font-medium ${
            isValid ? "text-emerald-500" : total > 100 ? "text-red-500" : "text-amber-500"
          }`}
        >
          {total}%{!isValid && total > 0 && " â‰  100%"}
        </span>
      </div>
    </div>
  );
}

