import type {
  ModelCatalogProviderInput,
  ModelCatalogSourceKind,
} from '../ModelCatalogAggregationService.js';

export class StaticCatalogDiscoveryAdapter {
  public discover(input: {
    providerId: string;
    alias?: string | null;
    label?: string | null;
    active?: boolean;
    source?: ModelCatalogSourceKind;
    models: Array<{ id: string; name?: string | null; type?: ModelCatalogProviderInput['models'][number]['type'] }>;
  }): ModelCatalogProviderInput {
    return {
      providerId: input.providerId,
      alias: input.alias,
      label: input.label,
      active: input.active,
      source: input.source || 'provider_catalog',
      models: input.models.map((model) => ({
        id: model.id,
        name: model.name || model.id,
        type: model.type || 'chat',
        source: input.source || 'provider_catalog',
      })),
    };
  }
}
