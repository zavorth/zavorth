/**
 * Provider Mesh Convergence Check Configuration
 * 
 * Centralized configuration for convergence check rules and needles.
 * Can be extended via environment variables.
 */

/**
 * @typedef {Object} ConvergenceRule
 * @property {string} id
 * @property {string} label
 * @property {string} target
 * @property {string[]} files
 * @property {string[]} [needles]
 */

/**
 * @typedef {Object} ConvergenceWarning
 * @property {string} id
 * @property {string} label
 * @property {string} target
 * @property {string} observed
 * @property {string[]} details
 */

/**
 * @typedef {Object} ConvergenceConfig
 * @property {ConvergenceRule[]} rules
 * @property {ConvergenceWarning[]} warnings
 */

// Default rules - can be extended via ZAVORTH_CONVERGENCE_EXTRA_RULES env
export function getConvergenceRules() {
  return [
    {
      id: 'provider-mesh-canonical-stack',
      label: 'canonical Provider Mesh stack exists',
      target: 'contracts, registry, catalog, route resolution, picker, selection, compatibility and onboarding services exist',
      files: [
        'src/contracts/ModelPickerContract.ts',
        'src/services/providers/catalog/ProviderCatalogContracts.ts',
        'src/services/providers/catalog/ProviderCatalogCompat.ts',
        'src/services/providers/catalog/ProviderIntegrationRegistry.ts',
        'src/services/providers/catalog/ProviderIntegrationManifest.ts',
        'src/services/providers/catalog/ModelCatalogAggregationService.ts',
        'src/services/providers/catalog/AccessRouteResolutionService.ts',
        'src/services/providers/catalog/ModelPickerService.ts',
        'src/services/providers/catalog/ModelSelectionService.ts',
        'src/services/providers/catalog/ProviderCompatibilityClassifier.ts',
        'src/services/providers/catalog/CustomCompatibleProviderOnboardingService.ts',
        'src/services/providers/catalog/ProviderMeshOnboardingProductService.ts',
      ],
    },
    {
      id: 'catalog-api-facades',
      label: 'catalog APIs use aggregation service',
      target: 'api/models/catalog and api/v1/models/catalog delegate to ModelCatalogAggregationService',
      files: [
        'src/zavorth-control/app/api/models/catalog/route.ts',
        'src/zavorth-control/app/api/v1/models/catalog.ts',
      ],
      needles: ['ModelCatalogAggregationService'],
    },
    {
      id: 'provider-model-discovery-facade',
      label: 'provider model listing uses discovery adapters',
      target: 'provider model listing delegates compatible discovery to adapters',
      files: [
        'src/zavorth-control/app/api/providers/[id]/models/providerModelsFetchers.ts',
      ],
      needles: [
        'OpenAiCompatibleModelDiscoveryAdapter',
        'AnthropicCompatibleModelDiscoveryAdapter',
      ],
    },
    {
      id: 'onboarding-model-picker-consumer',
      label: 'onboarding consumes model picker',
      target: 'onboarding reads /api/onboarding/model-picker',
      files: [
        'src/zavorth-control/app/(zavorthControl)/control/onboarding/page.tsx',
      ],
      needles: ['/api/onboarding/model-picker'],
    },
    {
      id: 'provider-mesh-product-onboarding',
      label: 'onboarding exposes Provider Mesh product snapshot',
      target: 'model picker API returns the C7 capability-first providerMeshOnboarding snapshot',
      files: [
        'src/zavorth-control/app/api/onboarding/model-picker/route.ts',
      ],
      needles: [
        'ProviderMeshOnboardingProductService',
        'providerMeshOnboarding',
        'requestedCapability',
      ],
    },
    {
      id: 'providers-page-model-picker-consumer',
      label: 'providers page consumes model picker',
      target: 'providers page reads advanced picker and passes pickerRoute to cards',
      files: [
        'src/zavorth-control/app/(zavorthControl)/control/providers/page.tsx',
      ],
      needles: [
        '/api/onboarding/model-picker...includeAdvanced=true',
        'pickerRoute=',
        'ProvidersModelPickerSummary',
      ],
    },
    {
      id: 'control-model-picker-consumer',
      label: '/zavorthControl consumes model picker snapshot',
      target: 'Gateway Console renders snapshot.modelPicker without rebuilding selection rules',
      files: [
        'src/zavorth-control/app/(zavorthControl)/control/zavorth-control/components/ZavorthControlGatewayConsole.tsx',
      ],
      needles: [
        'snapshot?.modelPicker',
        'modelPickerSelected',
        'modelPickerRoutes',
      ],
    },
    {
      id: 'cli-model-picker-consumer',
      label: 'CLI consumes model picker service',
      target: 'CLI builds UniversalAgentModelProfile from ModelPickerService',
      files: [
        'src/cli/ZavorthCliModelPickerHelpers.ts',
      ],
      needles: [
        'ModelPickerService',
        'UniversalAgentModelProfile',
        'buildCliModelPickerContract',
        'resolveCliUniversalModelProfile',
      ],
    },
    {
      id: 'control-plane-selection-resolution',
      label: 'control plane resolves selected profiles',
      target: 'ProviderControlPlaneService resolves SelectedModelProfile through ModelSelectionService',
      files: [
        'src/services/ProviderControlPlaneService.ts',
      ],
      needles: [
        'SelectedModelProfile',
        'resolveSelectedModelProfile',
        'ModelSelectionService',
      ],
    },
    {
      id: 'strategy-selection-consumer',
      label: 'strategy consumes selected profiles',
      target: 'ProviderStrategyService keeps family, route, provider and fallback profiles in the decision',
      files: [
        'src/services/ProviderStrategyService.ts',
      ],
      needles: [
        'SelectedModelProfile',
        'selectedModelProfile',
        'fallbackProfiles',
        'familyId',
        'routeId',
      ],
    },
    {
      id: 'runtime-selection-bridge',
      label: 'runtime factory resolves selected routes',
      target: 'ProviderFactory resolves SelectedModelProfile through compatibility classification',
      files: [
        'src/providers/ProviderFactory.ts',
      ],
      needles: [
        'SelectedModelProfile',
        'ProviderCompatibilityClassifier',
        'resolveRuntimeTarget',
        'custom-openai-compatible',
      ],
    },
    {
      id: 'provider-mesh-convergence-tests',
      label: 'provider mesh convergence tests exist',
      target: 'catalog, picker, selection and runtime bridge tests are present',
      files: [
        'tests/services/providers/catalog/ProviderIntegrationRegistry.test.ts',
        'tests/services/providers/catalog/ModelCatalogAggregationService.test.ts',
        'tests/services/providers/catalog/AccessRouteResolutionService.test.ts',
        'tests/services/providers/catalog/ModelPickerService.test.ts',
        'tests/services/providers/catalog/ModelSelectionService.test.ts',
        'tests/services/providers/catalog/ProviderCompatibilityClassifier.test.ts',
        'tests/services/providers/catalog/CustomCompatibleProviderOnboardingService.test.ts',
        'tests/services/providers/catalog/ProviderMeshOnboardingProductService.test.ts',
        'tests/providers/ProviderFactoryModelSelectionBridge.test.ts',
        'tests/zavorth-control/OnboardingModelPickerSurface.test.ts',
        'tests/zavorth-control/ProvidersPageModelPickerSurface.test.ts',
        'tests/cli/ZavorthCliModelPickerHelpers.test.ts',
      ],
    },
  ];
}

export function getConvergenceWarnings() {
  return [
    {
      id: 'provider-detail-model-picker-followup',
      label: 'provider detail model panels are follow-up convergence work',
      target: 'provider detail can be migrated after the canonical API/CLI/zavorthControl/runtime path stays green',
      observed: '',
      details: [],
    },
    {
      id: 'workspace-hardening-known-blocker',
      label: 'workspace:check remains blocked by global hardening thresholds',
      target: 'full workspace gate should be green before productization/stable claims',
      observed: '',
      details: [],
    },
  ];
}

export function getConvergenceConfig() {
  return {
    rules: getConvergenceRules(),
    warnings: getConvergenceWarnings(),
  };
}