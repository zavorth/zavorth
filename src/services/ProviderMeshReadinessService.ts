import type {
  ModelCapabilityKind,
  ModelModality,
} from '../contracts/ModelPickerContract.js';
import type {
  ProviderMeshReadinessAdapterStrategy,
  ProviderMeshReadinessProviderEntry,
  ProviderMeshReadinessSnapshot,
  ProviderMeshReadinessStatus,
} from '../contracts/ProviderMeshReadinessContract.js';
import { ZAVORTH_PROVIDER_MESH_READINESS_CONTRACT_VERSION } from '../contracts/ProviderMeshReadinessContract.js';
import { ProviderIntegrationRegistry } from './providers/catalog/ProviderIntegrationRegistry.js';

import { CapabilityNormalizationService, DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES } from './CapabilityNormalizationService.js';
import { ProviderCompatibilityClassifier } from './providers/catalog/ProviderCompatibilityClassifier.js';
import type { ProviderRuntimeAdapterKind } from './providers/catalog/ProviderCompatibilityClassifier.js';
import {
  createMinimalProviderIntegrationManifest,
  type ProviderIntegrationManifest,
  type ProviderIntegrationRouteManifest,
} from './providers/catalog/ProviderIntegrationManifest.js';

type ProviderMeshReadinessRuntime = {
  now?: () => Date;
  sourceProviders?: string[];
  normalizationService?: CapabilityNormalizationService;
  registry?: ProviderIntegrationRegistry;
  classifier?: ProviderCompatibilityClassifier;
};

export class ProviderMeshReadinessService {
  private readonly now: () => Date;
  private readonly sourceProviders: string[];
  private readonly normalization: CapabilityNormalizationService;
  private readonly registry: ProviderIntegrationRegistry;
  private readonly classifier: ProviderCompatibilityClassifier;

  constructor(runtime: ProviderMeshReadinessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.normalization = runtime.normalizationService || new CapabilityNormalizationService();
    this.sourceProviders = runtime.sourceProviders || DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES
      .filter((sourceName) => this.normalization.resolveSourceModule(sourceName).primitiveId === 'provider.call');
    this.registry = runtime.registry || new ProviderIntegrationRegistry();
    this.classifier = runtime.classifier || new ProviderCompatibilityClassifier();
  }

  public buildSnapshot(input: { sourceProviders?: string[] } = {}): ProviderMeshReadinessSnapshot {
    const sourceProviders = input.sourceProviders || this.sourceProviders;
    const entries = sourceProviders
      .map((sourceName) => this.buildEntry(sourceName))
      .sort((left, right) => left.normalizedSourceName.localeCompare(right.normalizedSourceName));
    const generatedProviderManifests = entries
      .filter((entry) => entry.generatedProviderManifest)
      .map((entry) => entry.manifest);
    const generatedPluginManifests = entries.map((entry) => entry.generatedPluginManifest);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PROVIDER_MESH_READINESS_CONTRACT_VERSION,
      primitiveId: 'provider.call',
      summary: {
        sourceProviders: entries.length,
        firstClass: entries.filter((entry) => entry.status === 'first-class').length,
        cataloged: entries.filter((entry) => entry.status === 'cataloged').length,
        genericCompatible: entries.filter((entry) => entry.status === 'generic-compatible').length,
        templateReady: entries.filter((entry) => entry.status === 'template-ready').length,
        unsupported: entries.filter((entry) => entry.status === 'unsupported').length,
        unmapped: entries.filter((entry) => entry.status === 'unmapped').length,
        generatedProviderManifests: generatedProviderManifests.length,
        generatedPluginManifests: generatedPluginManifests.length,
        secretValuesSerialized: false,
      },
      entries,
      unsupported: entries.filter((entry) => entry.status === 'unsupported' || entry.status === 'unmapped'),
      generatedProviderManifests,
      generatedPluginManifests,
    };
  }

  public buildEntry(sourceName: string): ProviderMeshReadinessProviderEntry {
    const mapping = this.normalization.resolveSourceModule(sourceName);
    if (mapping.primitiveId !== 'provider.call') {
      const generated = this.createGeneratedManifest(sourceName);
      const route = generated.routes[0];
      const classification = this.classifier.classify(route);
      return {
        sourceName,
        normalizedSourceName: mapping.normalizedSourceName,
        status: 'unmapped',
        mapping,
        manifest: generated,
        route,
        generatedProviderManifest: true,
        generatedPluginManifest: this.normalization.buildManifestTemplate('openai').manifest,
        adapterStrategy: 'unmapped',
        runtimeAdapter: classification.runtimeAdapter,
        runtimeSupported: false,
        firstClassProvider: false,
        genericCompatible: false,
        routeKind: route.routeKind,
        capabilities: route.capabilities,
        modalities: route.modalities,
        credentialPolicy: {
          authKind: route.authKind,
          credentialRefs: route.credentialRefs || [],
          secretValuesSerialized: false,
          requiresOperatorConfiguration: true,
        },
        smokeGate: this.buildSmokeGate(sourceName, 'unmapped', false),
        findings: ['source module is not normalized to provider.call'],
        classification,
      };
    }

    const resolved = this.registry.resolveProvider(sourceName) || this.registry.resolveProvider(mapping.normalizedSourceName);
    const generatedProviderManifest = !resolved;
    const manifest = resolved?.manifest || this.createGeneratedManifest(mapping.normalizedSourceName);
    const route = resolved?.primaryRoute || manifest.routes[0];
    const classification = this.classifier.classify(route);
    const adapterStrategy = this.resolveAdapterStrategy(classification.runtimeAdapter);
    const status = this.resolveStatus({
      resolved: Boolean(resolved),
      runtimeSupported: classification.runtimeSupported,
      firstClassProvider: classification.firstClassProvider,
      genericCompatible: classification.genericCompatible,
      runtimeAdapter: classification.runtimeAdapter,
    });
    const findings = this.buildFindings({
      sourceName: mapping.normalizedSourceName,
      status,
      resolved: Boolean(resolved),
      route,
      classification,
    });

    return {
      sourceName,
      normalizedSourceName: mapping.normalizedSourceName,
      status,
      mapping,
      manifest,
      route,
      generatedProviderManifest,
      generatedPluginManifest: this.normalization.buildManifestTemplate(sourceName).manifest,
      adapterStrategy,
      runtimeAdapter: classification.runtimeAdapter,
      runtimeSupported: classification.runtimeSupported,
      firstClassProvider: classification.firstClassProvider,
      genericCompatible: classification.genericCompatible,
      routeKind: route.routeKind,
      capabilities: route.capabilities,
      modalities: route.modalities,
      credentialPolicy: {
        authKind: route.authKind,
        credentialRefs: route.credentialRefs || [],
        secretValuesSerialized: false,
        requiresOperatorConfiguration: route.authKind !== 'none' && route.authKind !== 'local_endpoint',
      },
      smokeGate: this.buildSmokeGate(mapping.normalizedSourceName, status, classification.runtimeSupported),
      findings,
      classification,
    };
  }

  private createGeneratedManifest(sourceName: string): ProviderIntegrationManifest {
    const normalized = this.normalizeId(sourceName);
    return createMinimalProviderIntegrationManifest({
      id: normalized,
      label: this.toLabel(normalized),
      vendorId: normalized,
      providerId: normalized,
      providerName: normalized,
      aliases: [normalized, `${normalized}-compatible`],
      routeKind: this.isLocalProvider(normalized)
        ? 'local_runtime'
        : this.isAnthropicProvider(normalized)
          ? 'official'
          : 'custom_compatible',
      mode: this.isLocalProvider(normalized) ? 'local' : 'cloud',
      authKind: this.isLocalProvider(normalized) ? 'local_endpoint' : 'api_key',
      credentialRefs: this.isLocalProvider(normalized)
        ? [`${this.toEnvPrefix(normalized)}_BASE_URL`]
        : this.isAnthropicProvider(normalized)
          ? [`${this.toEnvPrefix(normalized)}_API_KEY`]
          : [`${this.toEnvPrefix(normalized)}_API_KEY`, `${this.toEnvPrefix(normalized)}_BASE_URL`],
      capabilities: this.inferCapabilities(normalized),
      modalities: this.inferModalities(normalized),
      defaultModelName: null,
      source: 'operator',
    });
  }

  private resolveStatus(input: {
    resolved: boolean;
    runtimeSupported: boolean;
    firstClassProvider: boolean;
    genericCompatible: boolean;
    runtimeAdapter: ProviderRuntimeAdapterKind;
  }): ProviderMeshReadinessStatus {
    if (!input.runtimeSupported) {
      return 'unsupported';
    }
    if (input.firstClassProvider) {
      return 'first-class';
    }
    if (input.genericCompatible || input.runtimeAdapter === 'openai_compatible') {
      return 'generic-compatible';
    }
    return input.resolved ? 'cataloged' : 'template-ready';
  }

  private resolveAdapterStrategy(runtimeAdapter: ProviderRuntimeAdapterKind): ProviderMeshReadinessAdapterStrategy {
    switch (runtimeAdapter) {
      case 'bespoke':
        return 'bespoke-runtime';
      case 'gateway':
        return 'gateway-runtime';
      case 'openai_compatible':
        return 'openai-compatible-runtime';
      case 'anthropic_compatible':
        return 'anthropic-compatible-runtime';
      case 'local_openai_compatible':
        return 'local-openai-compatible-runtime';
      default:
        return 'template-required';
    }
  }

  private buildFindings(input: {
    sourceName: string;
    status: ProviderMeshReadinessStatus;
    resolved: boolean;
    route: ProviderIntegrationRouteManifest;
    classification: ReturnType<ProviderCompatibilityClassifier['classify']>;
  }): string[] {
    const findings: string[] = [];
    const credentialRefs = input.route.credentialRefs || [];
    if (!input.resolved) {
      findings.push('provider manifest generated from Connector registry consistency template');
    }
    if (input.status === 'unsupported') {
      findings.push('runtime adapter is not yet supported');
    }
    if (credentialRefs.length === 0 && input.route.authKind !== 'none') {
      findings.push('credential refs are missing');
    }
    if (input.classification.baseUrlRequired && !credentialRefs.some((ref) => ref.includes('BASE_URL'))) {
      findings.push('base URL ref should be declared for compatible runtime');
    }
    return findings.length > 0 ? findings : ['provider has a governed consistency route'];
  }

  private buildSmokeGate(
    sourceName: string,
    status: ProviderMeshReadinessStatus,
    runtimeSupported: boolean,
  ): ProviderMeshReadinessProviderEntry['smokeGate'] {
    return {
      id: `provider-mesh:${sourceName}`,
      command: `ProviderFactory.resolveRuntimeTarget(${JSON.stringify(sourceName)})`,
      liveCallRequired: false,
      expected: runtimeSupported
        ? 'runtime target resolves without provider network call'
        : status === 'unsupported'
          ? 'adapter gap remains explicit until implemented'
          : 'source remains explicit until normalized',
    };
  }

  private inferCapabilities(sourceName: string): ModelCapabilityKind[] {
    if (['voyage'].includes(sourceName)) {
      return ['embedding'];
    }
    if (['perplexity'].includes(sourceName)) {
      return ['chat', 'research', 'streaming'];
    }
    if (['byteplus', 'volcengine'].includes(sourceName)) {
      return ['chat', 'vision', 'multimodal'];
    }
    return ['chat', 'coding', 'streaming'];
  }

  private inferModalities(sourceName: string): ModelModality[] {
    if (['voyage'].includes(sourceName)) {
      return ['embedding'];
    }
    if (['byteplus', 'volcengine'].includes(sourceName)) {
      return ['text', 'image', 'video'];
    }
    return ['text'];
  }

  private isLocalProvider(sourceName: string): boolean {
    return ['lmstudio', 'sglang', 'vllm'].includes(sourceName);
  }

  private isAnthropicProvider(sourceName: string): boolean {
    return sourceName.includes('anthropic') || sourceName.includes('claude');
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private toEnvPrefix(value: string): string {
    return this.normalizeId(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  private toLabel(value: string): string {
    return value
      .split(/[-_.:]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
