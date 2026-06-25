"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  Dispatch,
  DragEvent,
  MutableRefObject,
  SetStateAction,
} from "react";
import { useTranslations } from "next-intl";
import { useNotificationStore } from "@/store/notificationStore";
import {
  COMBO_TEMPLATES,
  VALID_NAME_REGEX,
  getI18nOrFallback,
  normalizeModelEntry,
} from "./combos-page-helpers";
import {
  COMBO_FORM_STRATEGY_DEFAULTS,
  FREE_STACK_PRESET_MODELS,
  PAID_PREMIUM_PRESET_MODELS,
} from "./combos-form-modal.constants";
import type { ComboFormModalProps, CreateDraftSnapshot } from "./combos-form-modal.types";

type ComboModelEntry = {
  model: string;
  weight?: number;
};

function buildEmptyCreateDraftSnapshot(): CreateDraftSnapshot {
  return {
    name: "",
    models: [],
    strategy: "priority",
    config: {},
    showAdvanced: false,
    nameError: "",
    agentSystemMessage: "",
    agentToolFilter: "",
    agentContextCache: false,
  };
}

export type ComboFormModalController = {
  t: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  notify: ReturnType<typeof useNotificationStore>;
  isEdit: boolean;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  models: ComboModelEntry[];
  setModels: Dispatch<SetStateAction<ComboModelEntry[]>>;
  strategy: string;
  setStrategy: Dispatch<SetStateAction<string>>;
  showModelSelect: boolean;
  setShowModelSelect: Dispatch<SetStateAction<boolean>>;
  saving: boolean;
  nameError: string;
  pricingByProvider: Record<string, Record<string, unknown>>;
  modelAliases: Record<string, string>;
  providerNodes: Array<{ id?: string; prefix?: string; name?: string }>;
  showAdvanced: boolean;
  setShowAdvanced: Dispatch<SetStateAction<boolean>>;
  config: Record<string, unknown>;
  setConfig: Dispatch<SetStateAction<Record<string, unknown>>>;
  showStrategyNudge: boolean;
  agentSystemMessage: string;
  setAgentSystemMessage: Dispatch<SetStateAction<string>>;
  agentToolFilter: string;
  setAgentToolFilter: Dispatch<SetStateAction<string>>;
  agentContextCache: boolean;
  setAgentContextCache: Dispatch<SetStateAction<boolean>>;
  dragIndex: number | null;
  dragOverIndex: number | null;
  weightTotal: number;
  pricedModelCount: number;
  pricingCoveragePercent: number;
  hasNoModels: boolean;
  hasRoundRobinSingleModel: boolean;
  hasCostOptimizedWithoutPricing: boolean;
  hasCostOptimizedPartialPricing: boolean;
  hasInvalidWeightedTotal: boolean;
  saveBlocked: boolean;
  readinessChecks: Array<{ id: string; ok: boolean; label: string }>;
  saveBlockers: string[];
  handleNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleAddModel: (model: { value: string }) => void;
  handleRemoveModel: (index: number) => void;
  handleWeightChange: (index: number, weight: string | number) => void;
  handleAutoBalance: () => void;
  applyStrategyRecommendations: () => void;
  applyTemplate: (template: (typeof COMBO_TEMPLATES)[number]) => void;
  formatModelDisplay: (modelValue: string) => string;
  handleMoveUp: (index: number) => void;
  handleMoveDown: (index: number) => void;
  handleDragStart: (e: DragEvent<HTMLElement>, index: number) => void;
  handleDragEnd: (e: DragEvent<HTMLElement>) => void;
  handleDragOver: (e: DragEvent<HTMLElement>, index: number) => void;
  handleDrop: (e: DragEvent<HTMLElement>, dropIndex: number) => void;
  handleSave: () => Promise<void>;
  resetFormForCombo: (nextCombo: any, comboDefaults?: any) => void;
  createDraftStateRef: MutableRefObject<CreateDraftSnapshot>;
  hasPricingForModel: (modelValue: string) => boolean;
};

export function useComboFormModalController({
  isOpen,
  combo,
  onClose,
  onSave,
  activeProviders,
}: ComboFormModalProps): ComboFormModalController {
  const t = useTranslations("combos");
  const tc = useTranslations("common");
  const notify = useNotificationStore();
  const createDraftStateRef = useRef<CreateDraftSnapshot>(buildEmptyCreateDraftSnapshot());
  const strategyChangeMountedRef = useRef(false);
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState<ComboModelEntry[]>(
    () => (combo?.models || []).map((m) => normalizeModelEntry(m)) as ComboModelEntry[]
  );
  const [strategy, setStrategy] = useState(combo?.strategy || "priority");
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [pricingByProvider, setPricingByProvider] = useState<Record<string, Record<string, unknown>>>(
    {}
  );
  const [modelAliases, setModelAliases] = useState<Record<string, string>>({});
  const [providerNodes, setProviderNodes] = useState<Array<{ id?: string; prefix?: string; name?: string }>>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>(combo?.config || {});
  const [showStrategyNudge, setShowStrategyNudge] = useState(false);
  const [agentSystemMessage, setAgentSystemMessage] = useState<string>(
    combo?.system_message || ""
  );
  const [agentToolFilter, setAgentToolFilter] = useState<string>(combo?.tool_filter_regex || "");
  const [agentContextCache, setAgentContextCache] = useState<boolean>(
    !!combo?.context_cache_protection
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isEdit = !!combo;

  const resetFormForCombo = useCallback(
    (nextCombo: any, comboDefaults: any = null) => {
      const nextDefaults =
        nextCombo || comboDefaults
          ? {
              ...(comboDefaults || {}),
            }
          : {};
      const nextConfig = nextCombo?.config
        ? { ...nextCombo.config }
        : Object.fromEntries(Object.entries(nextDefaults).filter(([key]) => key !== "strategy"));

      setName(nextCombo?.name || "");
      setModels((nextCombo?.models || []).map((m: unknown) => normalizeModelEntry(m)) as ComboModelEntry[]);
      setStrategy(nextCombo?.strategy || comboDefaults?.strategy || "priority");
      setConfig(nextConfig);
      setShowAdvanced(false);
      setNameError("");
      setAgentSystemMessage(nextCombo?.system_message || "");
      setAgentToolFilter(nextCombo?.tool_filter_regex || "");
      setAgentContextCache(!!nextCombo?.context_cache_protection);
    },
    []
  );

  const fetchModalData = useCallback(async () => {
    try {
      const [aliasesRes, nodesRes, pricingRes] = await Promise.all([
        fetch("/api/models/alias"),
        fetch("/api/provider-nodes"),
        fetch("/api/pricing"),
      ]);

      if (!aliasesRes.ok || !nodesRes.ok) {
        throw new Error(`Failed to fetch data: aliases=${aliasesRes.status}, nodes=${nodesRes.status}`);
      }

      const pricingData = pricingRes.ok ? await pricingRes.json() : {};
      const [aliasesData, nodesData] = await Promise.all([aliasesRes.json(), nodesRes.json()]);

      setPricingByProvider(
        pricingData && typeof pricingData === "object" && !Array.isArray(pricingData)
          ? pricingData
          : {}
      );
      setModelAliases(aliasesData.aliases || {});
      setProviderNodes(nodesData.nodes || []);
    } catch (error) {
      console.error("Error fetching modal data:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void fetchModalData();
  }, [fetchModalData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    if (combo) {
      resetFormForCombo(combo);
      return () => {
        cancelled = true;
      };
    }

    createDraftStateRef.current = buildEmptyCreateDraftSnapshot();
    resetFormForCombo(null, null);

    const loadDefaults = async () => {
      try {
        const response = await fetch("/api/settings/combo-defaults");
        const data = response.ok ? await response.json() : {};
        const draft = createDraftStateRef.current;
        const isPristineDraft =
          draft.name.trim().length === 0 &&
          draft.models.length === 0 &&
          draft.strategy === "priority" &&
          Object.keys(draft.config || {}).length === 0 &&
          draft.showAdvanced === false &&
          draft.nameError.length === 0 &&
          draft.agentSystemMessage.length === 0 &&
          draft.agentToolFilter.length === 0 &&
          draft.agentContextCache === false;

        if (!cancelled && isPristineDraft) {
          resetFormForCombo(null, data.comboDefaults || null);
        }
      } catch {
        // Keep the blank create form if defaults fail to load.
      }
    };

    void loadDefaults();

    return () => {
      cancelled = true;
    };
  }, [combo, isOpen, resetFormForCombo]);

  useEffect(() => {
    createDraftStateRef.current = {
      name,
      models,
      strategy,
      config,
      showAdvanced,
      nameError,
      agentSystemMessage,
      agentToolFilter,
      agentContextCache,
    };
  }, [
    agentContextCache,
    agentSystemMessage,
    agentToolFilter,
    config,
    models,
    name,
    nameError,
    showAdvanced,
    strategy,
  ]);

  useEffect(() => {
    if (!strategyChangeMountedRef.current) {
      strategyChangeMountedRef.current = true;
      return;
    }

    setShowStrategyNudge(true);
    const timeoutId = setTimeout(() => setShowStrategyNudge(false), 2600);
    return () => clearTimeout(timeoutId);
  }, [strategy]);

  const hasPricingForModel = useCallback(
    (modelValue: string) => {
      const parts = modelValue.split("/");
      if (parts.length !== 2) return false;

      const [providerIdentifier, modelId] = parts;
      const matchedNode = providerNodes.find(
        (node) => node.id === providerIdentifier || node.prefix === providerIdentifier
      );

      const providerCandidates = [providerIdentifier];
      if (matchedNode?.apiType) providerCandidates.push(matchedNode.apiType);
      if (matchedNode?.name) providerCandidates.push(String(matchedNode.name).toLowerCase());

      return providerCandidates.some((candidate) => !!pricingByProvider?.[candidate]?.[modelId]);
    },
    [pricingByProvider, providerNodes]
  );

  const weightTotal = models.reduce((sum, modelEntry) => sum + (modelEntry.weight || 0), 0);
  const pricedModelCount = models.reduce(
    (count, modelEntry) => count + (hasPricingForModel(modelEntry.model) ? 1 : 0),
    0
  );
  const pricingCoveragePercent =
    models.length > 0 ? Math.round((pricedModelCount / models.length) * 100) : 0;
  const hasNoModels = models.length === 0;
  const hasRoundRobinSingleModel = strategy === "round-robin" && models.length === 1;
  const hasCostOptimizedWithoutPricing =
    strategy === "cost-optimized" && models.length > 0 && pricedModelCount === 0;
  const hasCostOptimizedPartialPricing =
    strategy === "cost-optimized" &&
    models.length > 0 &&
    pricedModelCount > 0 &&
    pricedModelCount < models.length;
  const hasInvalidWeightedTotal = strategy === "weighted" && models.length > 0 && weightTotal !== 100;
  const saveBlocked =
    !name.trim() ||
    !!nameError ||
    saving ||
    hasNoModels ||
    hasInvalidWeightedTotal ||
    hasCostOptimizedWithoutPricing;
  const readinessChecks = [
    {
      id: "name",
      ok: !!name.trim() && !nameError,
      label: getI18nOrFallback(t, "readinessCheckName", "Combo name is valid"),
    },
    {
      id: "models",
      ok: !hasNoModels,
      label: getI18nOrFallback(t, "readinessCheckModels", "At least one model is selected"),
    },
    {
      id: "weights",
      ok: strategy === "weighted" ? !hasInvalidWeightedTotal : true,
      label:
        strategy === "weighted"
          ? getI18nOrFallback(t, "readinessCheckWeights", "Weighted total is 100%")
          : getI18nOrFallback(t, "readinessCheckWeightsOptional", "Weight rule not required"),
    },
    {
      id: "pricing",
      ok: strategy === "cost-optimized" ? !hasCostOptimizedWithoutPricing : true,
      label:
        strategy === "cost-optimized"
          ? getI18nOrFallback(t, "readinessCheckPricing", "Pricing data is available")
          : getI18nOrFallback(t, "readinessCheckPricingOptional", "Pricing rule not required"),
    },
  ];
  const saveBlockers: string[] = [];
  if (!name.trim()) {
    saveBlockers.push(getI18nOrFallback(t, "saveBlockName", "Define a combo name."));
  } else if (nameError) {
    saveBlockers.push(nameError);
  }
  if (hasNoModels) {
    saveBlockers.push(getI18nOrFallback(t, "saveBlockModels", "Add at least one model."));
  }
  if (hasInvalidWeightedTotal) {
    saveBlockers.push(
      typeof t.has === "function" && t.has("saveBlockWeighted")
        ? t("saveBlockWeighted", { total: weightTotal })
        : `Set weights to 100% (current: ${weightTotal}%).`
    );
  }
  if (hasCostOptimizedWithoutPricing) {
    saveBlockers.push(
      getI18nOrFallback(
        t,
        "saveBlockPricing",
        "Add pricing for at least one model or choose a different strategy."
      )
    );
  }

  const validateName = (value: string) => {
    if (!value.trim()) {
      setNameError(t("nameRequired"));
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError(t("nameInvalid"));
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model: { value: string }) => {
    if (!models.find((m) => m.model === model.value)) {
      setModels([...models, { model: model.value, weight: 0 }]);
    }
  };

  const handleRemoveModel = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleWeightChange = (index: number, weight: string | number) => {
    const newModels = [...models];
    newModels[index] = {
      ...newModels[index],
      weight: Math.max(0, Math.min(100, Number(weight) || 0)),
    };
    setModels(newModels);
  };

  const handleAutoBalance = () => {
    const count = models.length;
    if (count === 0) return;
    const weight = Math.floor(100 / count);
    const remainder = 100 - weight * count;
    setModels(
      models.map((m, i) => ({
        ...m,
        weight: weight + (i === 0 ? remainder : 0),
      }))
    );
  };

  const applyStrategyRecommendations = () => {
    const defaults = COMBO_FORM_STRATEGY_DEFAULTS[strategy] || COMBO_FORM_STRATEGY_DEFAULTS.priority;
    setConfig((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(defaults)) {
        if (next[key] === undefined || next[key] === null || next[key] === "") {
          next[key] = value;
        }
      }
      return next;
    });

    if (strategy === "weighted" && models.length > 1) {
      handleAutoBalance();
    }

    if (strategy === "round-robin") {
      setShowAdvanced(true);
    }

    notify.success(
      getI18nOrFallback(t, "recommendationsApplied", "Recommendations applied to this combo.")
    );
  };

  const applyTemplate = (template: (typeof COMBO_TEMPLATES)[number]) => {
    setStrategy(template.strategy);
    setConfig((prev) => ({ ...prev, ...template.config }));
    if (!name.trim()) setName(template.suggestedName);
    if (template.id === "free-stack") {
      setModels(FREE_STACK_PRESET_MODELS as ComboModelEntry[]);
    } else if (template.id === "paid-premium") {
      setModels(PAID_PREMIUM_PRESET_MODELS as ComboModelEntry[]);
    }
  };

  const formatModelDisplay = useCallback(
    (modelValue: string) => {
      const parts = modelValue.split("/");
      if (parts.length !== 2) return modelValue;

      const [providerIdentifier, modelId] = parts;
      const matchedNode = providerNodes.find(
        (node) => node.id === providerIdentifier || node.prefix === providerIdentifier
      );

      if (matchedNode) {
        return `${matchedNode.name}/${modelId}`;
      }

      return modelValue;
    },
    [providerNodes]
  );

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    setModels(newModels);
  };

  const handleMoveDown = (index: number) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    setModels(newModels);
  };

  const handleDragStart = (e: DragEvent<HTMLElement>, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
    if (e.target) {
      setTimeout(() => ((e.currentTarget as HTMLElement).style.opacity = "0.5"), 0);
    }
  };

  const handleDragEnd = (e: DragEvent<HTMLElement>) => {
    if (e.target) (e.currentTarget as HTMLElement).style.opacity = "1";
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: DragEvent<HTMLElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (e: DragEvent<HTMLElement>, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex;
    if (fromIndex === null || fromIndex === dropIndex) return;

    const newModels = [...models];
    const [moved] = newModels.splice(fromIndex, 1);
    newModels.splice(dropIndex, 0, moved);
    setModels(newModels);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    if (hasNoModels || hasInvalidWeightedTotal || hasCostOptimizedWithoutPricing) return;
    setSaving(true);

    const saveData: any = {
      name: name.trim(),
      models: strategy === "weighted" ? models : models.map((m) => m.model),
      strategy,
    };

    const configToSave = { ...config };
    if (strategy === "round-robin") {
      if (config.concurrencyPerModel !== undefined)
        configToSave.concurrencyPerModel = config.concurrencyPerModel;
      if (config.queueTimeoutMs !== undefined) configToSave.queueTimeoutMs = config.queueTimeoutMs;
    }
    if (Object.keys(configToSave).length > 0) {
      saveData.config = configToSave;
    }

    if (agentSystemMessage.trim()) saveData.system_message = agentSystemMessage.trim();
    else delete saveData.system_message;
    if (agentToolFilter.trim()) saveData.tool_filter_regex = agentToolFilter.trim();
    else delete saveData.tool_filter_regex;
    if (agentContextCache) saveData.context_cache_protection = true;
    else delete saveData.context_cache_protection;

    await onSave(saveData);
    setSaving(false);
  };

  return {
    t,
    tc,
    notify,
    isEdit,
    name,
    setName,
    models,
    setModels,
    strategy,
    setStrategy,
    showModelSelect,
    setShowModelSelect,
    saving,
    nameError,
    pricingByProvider,
    modelAliases,
    providerNodes,
    showAdvanced,
    setShowAdvanced,
    config,
    setConfig,
    showStrategyNudge,
    agentSystemMessage,
    setAgentSystemMessage,
    agentToolFilter,
    setAgentToolFilter,
    agentContextCache,
    setAgentContextCache,
    dragIndex,
    dragOverIndex,
    weightTotal,
    pricedModelCount,
    pricingCoveragePercent,
    hasNoModels,
    hasRoundRobinSingleModel,
    hasCostOptimizedWithoutPricing,
    hasCostOptimizedPartialPricing,
    hasInvalidWeightedTotal,
    saveBlocked,
    readinessChecks,
    saveBlockers,
    handleNameChange,
    handleAddModel,
    handleRemoveModel,
    handleWeightChange,
    handleAutoBalance,
    applyStrategyRecommendations,
    applyTemplate,
    formatModelDisplay,
    handleMoveUp,
    handleMoveDown,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleSave,
    resetFormForCombo,
    createDraftStateRef,
    hasPricingForModel,
  };
}
