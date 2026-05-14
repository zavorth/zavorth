"use client";

import {
  ComboReadinessPanel,
  WeightTotalBar,
} from "./combos-page-shared";
import { getI18nOrFallback } from "./combos-page-helpers";
import type { ComboFormModalController } from "./combos-form-modal.hooks";

type Props = Pick<
  ComboFormModalController,
  | "t"
  | "models"
  | "strategy"
  | "weightTotal"
  | "pricedModelCount"
  | "pricingCoveragePercent"
  | "hasNoModels"
  | "hasRoundRobinSingleModel"
  | "hasCostOptimizedWithoutPricing"
  | "hasCostOptimizedPartialPricing"
  | "hasInvalidWeightedTotal"
  | "readinessChecks"
  | "saveBlockers"
  | "dragIndex"
  | "dragOverIndex"
  | "formatModelDisplay"
  | "handleAutoBalance"
  | "handleWeightChange"
  | "handleMoveUp"
  | "handleMoveDown"
  | "handleDragStart"
  | "handleDragEnd"
  | "handleDragOver"
  | "handleDrop"
  | "handleRemoveModel"
  | "setShowModelSelect"
  | "hasPricingForModel"
>;

export function ComboFormModalModelsSection(props: Props) {
  const {
    t,
    models,
    strategy,
    weightTotal,
    pricedModelCount,
    pricingCoveragePercent,
    hasNoModels,
    hasRoundRobinSingleModel,
    hasCostOptimizedWithoutPricing,
    hasCostOptimizedPartialPricing,
    hasInvalidWeightedTotal,
    readinessChecks,
    saveBlockers,
    dragIndex,
    dragOverIndex,
    formatModelDisplay,
    handleAutoBalance,
    handleWeightChange,
    handleMoveUp,
    handleMoveDown,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleRemoveModel,
    setShowModelSelect,
    hasPricingForModel,
  } = props;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium">{t("models")}</label>
        {strategy === "weighted" && models.length > 1 && (
          <button
            onClick={handleAutoBalance}
            className="text-[10px] text-primary hover:text-primary/80 transition-colors"
          >
            {t("autoBalance")}
          </button>
        )}
      </div>

      {models.length === 0 ? (
        <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
          <span className="material-symbols-outlined text-text-muted text-xl mb-1">layers</span>
          <p className="text-xs text-text-muted">{t("noModelsYet")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
          {models.map((entry, index) => (
            <div
              key={`${entry.model}-${index}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={`group/item flex items-center gap-1.5 px-2 py-1.5 rounded-md transition-all cursor-grab active:cursor-grabbing ${
                dragOverIndex === index && dragIndex !== index
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] border border-transparent"
              } ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <span className="material-symbols-outlined text-[14px] text-text-muted/40 cursor-grab shrink-0">
                drag_indicator
              </span>
              <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0 px-1 text-xs text-text-main truncate">
                {formatModelDisplay(entry.model)}
              </div>

              {strategy === "cost-optimized" && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase font-semibold ${
                    hasPricingForModel(entry.model)
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}
                  title={
                    hasPricingForModel(entry.model)
                      ? getI18nOrFallback(t, "pricingAvailable", "Pricing available")
                      : getI18nOrFallback(t, "pricingMissing", "No pricing")
                  }
                >
                  {hasPricingForModel(entry.model)
                    ? getI18nOrFallback(t, "pricingAvailableShort", "priced")
                    : getI18nOrFallback(t, "pricingMissingShort", "no-price")}
                </span>
              )}

              {strategy === "weighted" && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={entry.weight}
                    onChange={(e) => handleWeightChange(index, e.target.value)}
                    className="w-10 text-[11px] text-center py-0.5 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                  />
                  <span className="text-[10px] text-text-muted">%</span>
                </div>
              )}

              {strategy === "priority" && (
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className={`p-0.5 rounded ${index === 0 ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
                    title={t("moveUp")}
                  >
                    <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === models.length - 1}
                    className={`p-0.5 rounded ${index === models.length - 1 ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
                    title={t("moveDown")}
                  >
                    <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => handleRemoveModel(index)}
                className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all"
                title={t("removeModel")}
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {strategy === "weighted" && models.length > 0 && <WeightTotalBar models={models} />}

      {strategy === "cost-optimized" && models.length > 0 && (
        <div className="mt-2 rounded-md border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-text-muted">
              {getI18nOrFallback(t, "pricingCoverage", "Pricing coverage")}
            </span>
            <span className="font-medium text-text-main">
              {pricedModelCount}/{models.length} ({pricingCoveragePercent}%)
            </span>
          </div>
          <div className="h-1.5 mt-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                pricingCoveragePercent === 100
                  ? "bg-emerald-500"
                  : pricingCoveragePercent > 0
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${pricingCoveragePercent}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted mt-1">
            {getI18nOrFallback(
              t,
              "pricingCoverageHint",
              "Cost-optimized works best when all combo models have pricing."
            )}
          </p>
        </div>
      )}

      {hasNoModels && (
        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">warning</span>
          <span>{t("noModelsYet")}</span>
        </div>
      )}

      {hasInvalidWeightedTotal && (
        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">warning</span>
          <span>
            {t("weighted")} {weightTotal}% {"\u2260"} 100%. {t("autoBalance")}
          </span>
        </div>
      )}

      {hasRoundRobinSingleModel && (
        <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1.5 text-[10px] text-blue-700 dark:text-blue-300 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">info</span>
          <span>
            {getI18nOrFallback(
              t,
              "warningRoundRobinSingleModel",
              "Round-robin is most useful with at least 2 models."
            )}
          </span>
        </div>
      )}

      {hasCostOptimizedPartialPricing && (
        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">warning</span>
          <span>
            {typeof t.has === "function" && t.has("warningCostOptimizedPartialPricing")
              ? t("warningCostOptimizedPartialPricing", {
                  priced: pricedModelCount,
                  total: models.length,
                })
              : `Only ${pricedModelCount} of ${models.length} models have pricing. Routing may be partially cost-aware.`}
          </span>
        </div>
      )}

      {hasCostOptimizedWithoutPricing && (
        <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">warning</span>
          <span>
            {getI18nOrFallback(
              t,
              "warningCostOptimizedNoPricing",
              "No pricing data found for this combo. Cost-optimized may route unexpectedly."
            )}
          </span>
        </div>
      )}

      <div className="mt-2">
        <ComboReadinessPanel checks={readinessChecks} blockers={saveBlockers} />
      </div>

      <button
        onClick={() => setShowModelSelect(true)}
        className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-text-muted hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center gap-1"
      >
        <span className="material-symbols-outlined text-[16px]">add</span>
        {t("addModel")}
      </button>
    </div>
  );
}
