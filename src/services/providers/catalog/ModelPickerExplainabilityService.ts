import type {
  AccessRouteCatalogEntry,
  ModelFamilyCatalogEntry,
  ProviderCatalogSource,
} from './ProviderCatalogContracts.js';

export type ModelPickerExplainabilityRouteInput = {
  route: AccessRouteCatalogEntry;
  modelCount: number;
};

export class ModelPickerExplainabilityService {
  public describeCatalogSource(source: ProviderCatalogSource): string {
    switch (source) {
      case 'live_api':
        return 'Lista vinda de discovery ao vivo do provider.';
      case 'local_catalog':
        return 'Lista vinda de catalog local do runtime.';
      case 'fallback_catalog':
      case 'fallback':
        return 'List sourced from a curated fallback because live discovery is unavailable.';
      case 'custom_model':
        return 'Lista vinda de models customizados by the operator.';
      case 'imported_model':
        return 'Lista vinda de models importados.';
      case 'provider_catalog':
      case 'static':
      case 'runtime_config':
      case 'operator':
      default:
        return 'Lista vinda do catalog canonical do provider.';
    }
  }

  public describeRoute(input: ModelPickerExplainabilityRouteInput): string[] {
    const { route, modelCount } = input;
    const readiness = route.ready ? 'route ready'
      : route.issue || route.readinessCode || route.readiness;
    return [
      `${route.label}: ${readiness}.`,
      this.describeCatalogSource(route.catalogSource),
      modelCount > 0
        ? `${modelCount} model(s) available(is) para is route.`
        : 'No model enumerado; o runtime pode aceitar model manual ou passthrough.',
    ];
  }

  public describeFamily(family: ModelFamilyCatalogEntry, routes: AccessRouteCatalogEntry[]): string[] {
    const readyRoutes = routes.filter((route) => route.ready);
    const sources = Array.from(new Set(routes.map((route) => route.catalogSource)));
    return [
      readyRoutes.length > 0
        ? `${family.label} tem ${readyRoutes.length} route(s) ready.`
        : `${family.label} still needs configuration or a probe before automatic selection.`,
      ...sources.map((source) => this.describeCatalogSource(source)),
    ];
  }
}
