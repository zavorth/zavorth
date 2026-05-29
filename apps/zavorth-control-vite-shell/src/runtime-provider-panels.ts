type RuntimeProviderPanelsOptions = {
  entityCardHtml: (input: any) => string;
  escapeHtml: (value: unknown) => string;
  numberLabel: (value: unknown, fallback?: string) => string;
  state: any;
};

export function createRuntimeProviderPanels(options: RuntimeProviderPanelsOptions) {
  const { entityCardHtml, escapeHtml, numberLabel, state } = options;

  function updateProviderModelCatalog() {
    const catalog = state.providerModelCatalog?.providerModelCatalog || state.providerModelCatalog;
    const summaryGrid = document.querySelector('[data-provider-model-catalog-summary]');
    const list = document.querySelector('[data-provider-model-catalog-list]');
    if (!summaryGrid || !list) return;

    if (!catalog || catalog.surface !== 'provider-model-catalog') {
      summaryGrid.innerHTML = `
        <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Ready</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">waiting</span></div>
      `;
      list.innerHTML = entityCardHtml({
        title: 'Catalog waiting',
        id: 'read-only',
        status: 'Waiting',
        detail: 'The runtime has not published the model catalog yet.',
      });
      window.ZavorthLocale?.apply(document.getElementById('sector-config') || document);
      return;
    }

    const summary = catalog.summary || {};
    const sections = catalog.sections || {};
    summaryGrid.innerHTML = `
      <div class="info-row"><span class="info-row__label">Routes</span><span class="info-row__value mono">${numberLabel(summary.providerRoutes || 0)} total / ${numberLabel(summary.defaultRouteAllowed || 0)} default</span></div>
      <div class="info-row"><span class="info-row__label">Ready</span><span class="info-row__value mono">${numberLabel(summary.liveReadyRoutes || 0)} proven / ${numberLabel(summary.catalogReadyButNotLive || 0)} need proof</span></div>
      <div class="info-row"><span class="info-row__label">Models</span><span class="info-row__value mono">${numberLabel(summary.effectiveModelSurface || 0)} visible / ${numberLabel(summary.liveDiscoveredModels || 0)} live</span></div>
      <div class="info-row"><span class="info-row__label">Media</span><span class="info-row__value mono">${numberLabel((sections.mediaCapable || []).length)} route(s)</span></div>
    `;

    const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
    const topProviders = [
      ...providers.filter((provider) => provider.liveReady),
      ...providers.filter((provider) => !provider.liveReady && provider.catalogReady),
      ...providers.filter((provider) => !provider.catalogReady),
    ].slice(0, 6);
    list.innerHTML = topProviders.map((provider) => entityCardHtml({
      title: provider.label || provider.id,
      id: `${provider.id} - ${provider.routeKind || 'route'}`,
      status: provider.liveReady ? 'Ready' : provider.catalogReady ? 'Needs proof' : 'Configure',
      detail: `${numberLabel(provider.effectiveModelCount || 0)} model(s). ${escapeHtml((provider.modelSample || []).slice(0, 3).join(', ') || provider.userAction || 'No model listed yet.')}`,
      meta: `<span class="badge badge--muted">${escapeHtml((provider.modalities || []).join(' / ') || 'text')}</span><span class="badge badge--muted">${escapeHtml(provider.defaultRouteAllowed ? 'default allowed' : 'waiting for readiness')}</span>`,
    })).join('') || entityCardHtml({
      title: 'No provider route',
      id: 'catalog',
      status: 'Empty',
      detail: 'No provider route has been published yet.',
    });
    window.ZavorthLocale?.apply(document.getElementById('sector-config') || document);
  }

  function updateProviderActivation() {
    const activation = state.providerActivation?.providerActivation || state.providerActivation;
    const summaryGrid = document.querySelector('[data-provider-activation-summary]');
    const list = document.querySelector('[data-provider-activation-list]');
    if (!summaryGrid || !list) return;

    if (!activation || activation.surface !== 'provider-activation') {
      summaryGrid.innerHTML = `
        <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">waiting</span></div>
        <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">waiting</span></div>
      `;
      list.innerHTML = entityCardHtml({
        title: 'Activation waiting',
        id: 'read-only',
        status: 'Waiting',
        detail: 'Provider activation has not been published by the runtime yet.',
      });
      window.ZavorthLocale?.apply(document.getElementById('sector-config') || document);
      return;
    }

    const summary = activation.summary || {};
    summaryGrid.innerHTML = `
      <div class="info-row"><span class="info-row__label">Execution</span><span class="info-row__value mono">${numberLabel(summary.executionReady || 0)} ready / ${numberLabel(summary.routes || 0)} route(s)</span></div>
      <div class="info-row"><span class="info-row__label">Proof</span><span class="info-row__value mono">${numberLabel(summary.liveReady || 0)} live / ${numberLabel(summary.needsLiveProof || 0)} need proof</span></div>
      <div class="info-row"><span class="info-row__label">Adapters</span><span class="info-row__value mono">${numberLabel(summary.nativeAdapters || 0)} native / ${numberLabel(summary.openAiCompatibleAdapters || 0)} compatible</span></div>
      <div class="info-row"><span class="info-row__label">Connectors</span><span class="info-row__value mono">${numberLabel(summary.needsConnector || 0)} gap(s)</span></div>
    `;

    const routes = Array.isArray(activation.routes) ? activation.routes : [];
    const topRoutes = [
      ...routes.filter((route) => route.executionReady),
      ...routes.filter((route) => !route.executionReady && route.liveReady),
      ...routes.filter((route) => !route.liveReady),
    ].slice(0, 8);
    list.innerHTML = topRoutes.map((route) => entityCardHtml({
      title: route.label || route.id,
      id: `${route.id} - ${route.adapterKind || 'adapter'}`,
      status: route.executionReady ? 'Executable' : route.liveReady ? 'Needs connector' : 'Needs proof',
      detail: `${numberLabel(route.modelCount || 0)} model(s). ${escapeHtml(route.setupAction || route.connectorAction || 'Review provider activation.')}`,
      meta: `<span class="badge badge--muted">${escapeHtml((route.modalities || []).join(' / ') || 'text')}</span><span class="badge badge--muted">${escapeHtml(route.liveProofCommand || 'live proof command unavailable')}</span>`,
    })).join('') || entityCardHtml({
      title: 'No activation routes',
      id: 'activation',
      status: 'Empty',
      detail: 'No provider activation route has been projected yet.',
    });
    window.ZavorthLocale?.apply(document.getElementById('sector-config') || document);
  }

  return {
    updateProviderActivation,
    updateProviderModelCatalog,
  };
}
