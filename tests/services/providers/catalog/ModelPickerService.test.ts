import { describe, it, expect } from 'vitest';
import {
  ModelPickerExplainabilityService,
} from '../../../../src/services/providers/catalog/ModelPickerExplainabilityService.js';
import {
  ModelPickerService,
} from '../../../../src/services/providers/catalog/ModelPickerService.js';

describe('ModelPickerService', () => {
  it('builds a canonical picker contract with a multi-route family', () => {
    const service = new ModelPickerService();

    const result = service.buildPicker({
      includeAdvanced: true,
      selectedFamilyId: 'claude',
      selectedRouteId: 'anthropic',
      selectedModelId: 'claude-3-opus-20240229',
    });

    const claude = result.families.find((family) => family.id === 'claude');

    expect(result.schemaVersion).toBe(1);
    expect(result.contract.routes.routes.map((route) => route.id)).toEqual(expect.arrayContaining([
      'anthropic',
      'claude',
    ]));
    expect(claude).toEqual(expect.objectContaining({
      id: 'claude',
      routes: expect.arrayContaining([
        expect.objectContaining({
          id: 'anthropic',
          models: expect.arrayContaining([
            expect.objectContaining({ modelId: 'claude-3-opus-20240229' }),
          ]),
        }),
        expect.objectContaining({ id: 'claude' }),
      ]),
    }));
    expect(result.selected).toEqual(expect.objectContaining({
      familyId: 'claude',
      routeId: 'anthropic',
      modelId: 'claude-3-opus-20240229',
    }));
  });

  it('keeps model source explainability visible for onboarding', () => {
    const explainability = new ModelPickerExplainabilityService();

    expect(explainability.describeCatalogSource('live_api')).toContain('discovery ao vivo');
    expect(explainability.describeCatalogSource('local_catalog')).toContain('catalogo local');
    expect(explainability.describeCatalogSource('fallback_catalog')).toContain('fallback');
  });
});
