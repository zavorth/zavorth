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
        return 'Lista vinda de catalogo local do runtime.';
      case 'fallback_catalog':
      case 'fallback':
        return 'Lista vinda de fallback curado porque discovery ao vivo nao esta disponivel.';
      case 'custom_model':
        return 'Lista vinda de modelos customizados by the operator.';
      case 'imported_model':
        return 'Lista vinda de modelos importados.';
      case 'provider_catalog':
      case 'static':
      case 'runtime_config':
      case 'operator':
      default:
        return 'Lista vinda do catalogo canonico do provider.';
    }
  }

  public describeRoute(input: ModelPickerExplainabilityRouteInput): string[] {
    const { route, modelCount } = input;
    const readiness = route.ready
      ? 'rota pronta'
      : route.issue || route.readinessCode || route.readiness;
    return [
      `${route.label}: ${readiness}.`,
      this.describeCatalogSource(route.catalogSource),
      modelCount > 0
        ? `${modelCount} modelo(s) disponivel(is) para esta rota.`
        : 'Nenhum modelo enumerado; o runtime pode aceitar modelo manual ou passthrough.',
    ];
  }

  public describeFamily(family: ModelFamilyCatalogEntry, routes: AccessRouteCatalogEntry[]): string[] {
    const readyRoutes = routes.filter((route) => route.ready);
    const sources = Array.from(new Set(routes.map((route) => route.catalogSource)));
    return [
      readyRoutes.length > 0
        ? `${family.label} tem ${readyRoutes.length} rota(s) pronta(s).`
        : `${family.label} ainda precisa de configuracao ou probe antes da selecao automatica.`,
      ...sources.map((source) => this.describeCatalogSource(source)),
    ];
  }
}
