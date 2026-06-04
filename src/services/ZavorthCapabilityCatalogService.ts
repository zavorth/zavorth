import type {
  CapabilityDefinition,
  CapabilitySummary,
  CapabilityType,
} from '../contracts/CapabilityContract.js';
import type { IntegrationCatalogEntry, IntegrationCatalogSnapshot } from '../contracts/IntegrationHubContract.js';
import type { PlatformCapability } from '../contracts/PlatformContract.js';
import type { ZavorthCapabilityActionSurfaceSnapshot } from '../contracts/ZavorthCapabilityActionSurfaceContract.js';
import { getDefaultCapabilityRegistry, type CapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { ZavorthCapabilityActionSurfaceService } from './ZavorthCapabilityActionSurfaceService.js';
import { ZavorthAgentOperatingSystemService } from './ZavorthAgentOperatingSystemService.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';
import { ProviderDoctorService } from './ProviderDoctorService.js';

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'getAll' | 'getSummary'>;
type PlatformCapabilityServiceLike = Pick<PlatformCapabilityService, 'getCapabilities'>;
type IntegrationHubServiceLike = Pick<IntegrationHubService, 'buildCatalogSnapshot'>;
type ProviderDoctorServiceLike = Pick<ProviderDoctorService, 'inspect'>;
type AgentOperatingSystemServiceLike = Pick<ZavorthAgentOperatingSystemService, 'buildSnapshot'>;
type CapabilityActionSurfaceServiceLike = Pick<ZavorthCapabilityActionSurfaceService, 'buildSnapshot'>;

type ZavorthCapabilityCatalogRuntime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  capabilityRegistry?: CapabilityRegistryLike;
  platformCapabilityService?: PlatformCapabilityServiceLike;
  integrationHubService?: IntegrationHubServiceLike;
  providerDoctorService?: ProviderDoctorServiceLike;
  agentOperatingSystemService?: AgentOperatingSystemServiceLike;
  capabilityActionSurfaceService?: CapabilityActionSurfaceServiceLike;
};

export type ZavorthCapabilityCategorySnapshot = {
  type: CapabilityType;
  label: string;
  total: number;
  commands: number;
  implicitRoutes: number;
  builtin: number;
  plugin: number;
  featured: Array<{
    id: string;
    label: string;
    description: string;
    command: string | null;
    executorPreference: string | null;
    source: 'builtin' | 'plugin';
  }>;
};

export type ZavorthCapabilityFeaturedCommand = {
  id: string;
  label: string;
  description: string;
  command: string;
  usage: string | null;
  section: string;
  executorPreference: string | null;
  source: 'builtin' | 'plugin';
};

export type ZavorthCapabilityFeaturedRoute = {
  id: string;
  label: string;
  description: string;
  routingReason: string;
  executorPreference: string | null;
  confidence: number | null;
};

export type ZavorthCapabilityCatalogSnapshot = {
  generatedAt: string;
  summary: CapabilitySummary & {
    categories: number;
    readyPlatforms: number;
    installedIntegrations: number;
    readyIntegrations: number;
  };
  categories: ZavorthCapabilityCategorySnapshot[];
  featuredCommands: ZavorthCapabilityFeaturedCommand[];
  featuredImplicitRoutes: ZavorthCapabilityFeaturedRoute[];
  platforms: {
    entries: PlatformCapability[];
    summary: {
      ready: number;
      partial: number;
      planned: number;
      disabled: number;
    };
  };
  integrations: {
    total: number;
    ready: number;
    needsConfiguration: number;
    templates: number;
    installed: number;
    featured: Array<{
      id: string;
      label: string;
      summary: string;
      readiness: IntegrationCatalogEntry['readiness'];
      category: string;
    }>;
  };
  providers: {
    total: number;
    ready: number;
    needsConfiguration: number;
    needsProbe: number;
    activeProviderName: string;
    activeModelName: string;
    recommendedProfile: string;
    featured: Array<{
      id: string;
      label: string;
      readiness: 'ready' | 'needs_config' | 'needs_probe';
      currentModel: string | null;
      mode: string;
    }>;
    recommendations: string[];
  };
  mcp: {
    total: number;
    enabled: number;
    connected: number;
    failed: number;
    tools: number;
    capabilities: string[];
    featured: Array<{
      id: string;
      capability: string | null;
      status: string;
      toolCount: number;
    }>;
    recommendations: string[];
  };
  agentOs: {
    roles: number;
    loops: number;
    activeLoops: number;
    resumableLoops: number;
    sddLoopReady: boolean;
    featuredLoops: Array<{
      id: string;
      label: string;
      status: 'idle' | 'active' | 'resumable';
      entryCommand: string;
    }>;
  };
  capabilityActions: ZavorthCapabilityActionSurfaceSnapshot;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

const CATEGORY_LABELS: Record<CapabilityType, string> = {
  executor: 'Executores',
  workflow: 'Workflows',
  research: 'Pesquisa',
  automation: 'Automacao',
  integration: 'Integracoes',
};

export class ZavorthCapabilityCatalogService {
  private readonly now: () => Date;
  private readonly capabilityRegistry: CapabilityRegistryLike;
  private readonly platformCapabilityService: PlatformCapabilityServiceLike;
  private readonly integrationHubService: IntegrationHubServiceLike;
  private readonly providerDoctorService: ProviderDoctorServiceLike;
  private readonly agentOperatingSystemService: AgentOperatingSystemServiceLike;
  private readonly capabilityActionSurfaceService: CapabilityActionSurfaceServiceLike;

  constructor(runtime: ZavorthCapabilityCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.platformCapabilityService = runtime.platformCapabilityService || new PlatformCapabilityService();
    this.integrationHubService = runtime.integrationHubService || new IntegrationHubService();
    this.providerDoctorService = runtime.providerDoctorService || new ProviderDoctorService();
    this.agentOperatingSystemService = runtime.agentOperatingSystemService || new ZavorthAgentOperatingSystemService();
    this.capabilityActionSurfaceService = runtime.capabilityActionSurfaceService || new ZavorthCapabilityActionSurfaceService({
      projectRoot: runtime.projectRoot,
      env: runtime.env,
      now: this.now,
    });
  }

  public buildSnapshot(): ZavorthCapabilityCatalogSnapshot {
    const capabilities = this.capabilityRegistry.getAll();
    const summary = this.capabilityRegistry.getSummary();
    const platformEntries = this.platformCapabilityService.getCapabilities();
    const platformSummary = this.summarizePlatforms(platformEntries);
    const integrationSnapshot = this.integrationHubService.buildCatalogSnapshot();
    const integrationSummary = this.summarizeIntegrations(integrationSnapshot);
    const providerSummary = this.summarizeProviders();
    const mcpSummary = this.summarizeMcp(integrationSnapshot);
    const agentOsSummary = this.summarizeAgentOs();
    const capabilityActions = this.capabilityActionSurfaceService.buildSnapshot();
    const categories = this.buildCategorySnapshots(capabilities);
    const featuredCommands = this.buildFeaturedCommands(capabilities);
    const featuredImplicitRoutes = this.buildFeaturedImplicitRoutes(capabilities);

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        ...summary,
        categories: categories.length,
        readyPlatforms: platformSummary.ready,
        installedIntegrations: integrationSummary.installed,
        readyIntegrations: integrationSummary.ready,
      },
      categories,
      featuredCommands,
      featuredImplicitRoutes,
      platforms: {
        entries: platformEntries,
        summary: platformSummary,
      },
      integrations: integrationSummary,
      providers: providerSummary,
      mcp: mcpSummary,
      agentOs: agentOsSummary,
      capabilityActions,
      narrative: this.buildNarrative(summary, platformSummary, integrationSummary, providerSummary, mcpSummary, agentOsSummary),
    };
  }

  private buildCategorySnapshots(capabilities: CapabilityDefinition[]): ZavorthCapabilityCategorySnapshot[] {
    const grouped = new Map<CapabilityType, CapabilityDefinition[]>();
    for (const capability of capabilities) {
      const list = grouped.get(capability.type) || [];
      list.push(capability);
      grouped.set(capability.type, list);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([type, items]) => ({
        type,
        label: CATEGORY_LABELS[type] || type,
        total: items.length,
        commands: items.filter((capability) => capability.command).length,
        implicitRoutes: items.filter((capability) => !capability.command && capability.matchers?.length).length,
        builtin: items.filter((capability) => capability.source !== 'plugin').length,
        plugin: items.filter((capability) => capability.source === 'plugin').length,
        featured: this.sortCapabilities(items)
          .slice(0, 4)
          .map((capability) => ({
            id: capability.id,
            label: capability.label,
            description: capability.description,
            command: capability.command?.command || null,
            executorPreference: capability.executor_preference ?? null,
            source: capability.source === 'plugin' ? 'plugin' : 'builtin',
          })),
      }));
  }

  private buildFeaturedCommands(capabilities: CapabilityDefinition[]): ZavorthCapabilityFeaturedCommand[] {
    return this.sortCapabilities(capabilities.filter((capability) => capability.command && capability.command.hidden !== true))
      .slice(0, 6)
      .map((capability) => ({
        id: capability.id,
        label: capability.label,
        description: capability.command?.description || capability.description,
        command: capability.command?.command || '',
        usage: capability.command?.usage || null,
        section: capability.command?.section || 'execution',
        executorPreference: capability.command?.explicit_executor ?? capability.executor_preference ?? null,
        source: capability.source === 'plugin' ? 'plugin' : 'builtin',
      }));
  }

  private buildFeaturedImplicitRoutes(capabilities: CapabilityDefinition[]): ZavorthCapabilityFeaturedRoute[] {
    return capabilities
      .filter((capability) => !capability.command && capability.matchers?.length)
      .sort((left, right) => {
        const rightScore = Number(right.priority || right.routing_confidence || 0);
        const leftScore = Number(left.priority || left.routing_confidence || 0);
        return rightScore - leftScore || left.label.localeCompare(right.label);
      })
      .slice(0, 6)
      .map((capability) => ({
        id: capability.id,
        label: capability.label,
        description: capability.description,
        routingReason: capability.routing_reason || capability.intent || 'Rota automatica sem resumo adicional.',
        executorPreference: capability.executor_preference ?? null,
        confidence: Number.isFinite(Number(capability.routing_confidence))
          ? Number(capability.routing_confidence)
          : null,
      }));
  }

  private summarizePlatforms(entries: PlatformCapability[]): {
    ready: number;
    partial: number;
    planned: number;
    disabled: number;
  } {
    const summary = {
      ready: 0,
      partial: 0,
      planned: 0,
      disabled: 0,
    };

    for (const entry of entries) {
      if (entry.readiness === 'ready') {
        summary.ready += 1;
      } else if (entry.readiness === 'partial') {
        summary.partial += 1;
      } else if (entry.readiness === 'planned') {
        summary.planned += 1;
      } else {
        summary.disabled += 1;
      }
    }

    return summary;
  }

  private summarizeIntegrations(snapshot: IntegrationCatalogSnapshot): ZavorthCapabilityCatalogSnapshot['integrations'] {
    const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
    const readyEntries = entries.filter((entry) => entry.readiness === 'ready');
    const templateEntries = entries.filter((entry) => entry.manifest?.category === 'template');
    const configurableEntries = entries.filter(
      (entry) => entry.readiness !== 'ready' && entry.manifest?.category !== 'template',
    );
    const installedEntries = entries.filter((entry) => Boolean(entry.installed));
    const featuredIds = Array.isArray(snapshot.featuredIds) ? snapshot.featuredIds : [];
    const featuredEntries = featuredIds.length
      ? entries.filter((entry) => featuredIds.includes(entry.manifest.id))
      : entries.slice(0, 6);

    return {
      total: entries.length,
      ready: readyEntries.length,
      needsConfiguration: configurableEntries.length,
      templates: templateEntries.length,
      installed: installedEntries.length,
      featured: featuredEntries.slice(0, 6).map((entry) => ({
        id: entry.manifest.id,
        label: entry.manifest.label,
        summary: entry.manifest.summary,
        readiness: entry.readiness,
        category: entry.manifest.category,
      })),
    };
  }

  private summarizeProviders(): ZavorthCapabilityCatalogSnapshot['providers'] {
    const report = this.providerDoctorService.inspect({
      taskKind: 'code',
      taskSubtype: 'general',
    });
    const featured = [
      ...report.readyProviders,
      ...report.pendingConfigProviders,
      ...report.probeProviders,
    ].slice(0, 6);

    return {
      total: report.providers.length,
      ready: report.readyProviders.length,
      needsConfiguration: report.pendingConfigProviders.length,
      needsProbe: report.probeProviders.length,
      activeProviderName: report.activeProviderName,
      activeModelName: report.activeModelName,
      recommendedProfile: report.recommendedProfile.profile.label,
      featured: featured.map((entry) => ({
        id: entry.id,
        label: entry.label,
        readiness: entry.readiness,
        currentModel: entry.currentModel,
        mode: entry.mode,
      })),
      recommendations: report.recommendations.slice(0, 3),
    };
  }

  private summarizeMcp(snapshot: IntegrationCatalogSnapshot): ZavorthCapabilityCatalogSnapshot['mcp'] {
    const mcp = snapshot.mcp;
    return {
      total: Number(mcp?.summary?.total || 0),
      enabled: Number(mcp?.summary?.enabled || 0),
      connected: Number(mcp?.summary?.connected || 0),
      failed: Number(mcp?.summary?.failed || 0),
      tools: Number(mcp?.summary?.toolCount || 0),
      capabilities: [...(mcp?.capabilities || [])],
      featured: (mcp?.entries || []).slice(0, 4).map((entry) => ({
        id: entry.id,
        capability: entry.capability || null,
        status: entry.status,
        toolCount: Number(entry.toolCount || 0),
      })),
      recommendations: [...(mcp?.recommendations || [])].slice(0, 3),
    };
  }

  private summarizeAgentOs(): ZavorthCapabilityCatalogSnapshot['agentOs'] {
    const snapshot = this.agentOperatingSystemService.buildSnapshot();
    return {
      roles: snapshot.summary.roles,
      loops: snapshot.summary.loops,
      activeLoops: snapshot.summary.activeLoops,
      resumableLoops: snapshot.summary.resumableLoops,
      sddLoopReady: snapshot.summary.sddLoopReady,
      featuredLoops: snapshot.loops.slice(0, 4).map((loop) => ({
        id: loop.id,
        label: loop.label,
        status: loop.status,
        entryCommand: loop.entryCommand,
      })),
    };
  }

  private buildNarrative(
    summary: CapabilitySummary,
    platformSummary: { ready: number; partial: number; planned: number; disabled: number },
    integrationSummary: ZavorthCapabilityCatalogSnapshot['integrations'],
    providerSummary: ZavorthCapabilityCatalogSnapshot['providers'],
    mcpSummary: ZavorthCapabilityCatalogSnapshot['mcp'],
    agentOsSummary: ZavorthCapabilityCatalogSnapshot['agentOs'],
  ): ZavorthCapabilityCatalogSnapshot['narrative'] {
    const headline = summary.plugin > 0
      ? `Zavorth expoe ${summary.total} capacidades entre core e plugins.`
      : `Zavorth expoe ${summary.total} capacidades carregadas no core.`;
    const operatorSummary = [
      `${summary.commands} comandos diretos e ${summary.implicitRoutes} rotas automaticas.`,
      `${platformSummary.ready} plataforma(s) pronta(s) e ${platformSummary.partial} em preparo.`,
      `${integrationSummary.ready} integracao(oes) pronta(s) no hub, ${integrationSummary.needsConfiguration} aguardando configuracao.`,
      `${providerSummary.ready} provider(s) pronto(s); ativo ${providerSummary.activeProviderName}/${providerSummary.activeModelName}.`,
      `${mcpSummary.connected}/${mcpSummary.enabled} capability(ies) MCP conectada(s) com ${mcpSummary.tools} tool(s) registradas.`,
      `${agentOsSummary.activeLoops} loop(s) ativos e ${agentOsSummary.resumableLoops} resumiveis no agent OS limitado.`,
    ].join(' ');

    return {
      headline,
      operatorSummary,
    };
  }

  private sortCapabilities(capabilities: CapabilityDefinition[]): CapabilityDefinition[] {
    return capabilities
      .slice()
      .sort((left, right) => {
        const rightPriority = Number(right.priority || right.routing_confidence || 0);
        const leftPriority = Number(left.priority || left.routing_confidence || 0);
        return rightPriority - leftPriority
          || Number(Boolean(right.command)) - Number(Boolean(left.command))
          || left.label.localeCompare(right.label);
      });
  }
}

