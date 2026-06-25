"use client";

import { Button, Modal, Input, ModelSelectModal } from "@/shared/components";
import Tooltip from "@/shared/components/Tooltip";
import {
  COMBO_TEMPLATE_FALLBACK,
  COMBO_TEMPLATES,
  STRATEGY_OPTIONS,
  getI18nOrFallback,
  getStrategyDescription,
  getStrategyLabel,
} from "./combos-page-helpers";
import {
  StrategyGuidanceCard,
  StrategyRecommendationsPanel,
} from "./combos-page-shared";
import { ComboFormModalAdvancedSection } from "./combos-form-modal-advanced-section";
import { ComboFormModalModelsSection } from "./combos-form-modal-models-section";
import type { ComboFormModalController } from "./combos-form-modal.hooks";
import type { ComboFormModalProps } from "./combos-form-modal.types";

type Props = ComboFormModalProps & {
  controller: ComboFormModalController;
};

export function ComboFormModalView({
  isOpen,
  controller,
  onClose,
  activeProviders,
}: Props) {
  const {
    t,
    tc,
    isEdit,
    name,
    setName,
    nameError,
    handleNameChange,
    strategy,
    setStrategy,
    showStrategyNudge,
    handleAutoBalance,
    applyStrategyRecommendations,
    applyTemplate,
    models,
    showAdvanced,
    setShowAdvanced,
    config,
    setConfig,
    agentSystemMessage,
    setAgentSystemMessage,
    agentToolFilter,
    setAgentToolFilter,
    agentContextCache,
    setAgentContextCache,
    saveBlocked,
    saving,
    handleSave,
    showModelSelect,
    setShowModelSelect,
    handleAddModel,
    modelAliases,
    formatModelDisplay,
    handleWeightChange,
    handleRemoveModel,
    handleMoveUp,
    handleMoveDown,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    dragIndex,
    dragOverIndex,
    readinessChecks,
    saveBlockers,
    weightTotal,
    pricedModelCount,
    pricingCoveragePercent,
    hasNoModels,
    hasRoundRobinSingleModel,
    hasCostOptimizedWithoutPricing,
    hasCostOptimizedPartialPricing,
    hasPricingForModel,
  } = controller;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? t("editCombo") : t("createCombo")}
        size="full"
      >
        <div className="flex flex-col gap-3">
          <div>
            <Input
              label={t("comboName")}
              value={name}
              onChange={handleNameChange}
              placeholder={t("comboNamePlaceholder")}
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">{t("nameHint")}</p>
          </div>

          {!isEdit && (
            <div className="rounded-lg border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-3">
              <div className="mb-2">
                <p className="text-xs font-medium">
                  {getI18nOrFallback(t, "templatesTitle", COMBO_TEMPLATE_FALLBACK.title)}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {getI18nOrFallback(
                    t,
                    "templatesDescription",
                    COMBO_TEMPLATE_FALLBACK.description
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                {COMBO_TEMPLATES.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className={`text-left rounded-md border px-3 py-2 transition-all ${
                      template.isFeatured
                        ? "border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-500/80 hover:bg-emerald-500/10 ring-1 ring-emerald-500/20"
                        : "border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.03] hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`material-symbols-outlined text-[16px] ${template.isFeatured ? "text-emerald-500" : "text-primary"}`}
                      >
                        {template.icon}
                      </span>
                      <span className="text-[12px] font-semibold text-text-main">
                        {getI18nOrFallback(t, template.titleKey, template.fallbackTitle)}
                      </span>
                      {template.isFeatured && (
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                          FREE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted mt-1.5 leading-[1.5]">
                      {getI18nOrFallback(t, template.descKey, template.fallbackDesc)}
                    </p>
                    <p
                      className={`text-[10px] mt-1.5 font-medium ${template.isFeatured ? "text-emerald-500" : "text-primary"}`}
                    >
                      {getI18nOrFallback(t, "templateApply", COMBO_TEMPLATE_FALLBACK.apply)}{" ->"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <label className="text-sm font-medium">{t("routingStrategy")}</label>
              <Tooltip content={getStrategyDescription(t, strategy)}>
                <span className="material-symbols-outlined text-[13px] text-text-muted cursor-help">
                  help
                </span>
              </Tooltip>
            </div>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/5 dark:bg-white/5 rounded-lg">
              {STRATEGY_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStrategy(s.value)}
                  data-testid={`strategy-option-${s.value}`}
                  title={getStrategyDescription(t, s.value)}
                  aria-label={`${getStrategyLabel(t, s.value)}. ${getStrategyDescription(
                    t,
                    s.value
                  )}`}
                  className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                    strategy === s.value
                      ? "bg-white dark:bg-bg-main shadow-sm text-primary"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] align-middle mr-0.5">
                    {s.icon}
                  </span>
                  {getStrategyLabel(t, s.value)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">
              {getStrategyDescription(t, strategy)}
            </p>
            <div className="mt-2">
              <StrategyGuidanceCard strategy={strategy} />
            </div>
            <div className="mt-2">
              <StrategyRecommendationsPanel
                strategy={strategy}
                onApply={applyStrategyRecommendations}
                showNudge={showStrategyNudge}
              />
            </div>
          </div>

          <ComboFormModalModelsSection
            t={t}
            models={models}
            strategy={strategy}
            weightTotal={weightTotal}
            pricedModelCount={pricedModelCount}
            pricingCoveragePercent={pricingCoveragePercent}
            hasNoModels={hasNoModels}
            hasRoundRobinSingleModel={hasRoundRobinSingleModel}
            hasCostOptimizedWithoutPricing={hasCostOptimizedWithoutPricing}
            hasCostOptimizedPartialPricing={hasCostOptimizedPartialPricing}
            hasInvalidWeightedTotal={controller.hasInvalidWeightedTotal}
            readinessChecks={readinessChecks}
            saveBlockers={saveBlockers}
            dragIndex={dragIndex}
            dragOverIndex={dragOverIndex}
            formatModelDisplay={formatModelDisplay}
            handleAutoBalance={handleAutoBalance}
            handleWeightChange={handleWeightChange}
            handleMoveUp={handleMoveUp}
            handleMoveDown={handleMoveDown}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleRemoveModel={handleRemoveModel}
            setShowModelSelect={setShowModelSelect}
            hasPricingForModel={hasPricingForModel}
          />

          <ComboFormModalAdvancedSection
            t={t}
            strategy={strategy}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            config={config}
            setConfig={setConfig}
            agentSystemMessage={agentSystemMessage}
            setAgentSystemMessage={setAgentSystemMessage}
            agentToolFilter={agentToolFilter}
            setAgentToolFilter={setAgentToolFilter}
            agentContextCache={agentContextCache}
            setAgentContextCache={setAgentContextCache}
          />

          <div className="flex gap-2 pt-1">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} fullWidth size="sm" disabled={saveBlocked}>
              {saving ? t("saving") : isEdit ? tc("save") : t("createCombo")}
            </Button>
          </div>
        </div>
      </Modal>

      <ModelSelectModal
        isOpen={showModelSelect}
        onClose={() => setShowModelSelect(false)}
        onSelect={handleAddModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={t("addModelToCombo")}
        selectedModel={null}
        addedModelValues={models.map((m) => m.model)}
      />
    </>
  );
}
