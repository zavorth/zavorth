import type { ModelPickerContract } from '../contracts/ModelPickerContract.js';
import type { UniversalAgentModelProfile } from '../runtime/agent/index.js';
import {
  ModelPickerService,
  type ModelPickerServiceResult,
} from '../services/providers/catalog/ModelPickerService.js';

export type CliModelPickerInput = {
  includeAdvanced?: boolean;
  selectedFamilyId?: string | null;
  selectedRouteId?: string | null;
  selectedModelId?: string | null;
};

function selectedRouteFromPicker(picker: ModelPickerServiceResult) {
  const selected = picker.selected;
  const family = picker.families.find((entry) => entry.id === selected.familyId)
    || picker.families.find((entry) => entry.ready)
    || picker.families[0]
    || null;
  const route = family?.routes.find((entry) => entry.id === selected.routeId)
    || family?.routes.find((entry) => entry.ready)
    || family?.routes[0]
    || null;
  return { family, route };
}

export function buildCliModelPicker(input: CliModelPickerInput = {}): ModelPickerServiceResult {
  return new ModelPickerService().buildPicker({
    includeAdvanced: input.includeAdvanced ?? true,
    selectedFamilyId: input.selectedFamilyId,
    selectedRouteId: input.selectedRouteId,
    selectedModelId: input.selectedModelId,
  });
}

export function buildCliModelPickerContract(input: CliModelPickerInput = {}): ModelPickerContract {
  return buildCliModelPicker(input).contract;
}

export function resolveCliUniversalModelProfile(input: {
  routingPolicy?: UniversalAgentModelProfile['routingPolicy'];
} = {}): UniversalAgentModelProfile {
  const picker = buildCliModelPicker();
  const contract = picker.contract;
  const selected = contract.selected;
  const pickerSelected = picker.selected;
  const { family, route } = selectedRouteFromPicker(picker);
  const routeCapabilities = route?.models.flatMap((model) => model.capabilities)
    || family?.capabilities
    || selected.capabilities
    || [];
  return {
    providerLabel: selected.providerLabel || selected.providerName || 'Zavorth',
    modelLabel: pickerSelected.modelId || selected.modelLabel || selected.modelName || 'current model',
    routingPolicy: input.routingPolicy || (pickerSelected.ready || selected.ready ? 'direct' : 'fallback'),
    routeId: pickerSelected.routeId || selected.routeId || undefined,
    familyId: pickerSelected.familyId || selected.familyId || family?.id || undefined,
    selectionSource: selected.source,
    readiness: route?.readiness || selected.readiness,
    ready: pickerSelected.ready || selected.ready,
    fallbackOrder: selected.fallbackOrder ? [...selected.fallbackOrder] : undefined,
    selectionExplanation: picker.explanation.length > 0 ? [...picker.explanation] : [...selected.explanation],
    supportsTools: true,
    supportsVision: routeCapabilities.includes('vision'),
    supportsStreaming: routeCapabilities.includes('streaming'),
  };
}

export function resolveCliUniversalModelLabel(): string {
  return resolveCliUniversalModelProfile().modelLabel;
}

export function renderCliModelCatalogCards(params: {
  selectedIndex?: number;
  estimatedTokens?: number;
  requiresHighReasoning?: boolean;
} = {}): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ZavorthTerminalCanvasFX } = require('../services/tui/ZavorthTerminalCanvasFX.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ModelCatalogCardPickerRenderer } = require('./components/ModelCatalogCardPicker.js');

  const canvasFx = new ZavorthTerminalCanvasFX();
  const cardRenderer = new ModelCatalogCardPickerRenderer();

  const picker = buildCliModelPicker();
  const modelList: Array<import('../services/tui/ZavorthTerminalCanvasFX.js').ModelCardMetrics> = [];

  for (const family of picker.families) {
    for (const route of family.routes) {
      for (const model of route.models) {
        const isLocal = family.id.includes('ollama') || family.id.includes('local') || route.id.includes('local');
        const caps = model.capabilities as readonly string[];
        const hasLargeContext = caps.some((c) => c.includes('context') || c.includes('large'));
        const hasReasoning = caps.some((c) => c.includes('reason') || c.includes('deep'));

        modelList.push({
          id: model.id,
          name: model.label,
          provider: family.label,
          contextWindowTokens: hasLargeContext ? 200000 : 32000,
          costPer1MInputUsd: isLocal ? 0 : 3,
          costPer1MOutputUsd: isLocal ? 0 : 15,
          reasoningScore: hasReasoning ? 9 : 6,
          speedTokensPerSec: isLocal ? 90 : 45,
          isLocal,
        });
      }
    }
  }

  const recommendations = canvasFx.recommendModels(modelList, {
    estimatedTokens: params.estimatedTokens || 8000,
    requiresHighReasoning: params.requiresHighReasoning ?? true,
    prioritizeLocal: false,
    budgetSensitive: false,
  });

  return cardRenderer.render({
    selectedIndex: params.selectedIndex ?? 0,
    recommendations: recommendations.slice(0, 8),
  });
}
