import { IntegrationHubService } from './IntegrationHubService.js';
import { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import { ZavorthPlatformRegistryService } from './ZavorthPlatformRegistryService.js';
import { SkillLibraryPresentationService } from './SkillLibraryPresentationService.js';
import { SkillInstallPlanPresentationService } from './SkillInstallPlanPresentationService.js';
import { McpCapabilityControlPlaneService } from './McpCapabilityControlPlaneService.js';
import type { McpRuntimeService } from '../mcp/McpRuntimeService.js';

type HubRuntime = {
  now?: () => Date;
  integrationHubService?: Pick<IntegrationHubService, 'buildCatalogSnapshot'>;
  pluginRegistryService?: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  platformRegistryService?: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  skillLibraryPresentationService?: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;
  skillInstallPlanPresentationService?: Pick<SkillInstallPlanPresentationService, 'buildSnapshot'>;
  mcpCapabilityControlPlaneService?: Pick<McpCapabilityControlPlaneService, 'buildSnapshot'>;
  mcpRuntimeService?: Pick<McpRuntimeService, 'readSnapshot'> | null;
};

export type ZavorthHubControlPlaneQuery = {
  selectedId?: string | null;
  query?: string | null;
  recommendFor?: string | null;
};

export type ZavorthHubControlPlaneSurface = {
  id: 'integrations' | 'plugins' | 'platform' | 'skills' | 'mcp';
  label: string;
  posture: 'healthy' | 'attention' | 'critical';
  primary: string;
  secondary: string;
  nextAction: string;
  command: string | null;
};

export type ZavorthHubControlPlaneAction = {
  id: string;
  label: string;
  surface: ZavorthHubControlPlaneSurface['id'];
  kind: 'sync' | 'doctor' | 'inspect' | 'install' | 'trust' | 'open';
  rationale: string;
  command: string | null;
};

export type ZavorthHubControlPlaneFeaturedItem = {
  id: string;
  label: string;
  surface: ZavorthHubControlPlaneSurface['id'];
  summary: string;
  command: string | null;
};

export type ZavorthHubControlPlaneSnapshot = {
  generatedAt: string;
  query: string | null;
  selectedId: string | null;
  recommendFor: string | null;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    integrations: number;
    featuredIntegrations: number;
    providersReady: number;
    providersNeedConfiguration: number;
    plugins: number;
    pluginsTrusted: number;
    platformEntries: number;
    collections: number;
    platformRecipes: number;
    skillsVisible: number;
    skillRecipesReady: number;
    mcpServers: number;
    mcpEnabled: number;
    mcpConnected: number;
    mcpFailed: number;
    mcpTools: number;
    mcpResources: number;
    recommendedActions: number;
  };
  sync: {
    status: string;
    summary: string;
    command: string | null;
    sourceTrusted: boolean;
    stale: boolean;
    entryCount: number;
    collectionCount: number;
    recipeCount: number;
  };
  surfaces: ZavorthHubControlPlaneSurface[];
  actions: ZavorthHubControlPlaneAction[];
  featured: ZavorthHubControlPlaneFeaturedItem[];
  highlights: string[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
};

type SnapshotProviders = {
  needsConfiguration?: Array<Record<string, unknown>>;
  needsProbe?: Array<Record<string, unknown>>;
  ready?: Array<Record<string, unknown>>;
  recommendations?: string[];
};

type SnapshotIntegrationEntry = {
  manifest?: { id?: string; label?: string; summary?: string };
  readiness?: string;
};

type SnapshotIntegrationHub = {
  providers?: SnapshotProviders;
  entries?: SnapshotIntegrationEntry[];
  selected?: SnapshotIntegrationEntry;
  featuredIds?: string[];
  narrative?: { operatorSummary?: string };
};

type SnapshotPluginEntry = {
  trust?: string;
  installState?: string;
  id?: string;
  label?: string;
  summary?: string;
  featured?: boolean;
  actionHint?: string;
};

type SnapshotPlugins = {
  summary?: { total?: number; trusted?: number; configurable?: number; installed?: number };
  selected?: SnapshotPluginEntry;
  entries?: SnapshotPluginEntry[];
  narrative?: { operatorSummary?: string };
};

type SnapshotSkillEntry = {
  id?: string;
  name?: string;
  description?: string;
  sourceLabel?: string;
};

type SnapshotSkillAction = {
  id?: string;
  label?: string;
  rationale?: string;
};

type SnapshotSkillLibrary = {
  catalog?: {
    summary?: { visible?: number; readyRecipes?: number; recipes?: number; blocked?: number; review?: number };
    selected?: SnapshotSkillEntry;
    entries?: SnapshotSkillEntry[];
  };
  narrative?: { operatorSummary?: string; nextAction?: string };
  actions?: SnapshotSkillAction[];
  mcp?: { summary?: { resources?: number } };
};

type SnapshotMcpEntry = {
  id?: string;
  status?: string;
  summary?: string;
  issue?: string;
};

type SnapshotMcp = {
  summary?: { total?: number; enabled?: number; connected?: number; failed?: number; toolCount?: number };
  entries?: SnapshotMcpEntry[];
  narrative?: { operatorSummary?: string };
  recommendations?: string[];
};

type SnapshotPlatform = {
  summary?: { total?: number; collections?: number; recipes?: number; reviewPending?: number };
  narrative?: { operatorSummary?: string };
};

type ZavorthHubSnapshotInput = {
  integrationHub?: SnapshotIntegrationHub;
  plugins?: SnapshotPlugins;
  platform?: SnapshotPlatform;
  skillLibrary?: SnapshotSkillLibrary;
  skillInstallPlan?: { narrative?: { headline?: string } };
  mcp?: SnapshotMcp;
  sync?: ZavorthHubControlPlaneSnapshot['sync'];
  runtime?: Record<string, unknown>;
};

export class ZavorthHubControlPlaneService {
  private readonly now: () => Date;
  private readonly integrationHubService: Pick<IntegrationHubService, 'buildCatalogSnapshot'>;
  private readonly pluginRegistryService: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  private readonly platformRegistryService: Pick<ZavorthPlatformRegistryService, 'buildSnapshot'>;
  private readonly skillLibraryPresentationService: Pick<SkillLibraryPresentationService, 'buildSnapshot'>;
  private readonly skillInstallPlanPresentationService: Pick<SkillInstallPlanPresentationService, 'buildSnapshot'>;
  private readonly mcpCapabilityControlPlaneService: Pick<McpCapabilityControlPlaneService, 'buildSnapshot'>;
  private readonly mcpRuntimeService: Pick<McpRuntimeService, 'readSnapshot'> | null;

  constructor(runtime: HubRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.integrationHubService = runtime.integrationHubService || new IntegrationHubService();
    this.pluginRegistryService = runtime.pluginRegistryService || new ZavorthPluginRegistryService();
    this.platformRegistryService = runtime.platformRegistryService || new ZavorthPlatformRegistryService();
    this.skillLibraryPresentationService =
      runtime.skillLibraryPresentationService || new SkillLibraryPresentationService();
    this.skillInstallPlanPresentationService =
      runtime.skillInstallPlanPresentationService || new SkillInstallPlanPresentationService();
    this.mcpCapabilityControlPlaneService =
      runtime.mcpCapabilityControlPlaneService || new McpCapabilityControlPlaneService();
    this.mcpRuntimeService = runtime.mcpRuntimeService || null;
  }

  public buildSnapshot(input: ZavorthHubControlPlaneQuery = {}): ZavorthHubControlPlaneSnapshot {
    const selectedId = this.normalizeValue(input.selectedId);
    const query = this.normalizeValue(input.query);
    const recommendFor = this.normalizeValue(input.recommendFor || query || selectedId);
    const integrationHub = this.integrationHubService.buildCatalogSnapshot(selectedId ?? undefined);
    const plugins = this.pluginRegistryService.buildSnapshot({ selectedId: selectedId ?? undefined, query: query ?? undefined });
    const platform = this.platformRegistryService.buildSnapshot({ selectedId: selectedId ?? undefined, query: query ?? undefined });
    const skillLibrary = this.skillLibraryPresentationService.buildSnapshot({
      selectedId: selectedId ?? undefined,
      query: query ?? undefined,
      recommendFor: recommendFor ?? undefined,
    });
    const skillInstallPlan = this.skillInstallPlanPresentationService.buildSnapshot({
      selectedId: selectedId ?? undefined,
      query: query ?? undefined,
      recommendFor: recommendFor ?? undefined,
    });
    const mcp = this.mcpCapabilityControlPlaneService.buildSnapshot();
    const sync = this.buildSyncSnapshot(platform?.catalogSync ?? undefined);
    const surfaces = this.buildSurfaceCards({
      integrationHub: integrationHub as unknown as SnapshotIntegrationHub,
      plugins: plugins as unknown as SnapshotPlugins,
      platform,
      skillLibrary: skillLibrary as unknown as SnapshotSkillLibrary,
      skillInstallPlan,
      mcp: mcp as unknown as SnapshotMcp,
      runtime: this.mcpRuntimeService?.readSnapshot?.() ?? undefined,
      sync,
    });
    const actions = this.buildActions({
      integrationHub: integrationHub as unknown as SnapshotIntegrationHub,
      plugins: plugins as unknown as SnapshotPlugins,
      skillLibrary: skillLibrary as unknown as SnapshotSkillLibrary,
      skillInstallPlan,
      mcp: mcp as unknown as SnapshotMcp,
      sync,
    });
    const featured = this.buildFeaturedItems({
      integrationHub: integrationHub as unknown as SnapshotIntegrationHub,
      plugins: plugins as unknown as SnapshotPlugins,
      skillLibrary: skillLibrary as unknown as SnapshotSkillLibrary,
      mcp: mcp as unknown as SnapshotMcp,
    });
    return {
      generatedAt: this.now().toISOString(),
      query: query || null,
      selectedId: selectedId || null,
      recommendFor: recommendFor || null,
      summary: {
        posture: this.resolvePosture(surfaces),
        integrations: Array.isArray(integrationHub?.entries) ? integrationHub.entries.length : 0,
        featuredIntegrations: Array.isArray(integrationHub?.featuredIds) ? integrationHub.featuredIds.length : 0,
        providersReady: Array.isArray(integrationHub?.providers?.ready) ? integrationHub.providers.ready.length : 0,
        providersNeedConfiguration:
          (Array.isArray(integrationHub?.providers?.needsConfiguration) ? integrationHub.providers.needsConfiguration.length : 0)
          + (Array.isArray(integrationHub?.providers?.needsProbe) ? integrationHub.providers.needsProbe.length : 0),
        plugins: Number(plugins?.summary?.total || 0) || 0,
        pluginsTrusted: Number(plugins?.summary?.trusted || 0) || 0,
        platformEntries: Number(platform?.summary?.total || 0) || 0,
        collections: Number(platform?.summary?.collections || 0) || 0,
        platformRecipes: Number(platform?.summary?.recipes || 0) || 0,
        skillsVisible: Number(skillLibrary?.catalog?.summary?.visible || 0) || 0,
        skillRecipesReady: Number(skillLibrary?.catalog?.summary?.readyRecipes || 0) || 0,
        mcpServers: Number(mcp?.summary?.total || 0) || 0,
        mcpEnabled: Number(mcp?.summary?.enabled || 0) || 0,
        mcpConnected: Number(mcp?.summary?.connected || 0) || 0,
        mcpFailed: Number(mcp?.summary?.failed || 0) || 0,
        mcpTools: Number(mcp?.summary?.toolCount || 0) || 0,
        mcpResources: Number(skillLibrary?.mcp?.summary?.resources || 0) || 0,
        recommendedActions: actions.length,
      },
      sync,
      surfaces,
      actions,
      featured,
      highlights: this.buildHighlights({
        integrationHub: integrationHub as unknown as SnapshotIntegrationHub,
        platform,
        skillLibrary: skillLibrary as unknown as SnapshotSkillLibrary,
        mcp: mcp as unknown as SnapshotMcp,
        sync,
      }),
      narrative: {
        headline: 'Zavorth Hub + MCP product plane',
        operatorSummary:
          `${surfaces.length} surface(s) consolidadas, ${actions.length} action(oes) sugerida(s) e `
          + `${featured.length} item(s) featured entre integrations, skills, plugins e MCP.`,
        nextAction: actions[0]?.label || 'Abrir o hub consolidado para review o next passo.',
      },
    };
  }

  public renderReport(input: ZavorthHubControlPlaneQuery = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth Hub + MCP product plane',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      `next passo sugerido: ${snapshot.narrative.nextAction}`,
      '',
      `Postura: ${snapshot.summary.posture}.`,
      `Integrations: ${snapshot.summary.integrations} | providers ready: ${snapshot.summary.providersReady} | needs configuration: ${snapshot.summary.providersNeedConfiguration}.`,
      `Plugins: ${snapshot.summary.plugins} | trusted: ${snapshot.summary.pluginsTrusted}.`,
      `Platform: ${snapshot.summary.platformEntries} entradas | colecoes: ${snapshot.summary.collections} | recipes: ${snapshot.summary.platformRecipes}.`,
      `Skills: ${snapshot.summary.skillsVisible} visible | recipes ready: ${snapshot.summary.skillRecipesReady}.`,
      `MCP: ${snapshot.summary.mcpConnected}/${snapshot.summary.mcpEnabled} habilitado(s) | total manifest: ${snapshot.summary.mcpServers} | failurendo: ${snapshot.summary.mcpFailed} | tools: ${snapshot.summary.mcpTools} | resources: ${snapshot.summary.mcpResources}.`,
      `Registry remote: ${snapshot.sync.status} | ${snapshot.sync.summary}`,
      '',
      'surfaces:',
      ...snapshot.surfaces.map((surface) =>
        `- ${surface.label}: ${surface.primary} | ${surface.secondary} | next: ${surface.nextAction}${surface.command ? ` | ${surface.command}` : ''}`),
    ];
    if (snapshot.highlights.length > 0) {
      lines.push('', 'Highlights:', ...snapshot.highlights.map((entry) => `- ${entry}`));
    }
    if (snapshot.actions.length > 0) {
      lines.push('', 'Actions sugeridas:', ...snapshot.actions.map((entry) =>
        `- ${entry.label}: ${entry.rationale}${entry.command ? ` | ${entry.command}` : ''}`));
    }
    if (snapshot.featured.length > 0) {
      lines.push('', 'Itens featured:', ...snapshot.featured.map((entry) =>
        `- ${entry.label} [${entry.surface}]: ${entry.summary}${entry.command ? ` | ${entry.command}` : ''}`));
    }
    return lines.join('\n');
  }

  private buildSurfaceCards(input: ZavorthHubSnapshotInput): ZavorthHubControlPlaneSurface[] {
    const providerPending =
      (Array.isArray(input.integrationHub?.providers?.needsConfiguration) ? input.integrationHub.providers.needsConfiguration.length : 0)
      + (Array.isArray(input.integrationHub?.providers?.needsProbe) ? input.integrationHub.providers.needsProbe.length : 0);
    const providersReady = Array.isArray(input.integrationHub?.providers?.ready) ? input.integrationHub.providers.ready.length : 0;
    const integrationsAttention = providerPending > 0 && providersReady === 0;
    const pluginTrusted = Number(input.plugins?.summary?.trusted || 0) || 0;
    const pluginConfigurable = Number(input.plugins?.summary?.configurable || 0) || 0;
    const selectedPluginNeedsReview =
      String(input.plugins?.selected?.trust || '').trim().toLowerCase() === 'review'
      && String(input.plugins?.selected?.installState || '').trim().toLowerCase() !== 'draft';
    const pluginsAttention = pluginTrusted === 0 && (selectedPluginNeedsReview || pluginConfigurable > 0);
    const mcpEnabled = Number(input.mcp?.summary?.enabled || 0) || 0;
    const mcpConnected = Number(input.mcp?.summary?.connected || 0) || 0;
    const mcpFailed = Number(input.mcp?.summary?.failed || 0) || 0;
    const mcpAttention = mcpFailed === 0 && mcpEnabled > 0 && mcpConnected === 0;
    const platformStatus = String(input.sync?.status || 'disabled').trim().toLowerCase();
    const platformReviewPending = Number(input.platform?.summary?.reviewPending || 0) || 0;
    const platformAttention =
      platformStatus === 'stale'
      || platformStatus === 'never-synced'
      || (platformStatus !== 'disabled' && input.sync?.sourceTrusted !== false && platformReviewPending > 0);
    const skillBlocked = Number(input.skillLibrary?.catalog?.summary?.blocked || 0) || 0;
    const skillReview = Number(input.skillLibrary?.catalog?.summary?.review || 0) || 0;
    const skillRecipesReady = Number(input.skillLibrary?.catalog?.summary?.readyRecipes || 0) || 0;
    const skillRecipes = Number(input.skillLibrary?.catalog?.summary?.recipes || 0) || 0;
    const skillAttention = skillReview > 0 && skillRecipesReady < skillRecipes;
    return [
      {
        id: 'integrations',
        label: 'Integration Hub',
        posture: integrationsAttention ? 'attention' : 'healthy',
        primary: `${Array.isArray(input.integrationHub?.entries) ? input.integrationHub.entries.length : 0} conector(es) | ${Array.isArray(input.integrationHub?.providers?.ready) ? input.integrationHub.providers.ready.length : 0} provider(s) ready`,
        secondary: this.firstNonEmptyText(input.integrationHub?.providers?.recommendations?.[0], input.integrationHub?.selected?.manifest?.summary) || 'Receitas guiadas e providers do hub.',
        nextAction: providerPending > 0 ? 'Complete configuration for the highlighted connector or leave the optional recipe for later.' : 'Open a ready connector or review templates.',
        command: this.buildIntegrationCommand(input.integrationHub as unknown as Record<string, unknown> | undefined) || '/integrations',
      },
      {
        id: 'plugins',
        label: 'Plugin plane',
        posture: pluginsAttention ? 'attention' : 'healthy',
        primary: `${Number(input.plugins?.summary?.total || 0) || 0} item(s) | ${Number(input.plugins?.summary?.installed || 0) || 0} registered`,
        secondary: this.firstNonEmptyText(input.plugins?.narrative?.operatorSummary, input.plugins?.selected?.summary) || 'Plugins e extensions workspace consolidadas.',
        nextAction: pluginConfigurable > 0 ? 'Promote a configurable plugin when it leaves optional backlog.' : 'review trusted/review in the plugin plane.',
        command: input.plugins?.selected?.id ? `/plugins ${input.plugins.selected.id}` : '/plugins',
      },
      {
        id: 'platform',
        label: 'Platform plane',
        posture: platformStatus === 'failed' ? 'critical' : (platformAttention ? 'attention' : 'healthy'),
        primary: `${Number(input.platform?.summary?.total || 0) || 0} entry(s) | ${Number(input.platform?.summary?.collections || 0) || 0} collection(oes) | ${Number(input.platform?.summary?.recipes || 0) || 0} recipe(s)`,
        secondary: this.firstNonEmptyText(input.sync?.summary, input.platform?.narrative?.operatorSummary) || 'Registry, colecoes e recipes do ecossistema.',
        nextAction: platformStatus === 'ready' ? 'review colecoes e recipes promovidas.' : 'Sincronizar o registry remote e review pending items.',
        command: '/platform',
      },
      {
        id: 'skills',
        label: 'Skill plane',
        posture: skillBlocked > 0 ? 'critical' : (skillAttention ? 'attention' : 'healthy'),
        primary: `${Number(input.skillLibrary?.catalog?.summary?.visible || 0) || 0} skill(s) | ${Number(input.skillLibrary?.catalog?.summary?.readyRecipes || 0) || 0}/${Number(input.skillLibrary?.catalog?.summary?.recipes || 0) || 0} recipe(s) ready`,
        secondary: this.firstNonEmptyText(input.skillLibrary?.narrative?.nextAction, input.skillLibrary?.narrative?.operatorSummary) || 'Skills, recipes e bundles consolidados.',
        nextAction: this.firstNonEmptyText(input.skillLibrary?.narrative?.nextAction, input.skillInstallPlan?.narrative?.headline) || 'Open the library or skill plan.',
        command: input.skillLibrary?.catalog?.selected?.id ? `/skills ${input.skillLibrary.catalog.selected.id}` : '/skills library',
      },
      {
        id: 'mcp',
        label: 'MCP product plane',
        posture: mcpFailed > 0 ? 'critical' : (mcpAttention ? 'attention' : 'healthy'),
        primary: `${mcpConnected}/${mcpEnabled} server(es) connected(s) | ${Number(input.mcp?.summary?.toolCount || 0) || 0} tool(s)`,
        secondary: this.firstNonEmptyText(input.mcp?.narrative?.operatorSummary, input.mcp?.recommendations?.[0]) || 'manifest, runtime e sidecars MCP consolidados.',
        nextAction: mcpFailed > 0 || mcpAttention ? 'run the MCP doctor and review manifest, binary, and credentials.' : 'review live capabilities and sidecars without treating policy-disabled entries as incidents.',
        command: 'npm run mcp:browser:doctor',
      },
    ];
  }

  private buildActions(input: ZavorthHubSnapshotInput): ZavorthHubControlPlaneAction[] {
    const actions: ZavorthHubControlPlaneAction[] = [];
    const seen = new Set<string>();
    const push = (action: ZavorthHubControlPlaneAction | null) => {
      if (!action) {
        return;
      }
      const key = `${action.surface}:${action.id}:${action.command || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        actions.push(action);
      }
    };
    if (['failed', 'stale', 'never-synced'].includes(String(input.sync?.status || '').trim().toLowerCase())) {
      push({
        id: 'platform-sync',
        label: 'Sincronizar registry remote',
        surface: 'platform',
        kind: 'sync',
        rationale: input.sync?.summary ?? 'Sincronizar registry remote e validar sources antes de promover receitas.',
        command: '/hub run platform-sync',
      });
    }
    if (Number(input.mcp?.summary?.failed || 0) > 0 || (Number(input.mcp?.summary?.enabled || 0) > 0 && Number(input.mcp?.summary?.connected || 0) < Number(input.mcp?.summary?.enabled || 0))) {
      push({
        id: 'mcp-browser-doctor',
        label: 'run doctor MCP',
        surface: 'mcp',
        kind: 'doctor',
        rationale: this.firstNonEmptyText(input.mcp?.recommendations?.[0], 'An MCP capability is failing or pending in runtime.') || 'Review MCP runtime health.',
        command: '/hub run mcp-browser-doctor',
      });
    }
    const providerPending = Number(input.integrationHub?.providers?.needsConfiguration?.length || 0)
      + Number(input.integrationHub?.providers?.needsProbe?.length || 0);
    const providersReady = Number(input.integrationHub?.providers?.ready?.length || 0);
    const pendingProvider = input.integrationHub?.providers?.needsConfiguration?.[0] || input.integrationHub?.providers?.needsProbe?.[0] || null;
    if (pendingProvider?.id && providersReady === 0 && providerPending > 0) {
      push({
        id: `integration:${pendingProvider.id}`,
        label: `Fechar ${pendingProvider.id}`,
        surface: 'integrations',
        kind: 'open',
        rationale: this.firstNonEmptyText(input.integrationHub?.providers?.recommendations?.[0], 'Existe provider needs configuration before ficar realmente ready.') || 'Complete configuration for the highlighted provider.',
        command: `/hub run integration:${pendingProvider.id}`,
      });
    }
    const pluginTrusted = Number(input.plugins?.summary?.trusted || 0) || 0;
    const reviewPlugin = Array.isArray(input.plugins?.entries)
      ? input.plugins.entries.find((entry) => String(entry?.trust || '').trim().toLowerCase() === 'review' && String(entry?.installState || '').trim().toLowerCase() !== 'draft')
      : null;
    if (reviewPlugin?.id && pluginTrusted === 0) {
      push({
        id: `plugin:${reviewPlugin.id}`,
        label: `review plugin ${reviewPlugin.label || reviewPlugin.id}`,
        surface: 'plugins',
        kind: 'trust',
        rationale: this.firstNonEmptyText(reviewPlugin.summary, 'Plugin ready for trust review exists.') || 'Review plugin trust/source before promoting.',
        command: `/hub run plugin:${reviewPlugin.id}`,
      });
    }
    const skillAction = Array.isArray(input.skillLibrary?.actions) ? input.skillLibrary.actions[0] : null;
    if (skillAction?.label) {
      push({
        id: `skills:${skillAction.id || 'next'}`,
        label: skillAction.label,
        surface: 'skills',
        kind: 'inspect',
        rationale: this.firstNonEmptyText(skillAction.rationale, input.skillLibrary?.narrative?.nextAction) || 'Existe next passo claro no skill plane.',
        command: `/hub run skills:${skillAction.id || 'next'}`,
      });
    }
    return actions.slice(0, 8);
  }

  private buildFeaturedItems(input: ZavorthHubSnapshotInput): ZavorthHubControlPlaneFeaturedItem[] {
    const items: ZavorthHubControlPlaneFeaturedItem[] = [];
    const seen = new Set<string>();
    const push = (entry: ZavorthHubControlPlaneFeaturedItem | null) => {
      if (!entry) {
        return;
      }
      const key = `${entry.surface}:${entry.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(entry);
      }
    };
    const integrationEntries = Array.isArray(input.integrationHub?.entries) ? input.integrationHub.entries : [];
    const featuredIds = Array.isArray(input.integrationHub?.featuredIds) ? input.integrationHub.featuredIds : [];
    const integration = input.integrationHub?.selected || integrationEntries.find((entry) => entry?.manifest?.id && featuredIds.includes(entry.manifest.id)) || integrationEntries[0] || null;
    if (integration?.manifest?.id) {
      push({
        id: integration.manifest.id,
        label: integration.manifest.label || integration.manifest.id,
        surface: 'integrations',
        summary: this.firstNonEmptyText(integration.manifest.summary, integration.readiness) || 'Conector destacado do hub.',
        command: integration.readiness === 'ready' ? `/integrations ${integration.manifest.id}` : `/connect ${integration.manifest.id}`,
      });
    }
    const plugin = input.plugins?.selected || (Array.isArray(input.plugins?.entries) ? input.plugins.entries.find((entry: any) => entry?.featured === true) || input.plugins.entries[0] : null);
    if (plugin?.id) {
      push({
        id: plugin.id,
        label: plugin.label || plugin.id,
        surface: 'plugins',
        summary: this.firstNonEmptyText(plugin.summary, plugin.actionHint) || 'Plugin destacado do plane.',
        command: `/plugins ${plugin.id}`,
      });
    }
    const skill = input.skillLibrary?.catalog?.selected || (Array.isArray(input.skillLibrary?.catalog?.entries) ? input.skillLibrary.catalog.entries[0] : null);
    if (skill?.id) {
      push({
        id: skill.id,
        label: skill.name || skill.id,
        surface: 'skills',
        summary: this.firstNonEmptyText(skill.description, skill.sourceLabel) || 'Skill destacada do plane.',
        command: `/skills ${skill.id}`,
      });
    }
    const mcpEntry = Array.isArray(input.mcp?.entries) ? input.mcp.entries.find((entry: any) => String(entry?.status || '').trim().toLowerCase() === 'connected') || input.mcp.entries[0] : null;
    if (mcpEntry?.id) {
      push({
        id: mcpEntry.id,
        label: mcpEntry.id,
        surface: 'mcp',
        summary: this.firstNonEmptyText(mcpEntry.summary, mcpEntry.issue) || 'server MCP destacado do plane.',
        command: 'npm run mcp:browser:doctor',
      });
    }
    return items.slice(0, 8);
  }

  private buildHighlights(input: ZavorthHubSnapshotInput): string[] {
    return Array.from(new Set([
      this.firstNonEmptyText(input.integrationHub?.narrative?.operatorSummary, input.integrationHub?.providers?.recommendations?.[0]),
      this.firstNonEmptyText(input.platform?.narrative?.operatorSummary, input.sync?.summary),
      this.firstNonEmptyText(input.skillLibrary?.narrative?.operatorSummary, input.skillLibrary?.narrative?.nextAction),
      this.firstNonEmptyText(input.mcp?.narrative?.operatorSummary, input.mcp?.recommendations?.[0]),
    ].filter(Boolean) as string[])).slice(0, 6);
  }

  private buildSyncSnapshot(sync: Record<string, unknown> | null): ZavorthHubControlPlaneSnapshot['sync'] {
    return {
      status: this.firstNonEmptyText(sync?.status, 'disabled') || 'disabled',
      summary: this.firstNonEmptyText(sync?.summary, 'Remote registry is not consolidated yet.') || 'Remote registry is not consolidated yet.',
      command: this.firstNonEmptyText(sync?.command, '/platform sync') || '/platform sync',
      sourceTrusted: sync?.sourceTrusted !== false,
      stale: Boolean(sync?.stale),
      entryCount: Number(sync?.entryCount || 0) || 0,
      collectionCount: Number(sync?.collectionCount || 0) || 0,
      recipeCount: Number(sync?.recipeCount || 0) || 0,
    };
  }

  private buildIntegrationCommand(integrationHub: Record<string, unknown> | undefined): string | null {
    const selected = integrationHub?.selected as { manifest?: { id?: string }; readiness?: string } | undefined;
    const selectedId = this.firstNonEmptyText(selected?.manifest?.id);
    if (selectedId) {
      return String(selected?.readiness || '').trim().toLowerCase() === 'ready'
        ? `/integrations ${selectedId}`
        : `/connect ${selectedId}`;
    }
    const providers = integrationHub?.providers as { needsConfiguration?: Array<{ id?: string }>; needsProbe?: Array<{ id?: string }> } | undefined;
    const pendingProvider = providers?.needsConfiguration?.[0] || providers?.needsProbe?.[0] || null;
    return pendingProvider?.id ? `/connect ${pendingProvider.id}` : null;
  }

  private resolvePosture(
    surfaces: ZavorthHubControlPlaneSurface[],
  ): ZavorthHubControlPlaneSnapshot['summary']['posture'] {
    if (surfaces.some((entry) => entry.posture === 'critical')) {
      return 'critical';
    }
    if (surfaces.some((entry) => entry.posture === 'attention')) {
      return 'attention';
    }
    return 'healthy';
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  private firstNonEmptyText(...values: unknown[]): string | null {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) {
        return text;
      }
    }
    return null;
  }
}
