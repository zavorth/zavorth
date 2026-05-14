import type { CapabilityDefinition } from '../contracts/CapabilityContract.js';
import { getDefaultCapabilityRegistry, type CapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { ZavorthSessionToolsService } from '../runtime/sessions/ZavorthSessionToolsService.js';
import { ZavorthTeamCatalogService } from './ZavorthTeamCatalogService.js';
import {
  GatewaySessionToolsService,
  type GatewaySessionToolDescriptor,
} from '../runtime/sessions/GatewaySessionToolsService.js';
import {
  ToolCatalogService,
  type RuntimeToolCatalogEntry,
} from './tools/ToolCatalogService.js';

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'getAll'>;
type TeamCatalogLike = Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
type IntegrationHubLike = Pick<IntegrationHubService, 'buildCatalogSnapshot'>;

type ZavorthToolCatalogRuntime = {
  now?: () => Date;
  capabilityRegistry?: CapabilityRegistryLike;
  integrationHubService?: IntegrationHubLike;
  teamCatalogService?: TeamCatalogLike;
  gatewaySessionToolsService?: Pick<GatewaySessionToolsService, 'buildDescriptors'> | null;
  sessionToolsService?: Pick<ZavorthSessionToolsService, 'buildSnapshot'> | null;
  runtimeToolCatalogService?: Pick<ToolCatalogService, 'listTools'> | null;
};

export type ZavorthToolFamilySnapshot = {
  id: string;
  label: string;
  readiness: 'ready' | 'partial' | 'planned';
  total: number;
  operatorSummary: string;
  featured: Array<{
    id: string;
    label: string;
    kind: 'command' | 'session' | 'team' | 'integration' | 'surface' | 'runtime-tool';
    command: string | null;
  }>;
};

export type ZavorthToolCatalogEntrySnapshot = {
  id: string;
  label: string;
  familyId: string;
  familyLabel: string;
  kind: 'command' | 'session' | 'team' | 'integration' | 'surface' | 'runtime-tool';
  source: string;
  readiness: 'ready' | 'partial' | 'planned';
  summary: string;
  command: string | null;
  details: string[];
  searchText: string;
};

export type ZavorthToolCatalogSnapshot = {
  generatedAt: string;
  summary: {
    totalFamilies: number;
    readyFamilies: number;
    partialFamilies: number;
    plannedFamilies: number;
    totalTools: number;
    visibleTools: number;
  };
  families: ZavorthToolFamilySnapshot[];
  entries: ZavorthToolCatalogEntrySnapshot[];
  selected: ZavorthToolCatalogEntrySnapshot | null;
  featuredIds: string[];
  query: string | null;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthToolCatalogService {
  private readonly now: () => Date;
  private readonly capabilityRegistry: CapabilityRegistryLike;
  private readonly integrationHub: IntegrationHubLike;
  private readonly teamCatalog: TeamCatalogLike;
  private readonly gatewaySessionTools: Pick<GatewaySessionToolsService, 'buildDescriptors'> | null;
  private readonly sessionTools: Pick<ZavorthSessionToolsService, 'buildSnapshot'> | null;
  private readonly runtimeToolCatalog: Pick<ToolCatalogService, 'listTools'> | null;

  constructor(runtime: ZavorthToolCatalogRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.integrationHub = runtime.integrationHubService || new IntegrationHubService();
    this.teamCatalog = runtime.teamCatalogService || new ZavorthTeamCatalogService();
    this.gatewaySessionTools = runtime.gatewaySessionToolsService || null;
    this.sessionTools = runtime.sessionToolsService || null;
    this.runtimeToolCatalog = runtime.runtimeToolCatalogService || null;
  }

  public buildSnapshot(input?: {
    selectedId?: string | null;
    query?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    userId?: string | null;
  }): ZavorthToolCatalogSnapshot {
    const capabilities = this.capabilityRegistry.getAll();
    const sessionTools = this.resolveSessionTools(input);
    const integrations = this.integrationHub.buildCatalogSnapshot();
    const teams = this.teamCatalog.buildSnapshot();
    const runtimeTools = this.runtimeToolCatalog?.listTools() || [];
    const allEntries = [
      ...this.buildCapabilityEntries(capabilities),
      ...this.buildSessionEntries(sessionTools),
      ...this.buildTeamEntries(teams),
      ...this.buildIntegrationEntries(integrations.entries || []),
      ...this.buildRuntimeToolEntries(runtimeTools),
      ...this.buildSyntheticEntries(),
    ];
    const query = String(input?.query || '').trim() || null;
    const selectedId = String(input?.selectedId || '').trim().toLowerCase() || null;
    const filteredEntries = allEntries.filter((entry) => this.matchesEntry(entry, query));
    const selected =
      (selectedId
        ? filteredEntries.find((entry) => entry.id.toLowerCase() === selectedId)
          || allEntries.find((entry) => entry.id.toLowerCase() === selectedId)
        : null)
      || this.resolveQuerySelection(filteredEntries, query);
    const families: ZavorthToolFamilySnapshot[] = [
      this.buildFamilySnapshot('execution', 'Execucao', filteredEntries),
      this.buildFamilySnapshot('search', 'Pesquisa', filteredEntries),
      this.buildFamilySnapshot('automation', 'Automacao e Schedule', filteredEntries),
      this.buildFamilySnapshot('session', 'Session Tools', filteredEntries),
      this.buildFamilySnapshot('team', 'Teams', filteredEntries),
      this.buildFamilySnapshot('integration', 'Integracoes e Plugins', filteredEntries),
      this.buildFamilySnapshot('runtime', 'Runtime Tools', filteredEntries),
      this.buildFamilySnapshot('web', 'Web e Control', filteredEntries),
      this.buildFamilySnapshot('mcp', 'MCP', filteredEntries),
      this.buildFamilySnapshot('lsp', 'LSP', filteredEntries),
    ];
    const summary = families.reduce(
      (acc, family) => {
        acc.totalFamilies += 1;
        acc.totalTools += family.total;
        if (family.readiness === 'ready') {
          acc.readyFamilies += 1;
        } else if (family.readiness === 'partial') {
          acc.partialFamilies += 1;
        } else {
          acc.plannedFamilies += 1;
        }
        return acc;
      },
      {
        totalFamilies: 0,
        readyFamilies: 0,
        partialFamilies: 0,
        plannedFamilies: 0,
        totalTools: 0,
        visibleTools: filteredEntries.length,
      },
    );

    return {
      generatedAt: this.now().toISOString(),
      summary,
      families,
      entries: filteredEntries,
      selected,
      featuredIds: filteredEntries.slice(0, 8).map((entry) => entry.id),
      query,
      narrative: {
        headline: query
          ? `Tool surface com ${filteredEntries.length} item(ns) visivel(is) para "${query}".`
          : `Surface explicita com ${summary.totalTools} tool(s) distribuidas em ${summary.totalFamilies} familia(s).`,
        operatorSummary: query
          ? `${summary.readyFamilies} familia(s) prontas no filtro atual; ${selected ? `item em foco: ${selected.label}.` : 'sem item selecionado.'}`
          : `${summary.readyFamilies} familia(s) prontas, ${summary.partialFamilies} parciais e ${summary.plannedFamilies} ainda planejadas.`,
      },
    };
  }

  private buildFamilySnapshot(
    id: string,
    label: string,
    entries: ZavorthToolCatalogEntrySnapshot[],
  ): ZavorthToolFamilySnapshot {
    const matches = entries.filter((entry) => entry.familyId === id);
    const readiness = matches.length === 0
      ? this.resolvePlannedFamilyReadiness(id)
      : matches.every((entry) => entry.readiness === 'ready')
        ? 'ready'
        : matches.some((entry) => entry.readiness === 'ready' || entry.readiness === 'partial')
          ? 'partial'
          : 'planned';

    return {
      id,
      label,
      readiness,
      total: matches.length,
      operatorSummary: matches.length
        ? this.summarizeFamily(label, matches)
        : this.describeEmptyFamily(id),
      featured: matches.slice(0, 6).map((entry) => ({
        id: entry.id,
        label: entry.label,
        kind: entry.kind,
        command: entry.command,
      })),
    };
  }

  private buildCapabilityEntries(capabilities: CapabilityDefinition[]): ZavorthToolCatalogEntrySnapshot[] {
    return capabilities
      .filter((capability) => capability.command || capability.matchers?.length)
      .map((capability) => {
        const familyId = this.resolveCapabilityFamilyId(capability);
        const description = String(
          capability.command?.description
          || capability.routing_reason
          || capability.description
          || 'Capability declarada no Zavorth.'
        ).trim();
        return {
          id: capability.id,
          label: capability.label,
          familyId,
          familyLabel: this.getFamilyLabel(familyId),
          kind: 'command',
          source: capability.source === 'plugin'
            ? `plugin:${capability.plugin_name || capability.id}`
            : String(capability.source || 'builtin').trim() || 'builtin',
          readiness: 'ready',
          summary: description,
          command: capability.command?.command || null,
          details: [
            capability.command?.command ? `Comando: ${capability.command.command}` : null,
            capability.routing_reason ? `Rota: ${capability.routing_reason}` : null,
            capability.plugin_name ? `Plugin: ${capability.plugin_name}` : null,
          ].filter((entry): entry is string => Boolean(entry)),
          searchText: [
            capability.id,
            capability.label,
            capability.command?.command || '',
            capability.description || '',
            capability.routing_reason || '',
            capability.plugin_name || '',
            familyId,
          ].join(' ').toLowerCase(),
        };
      });
  }

  private buildSessionEntries(sessionTools: GatewaySessionToolDescriptor[]): ZavorthToolCatalogEntrySnapshot[] {
    return sessionTools.map((entry) => ({
      id: entry.id,
      label: entry.label,
      familyId: 'session',
      familyLabel: 'Session Tools',
      kind: 'session',
      source: 'gateway-session-tools',
      readiness: entry.readiness,
      summary: entry.description,
      command: `/${entry.id.replace('_', '')}`,
      details: [entry.operatorSummary],
      searchText: [entry.id, entry.label, entry.description, entry.operatorSummary, 'session'].join(' ').toLowerCase(),
    }));
  }

  private resolveSessionTools(input?: {
    sessionId?: string | null;
    chatId?: string | null;
    userId?: string | null;
  }): GatewaySessionToolDescriptor[] {
    const gatewayEntries = this.gatewaySessionTools?.buildDescriptors() || [];
    const canBuildContextualSessionTools =
      this.sessionTools
      && String(input?.sessionId || '').trim()
      && String(input?.chatId || '').trim()
      && String(input?.userId || '').trim();

    if (!canBuildContextualSessionTools) {
      return gatewayEntries;
    }

    const snapshot = this.sessionTools!.buildSnapshot({
      sessionId: String(input?.sessionId || '').trim(),
      chatId: String(input?.chatId || '').trim(),
      userId: String(input?.userId || '').trim(),
    });

    return snapshot.tools.map((tool) => ({
      id: tool.id,
      label: tool.label,
      family: 'session',
      readiness: 'ready',
      description: tool.description,
      operatorSummary: tool.actionHint,
    }));
  }

  private buildTeamEntries(teamSnapshot: any): ZavorthToolCatalogEntrySnapshot[] {
    const entries = Array.isArray(teamSnapshot?.teams) ? teamSnapshot.teams : [];
    return entries.map((entry: any) => ({
      id: String(entry.id || '').trim(),
      label: String(entry.label || entry.id || 'team').trim(),
      familyId: 'team',
      familyLabel: 'Teams',
      kind: 'team',
      source: 'team-catalog',
      readiness: 'ready',
      summary: String(entry.summary || entry.whenToUse || 'Team exposto pelo Zavorth.').trim(),
      command: String(entry.entryCommand || '').trim() || null,
      details: [
        entry.entryCommand ? `Entrada: ${entry.entryCommand}` : null,
        entry.workspace ? `Workspace: ${entry.workspace}` : null,
      ].filter((detail): detail is string => Boolean(detail)),
      searchText: [
        entry.id,
        entry.label,
        entry.summary || '',
        entry.whenToUse || '',
        entry.entryCommand || '',
        'team',
      ].join(' ').toLowerCase(),
    }));
  }

  private buildIntegrationEntries(entries: any[]): ZavorthToolCatalogEntrySnapshot[] {
    return entries.map((entry) => {
      const manifest = entry?.manifest || {};
      const readiness = entry?.readiness === 'ready' ? 'ready' : entry?.readiness === 'partial' ? 'partial' : 'planned';
      return {
        id: String(manifest.id || '').trim(),
        label: String(manifest.label || manifest.id || 'integracao').trim(),
        familyId: 'integration',
        familyLabel: 'Integracoes e Plugins',
        kind: 'integration',
        source: `integration:${manifest.category || 'generic'}`,
        readiness,
        summary: String(manifest.summary || 'Integracao catalogada no Zavorth.').trim(),
        command: manifest.connectCommand || null,
        details: [
          manifest.category ? `Categoria: ${manifest.category}` : null,
          manifest.binding?.kind ? `Binding: ${manifest.binding.kind}` : null,
          entry?.readiness ? `Readiness: ${entry.readiness}` : null,
        ].filter((detail): detail is string => Boolean(detail)),
        searchText: [
          manifest.id || '',
          manifest.label || '',
          manifest.summary || '',
          manifest.category || '',
          manifest.connectCommand || '',
          'integration',
        ].join(' ').toLowerCase(),
      };
    });
  }

  private buildRuntimeToolEntries(entries: RuntimeToolCatalogEntry[]): ZavorthToolCatalogEntrySnapshot[] {
    return entries.map((entry) => {
      const familyId = this.resolveRuntimeToolFamilyId(entry);
      return {
        id: entry.id,
        label: entry.label,
        familyId,
        familyLabel: this.getFamilyLabel(familyId),
        kind: 'runtime-tool',
        source: `runtime:${entry.source}`,
        readiness: 'ready',
        summary: entry.description,
        command: null,
        details: [
          `${entry.parameterCount} parametro(s).`,
          entry.requiredCount > 0 ? `${entry.requiredCount} obrigatorio(s).` : 'Sem obrigatorios.',
        ],
        searchText: [
          entry.id,
          entry.label,
          entry.description,
          familyId,
          'runtime tool',
        ].join(' ').toLowerCase(),
      };
    });
  }

  private buildSyntheticEntries(): ZavorthToolCatalogEntrySnapshot[] {
    return [
      {
        id: 'web-session',
        label: '/api/web/session',
        familyId: 'web',
        familyLabel: 'Web e Control',
        kind: 'surface',
        source: 'surface:web',
        readiness: 'partial',
        summary: 'Session bootstrap e control plane web ja ficam visiveis no produto.',
        command: null,
        details: ['Surface web/control ja existe, mas ainda pode ficar mais unificada.'],
        searchText: '/api/web/session web control session bootstrap',
      },
      {
        id: 'web-approvals',
        label: '/api/web/permissions',
        familyId: 'web',
        familyLabel: 'Web e Control',
        kind: 'surface',
        source: 'surface:web',
        readiness: 'partial',
        summary: 'Aprovacoes e operacao web ja existem como surface first-class.',
        command: null,
        details: ['Aprovacoes operacionais ja estao visiveis no app remoto.'],
        searchText: '/api/web/permissions approvals web control',
      },
      {
        id: 'mcp-planned',
        label: 'MCP plane',
        familyId: 'mcp',
        familyLabel: 'MCP',
        kind: 'surface',
        source: 'surface:planned',
        readiness: 'planned',
        summary: 'Ainda nao existe uma surface MCP first-class unica no produto.',
        command: null,
        details: ['O runtime MCP existe, mas o plano de produto ainda pode ficar mais explicito.'],
        searchText: 'mcp planned runtime surface',
      },
      {
        id: 'lsp-planned',
        label: 'LSP plane',
        familyId: 'lsp',
        familyLabel: 'LSP',
        kind: 'surface',
        source: 'surface:planned',
        readiness: 'planned',
        summary: 'LSP ainda nao aparece como familia explicita de tools.',
        command: null,
        details: ['A familia ja fica visivel para o operador mesmo antes da implementacao completa.'],
        searchText: 'lsp planned ide language server',
      },
    ];
  }

  private resolveCapabilityFamilyId(capability: CapabilityDefinition): string {
    const section = String(capability.command?.section || capability.type || '').trim().toLowerCase();
    if (section === 'search' || section === 'research') {
      return 'search';
    }
    if (section === 'schedule' || section === 'automation') {
      return 'automation';
    }
    return 'execution';
  }

  private resolveRuntimeToolFamilyId(entry: RuntimeToolCatalogEntry): string {
    const normalized = `${entry.id} ${entry.label} ${entry.description}`.toLowerCase();
    if (normalized.includes('search')) {
      return 'search';
    }
    if (normalized.includes('mem') || normalized.includes('memory')) {
      return 'session';
    }
    if (normalized.includes('remote') || normalized.includes('sandbox') || normalized.includes('shell')) {
      return 'execution';
    }
    if (normalized.includes('mcp')) {
      return 'mcp';
    }
    return 'runtime';
  }

  private getFamilyLabel(familyId: string): string {
    switch (familyId) {
      case 'execution':
        return 'Execucao';
      case 'search':
        return 'Pesquisa';
      case 'automation':
        return 'Automacao e Schedule';
      case 'session':
        return 'Session Tools';
      case 'team':
        return 'Teams';
      case 'integration':
        return 'Integracoes e Plugins';
      case 'runtime':
        return 'Runtime Tools';
      case 'web':
        return 'Web e Control';
      case 'mcp':
        return 'MCP';
      case 'lsp':
        return 'LSP';
      default:
        return familyId;
    }
  }

  private resolvePlannedFamilyReadiness(id: string): 'planned' | 'partial' {
    return id === 'web' ? 'partial' : 'planned';
  }

  private describeEmptyFamily(id: string): string {
    switch (id) {
      case 'session':
        return 'Session tools ainda nao foram promovidas a familia explicita.';
      case 'team':
        return 'Teams ainda nao foram expostos como familia de tools.';
      case 'integration':
        return 'Nenhuma integracao catalogada no hub.';
      case 'runtime':
        return 'Nenhuma tool do runtime foi ligada ao catalogo atual.';
      case 'web':
        return 'Superficie web/control ja existe, mas ainda pode ficar mais unificada.';
      case 'mcp':
        return 'Ainda nao existe uma surface MCP first-class unica no produto.';
      case 'lsp':
        return 'LSP ainda nao aparece como familia explicita de tools.';
      default:
        return 'Familia ainda sem tools first-class catalogadas.';
    }
  }

  private summarizeFamily(label: string, entries: ZavorthToolCatalogEntrySnapshot[]): string {
    const ready = entries.filter((entry) => entry.readiness === 'ready').length;
    return `${label} expõe ${entries.length} item(ns), com ${ready} pronto(s) no plano atual.`;
  }

  private matchesEntry(entry: ZavorthToolCatalogEntrySnapshot, query: string | null): boolean {
    if (!query) {
      return true;
    }

    return entry.searchText.includes(query.toLowerCase());
  }

  private resolveQuerySelection(
    entries: ZavorthToolCatalogEntrySnapshot[],
    query: string | null,
  ): ZavorthToolCatalogEntrySnapshot | null {
    if (!query) {
      return null;
    }

    const normalized = query.toLowerCase();
    return entries.find((entry) => entry.id.toLowerCase() === normalized)
      || entries.find((entry) => entry.command?.toLowerCase() === normalized)
      || entries.find((entry) => entry.label.toLowerCase() === normalized)
      || entries[0]
      || null;
  }
}
