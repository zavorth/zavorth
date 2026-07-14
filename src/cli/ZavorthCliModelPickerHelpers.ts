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
