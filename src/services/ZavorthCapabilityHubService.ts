import {
  CAPABILITY_HUB_CONTRACT_VERSION,
  type CapabilityHubActivation,
  type CapabilityHubGovernance,
  type CapabilityHubGroupSummary,
  type CapabilityHubItem,
  type CapabilityHubItemKind,
  type CapabilityHubQuery,
  type CapabilityHubReadiness,
  type CapabilityHubRequirement,
  type CapabilityHubRiskLevel,
  type CapabilityHubSnapshot,
  type CapabilityHubSourceKind,
} from '../contracts/CapabilityHubContract.js';
import type { CapabilityDefinition } from '../contracts/CapabilityContract.js';
import type {
  IntegrationCatalogEntry,
  IntegrationCatalogSnapshot,
  IntegrationHubMcpServerEntry,
  IntegrationHubProviderEntry,
} from '../contracts/IntegrationHubContract.js';
import type { GatewayChannelRegistryEntry } from './GatewayChannelRegistryService.js';
import { getDefaultCapabilityRegistry, type CapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import { GatewayChannelRegistryService } from './GatewayChannelRegistryService.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { SkillCatalogService } from '../skills/SkillCatalogService.js';
import type { SkillCatalogEntry } from '../skills/SkillCatalogContract.js';
import { SkillRecipeService, type SkillRecipeSnapshot } from './SkillRecipeService.js';
import { ZavorthCapabilityImportService } from './ZavorthCapabilityImportService.js';

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'getAll'>;
type ChannelRegistryLike = Pick<GatewayChannelRegistryService, 'buildSnapshot'>;
type IntegrationHubLike = Pick<IntegrationHubService, 'buildCatalogSnapshot'>;
type SkillCatalogLike = Pick<SkillCatalogService, 'buildSnapshot'>;
type SkillRecipeLike = Pick<SkillRecipeService, 'buildRecipes'>;
type CapabilityImportLike = Pick<ZavorthCapabilityImportService, 'listCapabilityHubItems'>;

export type ZavorthCapabilityHubRuntime = {
  now?: () => Date;
  capabilityRegistry?: CapabilityRegistryLike;
  channelRegistryService?: ChannelRegistryLike;
  integrationHubService?: IntegrationHubLike;
  skillCatalogService?: SkillCatalogLike;
  skillRecipeService?: SkillRecipeLike;
  capabilityImportService?: CapabilityImportLike;
};

const KIND_ORDER: CapabilityHubItemKind[] = [
  'channel',
  'integration',
  'provider',
  'mcp',
  'skill',
  'recipe',
  'runtime-capability',
];

export class ZavorthCapabilityHubService {
  private readonly now: () => Date;
  private readonly capabilityRegistry: CapabilityRegistryLike;
  private readonly channelRegistryService: ChannelRegistryLike;
  private readonly integrationHubService: IntegrationHubLike;
  private readonly skillCatalogService: SkillCatalogLike;
  private readonly skillRecipeService: SkillRecipeLike;
  private readonly capabilityImportService: CapabilityImportLike;

  constructor(runtime: ZavorthCapabilityHubRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.channelRegistryService = runtime.channelRegistryService || new GatewayChannelRegistryService();
    this.integrationHubService = runtime.integrationHubService || new IntegrationHubService();
    this.skillCatalogService = runtime.skillCatalogService || new SkillCatalogService();
    this.skillRecipeService = runtime.skillRecipeService || new SkillRecipeService();
    this.capabilityImportService = runtime.capabilityImportService || new ZavorthCapabilityImportService({ now: this.now });
  }

  public buildSnapshot(query: CapabilityHubQuery = {}): CapabilityHubSnapshot {
    const allItems = this.buildItems();
    const normalizedQuery = this.normalizeQuery(query);
    const visibleItems = this.filterItems(allItems, normalizedQuery);
    const selected = this.resolveSelectedItem(allItems, normalizedQuery.selectedId || normalizedQuery.query);
    const groups = this.buildGroups(allItems);
    const summary = this.buildSummary(allItems, visibleItems);

    return {
      contractVersion: CAPABILITY_HUB_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      query: normalizedQuery,
      rootPolicy: {
        canonicalRoot: 'zavorth-core/Zavorth',
        externalCapabilityRootsAllowed: false,
        importsMustNormalizeToZavorthContract: true,
        secretsSerialized: false,
      },
      summary,
      groups,
      featured: this.pickFeaturedItems(visibleItems),
      selected,
      items: query.includeItems === false ? [] : visibleItems,
      narrative: this.buildNarrative(summary, groups, selected),
    };
  }

  public listItems(query: CapabilityHubQuery = {}): CapabilityHubItem[] {
    return this.buildSnapshot(query).items;
  }

  public getItem(id: string | null | undefined): CapabilityHubItem | null {
    return this.resolveSelectedItem(this.buildItems(), id);
  }

  public renderReport(query: CapabilityHubQuery = {}): string {
    const snapshot = this.buildSnapshot(query);
    const lines = [
      'Zavorth Capability Hub',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Items: ${snapshot.summary.visible}/${snapshot.summary.total} visible | ready ${snapshot.summary.ready} | setup ${snapshot.summary.needsConfiguration} | planned ${snapshot.summary.planned}.`,
      `Governance: ${snapshot.summary.approvalGated} approval-gated | ${snapshot.summary.guidedSetup} guided setup | secrets serialized: no.`,
      '',
      'Groups:',
    ];

    for (const group of snapshot.groups) {
      lines.push(`- ${group.kind}: ${group.total} total, ${group.ready} ready, ${group.needsConfiguration} setup, ${group.planned} planned.`);
    }

    if (snapshot.selected) {
      lines.push('', 'Selected:', this.renderItemLine(snapshot.selected));
    }

    lines.push('', 'Featured:');
    for (const item of snapshot.featured) {
      lines.push(`- ${this.renderItemLine(item)}`);
    }

    lines.push('', `Next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private buildItems(): CapabilityHubItem[] {
    const capabilityItems = this.capabilityRegistry.getAll().map((entry) => this.fromRuntimeCapability(entry));
    const channelItems = this.safeChannelEntries().map((entry) => this.fromChannel(entry));
    const integrationSnapshot = this.safeIntegrationSnapshot();
    const integrationItems = integrationSnapshot.entries.map((entry) => this.fromIntegration(entry));
    const providerItems = this.providerEntries(integrationSnapshot).map((entry) => this.fromProvider(entry));
    const mcpItems = integrationSnapshot.mcp.entries.map((entry) => this.fromMcp(entry));
    const skillSnapshot = this.skillCatalogService.buildSnapshot();
    const skillItems = skillSnapshot.entries.map((entry) => this.fromSkill(entry));
    const recipeItems = this.skillRecipeService.buildRecipes(skillSnapshot.entries).map((entry) => this.fromRecipe(entry));
    const importedItems = this.safeImportedItems();

    return [
      ...channelItems,
      ...integrationItems,
      ...providerItems,
      ...mcpItems,
      ...skillItems,
      ...recipeItems,
      ...importedItems,
      ...capabilityItems,
    ].sort((left, right) => {
      const kindDelta = KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind);
      return kindDelta || left.label.localeCompare(right.label, 'en-US');
    });
  }

  private safeChannelEntries(): GatewayChannelRegistryEntry[] {
    try {
      return this.channelRegistryService.buildSnapshot().channels;
    } catch {
      return [];
    }
  }

  private safeIntegrationSnapshot(): IntegrationCatalogSnapshot {
    try {
      return this.integrationHubService.buildCatalogSnapshot();
    } catch {
      return {
        generatedAt: this.now().toISOString(),
        entries: [],
        featuredIds: [],
        templateIds: [],
        providers: {
          generatedAt: this.now().toISOString(),
          activeProviderName: 'unknown',
          activeModelName: 'unknown',
          preferredZavorthBridgeModel: null,
          recommendedProfile: {
            id: 'unknown',
            label: 'Unknown',
            providerName: 'unknown',
            modelName: null,
            fallbackOrder: [],
          },
          ready: [],
          needsConfiguration: [],
          needsProbe: [],
          profiles: [],
          usageTargets: [],
          recommendations: [],
        },
        mcp: {
          generatedAt: this.now().toISOString(),
          manifestPath: 'config/mcp-servers.json',
          summary: {
            total: 0,
            enabled: 0,
            connected: 0,
            failed: 0,
            disabled: 0,
            stopped: 0,
            toolCount: 0,
            capabilityCount: 0,
          },
          capabilities: [],
          entries: [],
          recommendations: [],
          narrative: {
            headline: 'MCP unavailable',
            operatorSummary: 'MCP snapshot could not be built.',
          },
        },
        selected: null,
      };
    }
  }

  private providerEntries(snapshot: IntegrationCatalogSnapshot): IntegrationHubProviderEntry[] {
    return [
      ...snapshot.providers.ready,
      ...snapshot.providers.needsConfiguration,
      ...snapshot.providers.needsProbe,
    ];
  }

  private safeImportedItems(): CapabilityHubItem[] {
    try {
      return this.capabilityImportService.listCapabilityHubItems();
    } catch {
      return [];
    }
  }

  private fromRuntimeCapability(entry: CapabilityDefinition): CapabilityHubItem {
    const commands = [
      entry.command?.command,
      ...(entry.command?.aliases || []),
    ].filter((value): value is string => Boolean(value));
    const risk = this.riskFromDangerLevel(entry.policy?.dangerLevel);
    const requirements = this.emptyRequirements();
    const governance = this.governance({
      risk,
      requiresApproval: Boolean(entry.policy?.requiresApproval),
      networkScope: entry.policy?.networkScope || 'unknown',
      sandboxRequired: risk === 'high' || risk === 'blocked',
    });

    return this.item({
      id: `runtime:${entry.id}`,
      kind: 'runtime-capability',
      label: entry.label,
      summary: entry.description,
      description: entry.routing_reason || entry.intent || entry.description,
      tags: ['runtime', entry.type, ...(entry.tags || [])],
      readiness: entry.enabled === false ? 'disabled' : 'ready',
      source: entry.source === 'plugin' ? 'imported' : 'zavorth-core',
      requirements,
      governance,
      activation: this.activation({
        configured: true,
        installed: true,
        defaultEnabled: entry.enabled !== false,
        liveAllowed: entry.enabled !== false,
        setupGuided: false,
        commands,
        readinessChecks: ['CapabilityRegistry'],
      }),
      provenance: this.provenance('CapabilityRegistry', entry.id, entry.source === 'plugin' ? 'imported' : 'zavorth-core', entry.source === 'plugin'),
    });
  }

  private fromChannel(entry: GatewayChannelRegistryEntry): CapabilityHubItem {
    const readiness = this.mapReadiness(entry.readiness);
    const governance = this.governance({
      risk: entry.features.sessionSend ? 'medium' : 'low',
      requiresApproval: entry.features.sessionSend,
      networkScope: entry.configured ? 'external-policy' : 'unknown',
      sandboxRequired: false,
    });

    return this.item({
      id: `channel:${entry.id}`,
      kind: 'channel',
      label: entry.label,
      summary: `${entry.transport} channel with ${entry.readiness} readiness.`,
      description: entry.notes.join(' ') || `Channel adapter for ${entry.label}.`,
      tags: ['channel', entry.transport, entry.readiness],
      readiness,
      source: 'zavorth-core',
      requirements: this.emptyRequirements(),
      governance,
      activation: this.activation({
        configured: entry.configured,
        installed: readiness === 'ready' || readiness === 'partial',
        defaultEnabled: entry.configured,
        liveAllowed: entry.configured && readiness === 'ready',
        setupGuided: !entry.configured,
        commands: [],
        readinessChecks: ['GatewayChannelRegistryService'],
      }),
      provenance: this.provenance('GatewayChannelRegistryService', entry.id, 'zavorth-core', false),
    });
  }

  private fromIntegration(entry: IntegrationCatalogEntry): CapabilityHubItem {
    const manifest = entry.manifest;
    const requirements: CapabilityHubRequirement = {
      secretRefs: manifest.requirements.filter((item) => item.secret).map((item) => item.id),
      envKeys: manifest.requirements.map((item) => item.envKey).filter((value): value is string => Boolean(value)),
      accounts: manifest.requirements.filter((item) => item.type === 'account').map((item) => item.id),
      binaries: manifest.requirements.filter((item) => item.type === 'binary').map((item) => item.id),
      manualSteps: manifest.installSteps.filter((item) => item.kind === 'manual').map((item) => item.id),
    };
    const readiness = this.mapReadiness(entry.readiness);
    const governance = this.governance({
      risk: manifest.category === 'template' ? 'unknown' : 'medium',
      requiresApproval: true,
      networkScope: manifest.category === 'local' ? 'local' : 'external-policy',
      sandboxRequired: manifest.modes.some((mode) => mode.id === 'docker'),
    });

    return this.item({
      id: `integration:${manifest.id}`,
      kind: 'integration',
      label: manifest.label,
      summary: manifest.summary,
      description: manifest.description,
      tags: ['integration', manifest.category, manifest.supportLevel, ...manifest.tags],
      readiness,
      source: manifest.category === 'template' ? 'template' : 'zavorth-core',
      requirements,
      governance,
      activation: this.activation({
        configured: Boolean(entry.installed?.configuredAt) || readiness === 'ready',
        installed: Boolean(entry.installed),
        defaultEnabled: false,
        liveAllowed: readiness === 'ready',
        setupGuided: manifest.installSteps.length > 0,
        commands: [`/integrations ${manifest.id}`, `/connect ${manifest.id}`],
        readinessChecks: ['IntegrationHubService', 'IntegrationHealthService'],
      }),
      provenance: this.provenance('IntegrationHubService', manifest.id, manifest.category === 'template' ? 'template' : 'zavorth-core', false),
    });
  }

  private fromProvider(entry: IntegrationHubProviderEntry): CapabilityHubItem {
    const readiness = this.mapReadiness(entry.readiness);
    return this.item({
      id: `provider:${entry.id}`,
      kind: 'provider',
      label: entry.label,
      summary: entry.summary,
      description: entry.issue || `Provider route ${entry.effectiveProviderName}.`,
      tags: ['provider', entry.mode, entry.readiness],
      readiness,
      source: 'zavorth-core',
      requirements: this.emptyRequirements(),
      governance: this.governance({
        risk: 'medium',
        requiresApproval: false,
        networkScope: entry.mode === 'local' ? 'local' : 'external-policy',
        sandboxRequired: false,
      }),
      activation: this.activation({
        configured: readiness === 'ready',
        installed: true,
        defaultEnabled: readiness === 'ready',
        liveAllowed: readiness === 'ready',
        setupGuided: readiness !== 'ready',
        commands: [`/providers ${entry.id}`],
        readinessChecks: ['ProviderDoctorService'],
      }),
      provenance: this.provenance('ProviderDoctorService', entry.id, 'zavorth-core', false),
    });
  }

  private fromMcp(entry: IntegrationHubMcpServerEntry): CapabilityHubItem {
    const readiness: CapabilityHubReadiness =
      entry.status === 'connected'
        ? 'ready'
        : entry.status === 'disabled' || entry.status === 'stopped'
          ? 'disabled'
          : entry.status === 'failed'
            ? 'needs_configuration'
            : 'planned';

    return this.item({
      id: `mcp:${entry.id}`,
      kind: 'mcp',
      label: entry.id,
      summary: entry.summary,
      description: entry.issue || `${entry.toolCount} MCP tool(s): ${entry.toolNames.join(', ') || 'none'}.`,
      tags: ['mcp', entry.status, entry.capability || 'uncategorized'],
      readiness,
      source: 'local-config',
      requirements: this.emptyRequirements(),
      governance: this.governance({
        risk: entry.toolCount > 0 ? 'medium' : 'unknown',
        requiresApproval: true,
        networkScope: 'external-policy',
        sandboxRequired: true,
      }),
      activation: this.activation({
        configured: entry.enabled,
        installed: entry.status !== 'manifest_only',
        defaultEnabled: entry.enabled,
        liveAllowed: entry.status === 'connected',
        setupGuided: entry.status !== 'connected',
        commands: [`/mcp ${entry.id}`],
        readinessChecks: ['McpCapabilityControlPlaneService'],
      }),
      provenance: this.provenance('McpCapabilityControlPlaneService', entry.id, 'local-config', false),
    });
  }

  private fromSkill(entry: SkillCatalogEntry): CapabilityHubItem {
    const risk = this.mapSkillRisk(entry.risk?.level);
    const licenseBlocks = entry.licensePolicy ? !entry.licensePolicy.allowRuntimeUse : false;
    const readiness: CapabilityHubReadiness = licenseBlocks || risk === 'blocked'
      ? 'blocked'
      : entry.risk?.reviewRequired || entry.licensePolicy?.reviewRequired
        ? 'needs_configuration'
        : 'ready';

    return this.item({
      id: `skill:${entry.id}`,
      kind: 'skill',
      label: entry.name,
      summary: entry.description,
      description: entry.description,
      tags: ['skill', ...(entry.bundleTags || [])],
      readiness,
      source: entry.imported ? 'imported' : 'zavorth-core',
      requirements: this.emptyRequirements(),
      governance: this.governance({
        risk,
        requiresApproval: entry.risk?.reviewRequired || entry.licensePolicy?.reviewRequired || false,
        networkScope: 'unknown',
        sandboxRequired: risk === 'high' || risk === 'blocked',
      }),
      activation: this.activation({
        configured: readiness === 'ready',
        installed: true,
        defaultEnabled: readiness === 'ready',
        liveAllowed: readiness === 'ready',
        setupGuided: readiness !== 'ready',
        commands: [`/skills ${entry.name}`],
        readinessChecks: ['SkillCatalogService', 'SkillTrustPolicyService'],
      }),
      provenance: this.provenance('SkillCatalogService', entry.id, entry.imported ? 'imported' : 'zavorth-core', entry.imported),
    });
  }

  private fromRecipe(entry: SkillRecipeSnapshot): CapabilityHubItem {
    return this.item({
      id: `recipe:${entry.id}`,
      kind: 'recipe',
      label: entry.label,
      summary: entry.summary,
      description: `${entry.rationale} ${entry.actionHint}`,
      tags: ['recipe', ...entry.tags],
      readiness: entry.ready ? 'ready' : 'needs_configuration',
      source: 'zavorth-core',
      requirements: {
        ...this.emptyRequirements(),
        manualSteps: entry.steps,
      },
      governance: this.governance({
        risk: 'medium',
        requiresApproval: true,
        networkScope: 'unknown',
        sandboxRequired: false,
      }),
      activation: this.activation({
        configured: entry.ready,
        installed: entry.ready,
        defaultEnabled: false,
        liveAllowed: entry.ready,
        setupGuided: true,
        commands: [`/skills --recipe ${entry.id}`],
        readinessChecks: ['SkillRecipeService'],
      }),
      provenance: this.provenance('SkillRecipeService', entry.id, 'zavorth-core', false),
    });
  }

  private normalizeQuery(query: CapabilityHubQuery): CapabilityHubSnapshot['query'] {
    return {
      query: this.normalizeText(query.query) || null,
      kind: query.kind || null,
      readiness: query.readiness || null,
      selectedId: this.normalizeText(query.selectedId) || null,
    };
  }

  private filterItems(items: CapabilityHubItem[], query: CapabilityHubSnapshot['query']): CapabilityHubItem[] {
    return items.filter((item) => {
      if (query.kind && item.kind !== query.kind) {
        return false;
      }
      if (query.readiness && item.readiness !== query.readiness) {
        return false;
      }
      if (query.query && !item.searchText.includes(query.query)) {
        return false;
      }
      return true;
    });
  }

  private resolveSelectedItem(items: CapabilityHubItem[], value: string | null | undefined): CapabilityHubItem | null {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }
    return items.find((item) =>
      this.normalizeText(item.id) === normalized
      || this.normalizeText(item.id.replace(/^[^:]+:/u, '')) === normalized
      || this.normalizeText(item.label) === normalized) || null;
  }

  private buildGroups(items: CapabilityHubItem[]): CapabilityHubGroupSummary[] {
    return KIND_ORDER.map((kind) => {
      const groupItems = items.filter((item) => item.kind === kind);
      return {
        kind,
        total: groupItems.length,
        ready: groupItems.filter((item) => item.readiness === 'ready').length,
        needsConfiguration: groupItems.filter((item) => item.readiness === 'needs_configuration').length,
        planned: groupItems.filter((item) => item.readiness === 'planned').length,
        blocked: groupItems.filter((item) => item.readiness === 'blocked').length,
      };
    }).filter((group) => group.total > 0);
  }

  private buildSummary(allItems: CapabilityHubItem[], visibleItems: CapabilityHubItem[]): CapabilityHubSnapshot['summary'] {
    return {
      total: allItems.length,
      visible: visibleItems.length,
      ready: allItems.filter((item) => item.readiness === 'ready').length,
      needsConfiguration: allItems.filter((item) => item.readiness === 'needs_configuration').length,
      needsProbe: allItems.filter((item) => item.readiness === 'needs_probe').length,
      planned: allItems.filter((item) => item.readiness === 'planned').length,
      blocked: allItems.filter((item) => item.readiness === 'blocked').length,
      guidedSetup: allItems.filter((item) => item.activation.setupGuided).length,
      approvalGated: allItems.filter((item) => item.governance.requiresApproval).length,
    };
  }

  private pickFeaturedItems(items: CapabilityHubItem[]): CapabilityHubItem[] {
    return items
      .slice()
      .sort((left, right) => {
        const rightReady = right.readiness === 'ready' ? 1 : 0;
        const leftReady = left.readiness === 'ready' ? 1 : 0;
        const rightGuided = right.activation.setupGuided ? 1 : 0;
        const leftGuided = left.activation.setupGuided ? 1 : 0;
        return rightReady - leftReady
          || rightGuided - leftGuided
          || KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind)
          || left.label.localeCompare(right.label, 'en-US');
      })
      .slice(0, 12);
  }

  private buildNarrative(
    summary: CapabilityHubSnapshot['summary'],
    groups: CapabilityHubGroupSummary[],
    selected: CapabilityHubItem | null,
  ): CapabilityHubSnapshot['narrative'] {
    const groupText = groups.map((group) => `${group.kind}:${group.total}`).join(', ');
    const nextAction = selected
      ? `Inspect ${selected.id}, then run its readiness checks before live activation.`
      : 'Use `npm run capability-hub -- --search <term>` to inspect a channel, skill, MCP, provider or recipe.';

    return {
      headline: `Capability Hub indexes ${summary.total} Zavorth-native capability item(s).`,
      operatorSummary: `${summary.ready} ready, ${summary.needsConfiguration} need setup, ${summary.needsProbe} need probe, ${summary.blocked} blocked. Groups: ${groupText}.`,
      nextAction,
    };
  }

  private item(input: Omit<CapabilityHubItem, 'searchText'>): CapabilityHubItem {
    return {
      ...input,
      searchText: this.searchText([
        input.id,
        input.kind,
        input.label,
        input.summary,
        input.description,
        input.readiness,
        input.source,
        ...input.tags,
        ...input.requirements.secretRefs,
        ...input.requirements.envKeys,
        ...input.activation.commands,
      ]),
    };
  }

  private activation(input: CapabilityHubActivation): CapabilityHubActivation {
    return {
      ...input,
      commands: input.commands.filter(Boolean),
      readinessChecks: input.readinessChecks.filter(Boolean),
    };
  }

  private governance(input: {
    risk: CapabilityHubRiskLevel;
    requiresApproval: boolean;
    networkScope: CapabilityHubGovernance['networkScope'];
    sandboxRequired: boolean;
  }): CapabilityHubGovernance {
    return {
      risk: input.risk,
      requiresApproval: input.requiresApproval || input.risk === 'high' || input.risk === 'blocked',
      budgetRequired: input.networkScope === 'external-policy',
      sandboxRequired: input.sandboxRequired,
      networkScope: input.networkScope,
      receiptRequired: true,
      auditTrailRequired: true,
    };
  }

  private provenance(
    sourceService: string,
    sourceId: string,
    owner: CapabilityHubSourceKind,
    externalRuntimeDependency: boolean,
  ): CapabilityHubItem['provenance'] {
    return {
      owner: owner === 'imported' ? 'imported' : 'zavorth-core',
      sourceService,
      sourceId,
      externalRuntimeDependency,
      canonicalRootOnly: true,
    };
  }

  private emptyRequirements(): CapabilityHubRequirement {
    return {
      secretRefs: [],
      envKeys: [],
      accounts: [],
      binaries: [],
      manualSteps: [],
    };
  }

  private mapReadiness(value: string): CapabilityHubReadiness {
    if (value === 'ready' || value === 'partial' || value === 'planned' || value === 'disabled') {
      return value;
    }
    if (value === 'needs_config') {
      return 'needs_configuration';
    }
    if (value === 'needs_probe') {
      return 'needs_probe';
    }
    if (value === 'needs_configuration') {
      return 'needs_configuration';
    }
    return 'planned';
  }

  private mapSkillRisk(value: string | null | undefined): CapabilityHubRiskLevel {
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'blocked') {
      return value;
    }
    return 'unknown';
  }

  private riskFromDangerLevel(value: string | null | undefined): CapabilityHubRiskLevel {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return 'low';
    }
    if (normalized.includes('block')) {
      return 'blocked';
    }
    if (normalized.includes('high') || normalized.includes('danger')) {
      return 'high';
    }
    if (normalized.includes('medium') || normalized.includes('write')) {
      return 'medium';
    }
    return 'low';
  }

  private renderItemLine(item: CapabilityHubItem): string {
    return `${item.id} [${item.kind}/${item.readiness}] ${item.label} - ${item.summary}`;
  }

  private searchText(values: string[]): string {
    return values.map((value) => this.normalizeText(value)).filter(Boolean).join(' ');
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }
}
