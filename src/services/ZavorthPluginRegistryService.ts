import type { IntegrationCatalogEntry } from '../contracts/IntegrationHubContract.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import {
  ZavorthPlatformCatalogSourceService,
  type ZavorthPlatformCatalogEntry,
} from './ZavorthPlatformCatalogSourceService.js';
import { PluginStateService, type PluginTrustState } from './PluginStateService.js';

import { WorkspaceExtensionRegistryService, type WorkspaceExtensionEntry } from './WorkspaceExtensionRegistryService.js';

type ZavorthPluginRegistryRuntime = {
  now?: () => Date;
  integrationHubService?: Pick<IntegrationHubService, 'buildCatalogSnapshot' | 'listCatalogEntries'>
    & Partial<Pick<IntegrationHubService, 'buildCatalogStatusSummary'>>;
  catalogSourceService?: Pick<ZavorthPlatformCatalogSourceService, 'listEntries'>;
  workspaceExtensions?: WorkspaceExtensionRegistryService;
  pluginStateService?: PluginStateService;
};

export type ZavorthPluginEntry = {
  id: string;
  kind:
    | 'integration'
    | 'template'
    | 'workspace-extension'
    | 'workspace-command-pack'
    | 'workspace-hook-pack';
  source: 'integration-hub' | 'workspace-profile';
  label: string;
  version: string;
  readiness: 'ready' | 'configure' | 'template' | 'workspace';
  trust: PluginTrustState;
  summary: string;
  actionHint: string;
  installState: 'installed' | 'available' | 'draft' | 'workspace';
  registrySource: string | null;
  featured: boolean;
  tags: string[];
  capabilities: string[];
  searchText: string;
  actions: Array<{
    id: string;
    label: string;
    command: string | null;
    kind: 'inspect' | 'doctor' | 'install' | 'update' | 'remove' | 'open' | 'trust';
  }>;
  details: string[];
};

export type ZavorthPluginRegistrySnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    ready: number;
    configurable: number;
    templates: number;
    workspaceExtensions: number;
    trusted: number;
    installed: number;
    catalogBacked: number;
    featured: number;
  };
  query: string | null;
  entries: ZavorthPluginEntry[];
  selected: ZavorthPluginEntry | null;
  featuredIds: string[];
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export type ZavorthPluginRegistryStatusSummary = {
  generatedAt: string;
  summary: {
    total: number;
  };
};

export class ZavorthPluginRegistryService {
  private readonly now: () => Date;
  private readonly integrationHub: Pick<IntegrationHubService, 'buildCatalogSnapshot' | 'listCatalogEntries'>
    & Partial<Pick<IntegrationHubService, 'buildCatalogStatusSummary'>>;
  private readonly catalogSource: Pick<ZavorthPlatformCatalogSourceService, 'listEntries'>;
  private readonly workspaceExtensions: WorkspaceExtensionRegistryService;
  private readonly pluginState: PluginStateService;

  constructor(runtime: ZavorthPluginRegistryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.integrationHub = runtime.integrationHubService || new IntegrationHubService();
    this.catalogSource = runtime.catalogSourceService || new ZavorthPlatformCatalogSourceService();
    this.workspaceExtensions = runtime.workspaceExtensions || new WorkspaceExtensionRegistryService();
    this.pluginState = runtime.pluginStateService || new PluginStateService();
  }

  public buildSnapshot(input: { selectedId?: string | null; query?: string | null } = {}): ZavorthPluginRegistrySnapshot {
    const selectedId = this.normalizeSearchValue(input.selectedId);
    const query = this.normalizeSearchValue(input.query);
    const pluginCatalog = this.catalogSource.listEntries('plugin');
    const pluginCatalogById = new Map(
      pluginCatalog
        .map((entry) => [this.normalizePluginCatalogId(entry.id), entry] as const)
        .filter(([id]) => Boolean(id)),
    );
    const catalog = this.integrationHub.buildCatalogSnapshot(selectedId || null);
    const integrationEntries = (catalog.entries || []).map((entry) =>
      this.fromIntegration(entry, pluginCatalogById.get(this.normalizeSearchValue(entry.manifest.id)) || null),
    );
    const workspaceEntries = this.workspaceExtensions
      .listEntries()
      .flatMap((entry) => this.fromWorkspace(entry));
    const allEntries = [...integrationEntries, ...workspaceEntries].sort((left, right) =>
      left.label.localeCompare(right.label, 'en-US'),
    );
    const entries = query
      ? allEntries.filter((entry) => entry.searchText.includes(query))
      : allEntries;
    const summary = {
      total: entries.length,
      ready: entries.filter((entry) => entry.readiness === 'ready' || entry.readiness === 'workspace').length,
      configurable: entries.filter((entry) => entry.readiness === 'configure').length,
      templates: entries.filter((entry) => entry.kind === 'template').length,
      workspaceExtensions: entries.filter((entry) => entry.kind === 'workspace-extension').length,
      trusted: entries.filter((entry) => entry.trust === 'trusted').length,
      installed: entries.filter((entry) => ['installed', 'workspace'].includes(entry.installState)).length,
      catalogBacked: entries.filter((entry) => Boolean(entry.registrySource)).length,
      featured: entries.filter((entry) => entry.featured).length,
    };
    const selected = this.resolveSelectedEntry(entries, selectedId, query);

    return {
      generatedAt: this.now().toISOString(),
      summary,
      query: query || null,
      entries,
      selected,
      featuredIds: this.buildFeaturedIds(entries),
      narrative: {
        headline: `Zavorth exposes ${summary.total} item(s) in the plugin plane, skills and extensions.`,
        operatorSummary:
          summary.workspaceExtensions > 0
            ? `${summary.installed} registrado(s), ${summary.trusted} trusted, ${summary.workspaceExtensions} extensao(oes) vindas de ZAVORTH.md e ${summary.catalogBacked} item(ns) ancorado(s) no registry local.`
            : `${summary.installed} registrado(s), ${summary.configurable} configuravel(is), ${summary.templates} template(s) e ${summary.catalogBacked} item(ns) ancorado(s) no registry local para expandir o ecossistema.`,
      },
    };
  }

  public buildStatusSummary(): ZavorthPluginRegistryStatusSummary {
    const integrationCount =
      typeof this.integrationHub.buildCatalogStatusSummary === 'function'
        ? this.integrationHub.buildCatalogStatusSummary().total
        : this.integrationHub.listCatalogEntries().length;
    const workspaceEntries = this.workspaceExtensions
      .listEntries()
      .flatMap((entry) => this.fromWorkspace(entry));

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: integrationCount + workspaceEntries.length,
      },
    };
  }

  public renderCatalogReport(input?: { query?: string | null; selectedId?: string | null }): string {
    const snapshot = this.buildSnapshot(input);
    const hasFocusedSelection = Boolean(
      this.normalizeSearchValue(input?.selectedId) || this.normalizeSearchValue(input?.query),
    );
    const lines = [
      'Plugin plane do Zavorth',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Total: ${snapshot.summary.total} | registrados: ${snapshot.summary.installed} | trusted: ${snapshot.summary.trusted}.`,
    ];

    if (snapshot.selected && hasFocusedSelection) {
      lines.push('', ...this.renderEntryLines(snapshot.selected));
      return lines.join('\n');
    }

    lines.push('', 'Itens em destaque:');
    for (const entry of snapshot.entries.slice(0, 6)) {
      lines.push(`- ${entry.label} [${entry.kind}] - ${entry.summary}`);
    }
    lines.push('', 'Use /plugins <id|filtro> para aprofundar um item do plane.');
    return lines.join('\n');
  }

  private fromIntegration(entry: IntegrationCatalogEntry, catalogEntry: ZavorthPlatformCatalogEntry | null): ZavorthPluginEntry {
    const readiness =
      entry.manifest.category === 'template'
        ? 'template'
        : entry.readiness === 'ready'
          ? 'ready'
          : 'configure';
    const resolvedState = this.pluginState.resolveState(entry.manifest.id, {
      installed: Boolean(entry.installed) || readiness === 'ready',
      trust: readiness === 'ready' ? 'trusted' : 'review',
      installedRevision: entry.installed?.updatedAt || null,
    });
    const installState = resolvedState.installed
      ? 'installed'
      : entry.manifest.category === 'template'
        ? 'draft'
        : 'available';
    const combinedTags = Array.from(new Set([
      entry.manifest.category,
      entry.manifest.supportLevel,
      ...entry.manifest.tags,
      ...(catalogEntry?.tags || []),
    ]));
    const combinedCapabilities = Array.from(new Set([
      ...entry.manifest.capabilities,
      ...(catalogEntry?.capabilities || []),
    ]));
    return {
      id: entry.manifest.id,
      kind: entry.manifest.category === 'template' ? 'template' : 'integration',
      source: 'integration-hub',
      label: entry.manifest.label,
      version: resolvedState.installedRevision || entry.manifest.supportLevel,
      readiness,
      trust: resolvedState.trust,
      summary: catalogEntry?.summary || entry.manifest.summary,
      actionHint: readiness === 'ready' ? `/integrations ${entry.manifest.id}` : `/connect ${entry.manifest.id}`,
      installState,
      registrySource: catalogEntry?.source || null,
      featured: catalogEntry?.featured === true,
      tags: combinedTags,
      capabilities: combinedCapabilities,
      searchText: this.normalizeSearchText([
        entry.manifest.id,
        entry.manifest.label,
        catalogEntry?.summary || entry.manifest.summary,
        entry.manifest.description,
        entry.manifest.supportLevel,
        entry.manifest.category,
        ...combinedTags,
        ...combinedCapabilities,
        ...(catalogEntry?.details || []),
      ]),
      actions: [
        {
          id: `${entry.manifest.id}:inspect`,
          label: 'Inspecionar',
          command: `/integrations ${entry.manifest.id}`,
          kind: 'inspect',
        },
        {
          id: `${entry.manifest.id}:doctor`,
          label: 'Rodar doctor',
          command: `/plugins doctor ${entry.manifest.id}`,
          kind: 'doctor',
        },
        {
          id: `${entry.manifest.id}:open`,
          label: 'Open next step',
          command: `/plugins open ${entry.manifest.id}`,
          kind: 'open',
        },
        {
          id: `${entry.manifest.id}:${readiness === 'ready' ? 'update' : 'install'}`,
          label: readiness === 'ready' ? 'Reconciliar integracao' : 'Registrar no plane',
          command: `/plugins ${readiness === 'ready' ? 'update' : 'install'} ${entry.manifest.id}`,
          kind: readiness === 'ready' ? 'update' : 'install',
        },
        {
          id: `${entry.manifest.id}:${resolvedState.trust === 'trusted' ? 'review' : 'trust'}`,
          label: resolvedState.trust === 'trusted' ? 'Marcar review' : 'Marcar trusted',
          command: `/plugins ${resolvedState.trust === 'trusted' ? 'review' : 'trust'} ${entry.manifest.id}`,
          kind: 'trust',
        },
        ...(installState === 'installed'
          ? [
              {
                id: `${entry.manifest.id}:remove`,
                label: 'Remover cadastro local',
                command: `/plugins remove ${entry.manifest.id}`,
                kind: 'remove' as const,
              },
            ]
          : []),
      ],
      details: [
        `Binding: ${entry.manifest.binding.summary}`,
        `Suporte: ${entry.manifest.supportLevel}`,
        `Categoria: ${entry.manifest.category}`,
        `Trust: ${resolvedState.trust}`,
        `Next step: ${entry.doctor.nextAction.reason}`,
        ...(catalogEntry?.details || []),
      ],
    };
  }

  private fromWorkspace(entry: WorkspaceExtensionEntry): ZavorthPluginEntry[] {
    const entries: ZavorthPluginEntry[] = [];
    const commands = Array.isArray(entry.commands) ? entry.commands : [];
    const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    const installedRevision = entry.lastRefreshed || entry.instructionFile || null;
    const extensionState = this.pluginState.resolveState(`workspace:${entry.slug}`, {
      installed: true,
      trust: 'trusted',
      installedRevision,
    });
    const extensionSummary =
      entry.instructionSummary ||
      `${entry.commandCount} comando(s) e ${entry.hookCount} hook(s) de workspace registrados.`;

    entries.push({
      id: `workspace:${entry.slug}`,
      kind: 'workspace-extension',
      source: 'workspace-profile',
      label: entry.workspaceName,
      version: installedRevision || 'workspace-profile',
      readiness: 'workspace',
      trust: extensionState.trust,
      summary: extensionSummary,
      actionHint: entry.instructionFile || entry.workspace,
      installState: 'workspace',
      registrySource: null,
      featured: false,
      tags: ['workspace', 'extension', ...(entry.instructionFile ? ['zavorth-md'] : [])],
      capabilities: this.buildWorkspaceCapabilities(entry),
      searchText: this.normalizeSearchText([
        entry.workspaceName,
        entry.workspace,
        entry.instructionSummary,
        entry.instructionFile || '',
        'workspace extension',
      ]),
      actions: [
        {
          id: `workspace:${entry.slug}:inspect`,
          label: 'Inspecionar workspace',
          command: `npm run workspace:command -- --workspace "${entry.workspace}" --list`,
          kind: 'inspect',
        },
        {
          id: `workspace:${entry.slug}:open`,
          label: 'Open next step',
          command: `/plugins open workspace:${entry.slug}`,
          kind: 'open',
        },
        {
          id: `workspace:${entry.slug}:${extensionState.trust === 'trusted' ? 'review' : 'trust'}`,
          label: extensionState.trust === 'trusted' ? 'Marcar review' : 'Marcar trusted',
          command: `/plugins ${extensionState.trust === 'trusted' ? 'review' : 'trust'} workspace:${entry.slug}`,
          kind: 'trust',
        },
      ],
      details: [
        `Workspace: ${entry.workspace}`,
        `Instruction file: ${entry.instructionFile || 'not found'}`,
        `${entry.commandCount} comando(s) e ${entry.hookCount} hook(s) visiveis.`,
      ],
    });

    if (entry.commandCount > 0) {
      const commandState = this.pluginState.resolveState(`workspace-command:${entry.slug}`, {
        installed: true,
        trust: 'trusted',
        installedRevision,
      });
      entries.push({
        id: `workspace-command:${entry.slug}`,
        kind: 'workspace-command-pack',
        source: 'workspace-profile',
        label: `${entry.workspaceName} commands`,
        version: installedRevision || 'workspace-profile',
        readiness: 'workspace',
        trust: commandState.trust,
        summary: `${entry.commandCount} comando(s) do workspace expostos como pack reutilizavel.`,
        actionHint: `npm run workspace:command -- --workspace "${entry.workspace}" --list`,
        installState: 'workspace',
        registrySource: null,
        featured: false,
        tags: ['workspace', 'commands', 'pack'],
        capabilities: ['command-pack'],
        searchText: this.normalizeSearchText([
          entry.workspaceName,
          entry.workspace,
          'workspace commands',
          ...commands.map((command) => `${command.name} ${command.template}`),
        ]),
        actions: [
          {
            id: `workspace-command:${entry.slug}:inspect`,
            label: 'List commands',
            command: `npm run workspace:command -- --workspace "${entry.workspace}" --list`,
            kind: 'inspect',
          },
          {
            id: `workspace-command:${entry.slug}:open`,
            label: 'Open next step',
            command: `/plugins open workspace-command:${entry.slug}`,
            kind: 'open',
          },
          {
            id: `workspace-command:${entry.slug}:${commandState.trust === 'trusted' ? 'review' : 'trust'}`,
            label: commandState.trust === 'trusted' ? 'Marcar review' : 'Marcar trusted',
            command: `/plugins ${commandState.trust === 'trusted' ? 'review' : 'trust'} workspace-command:${entry.slug}`,
            kind: 'trust',
          },
        ],
        details: [
          `Workspace: ${entry.workspace}`,
          `Commands: ${entry.commandCount}`,
          ...commands.slice(0, 4).map((command) => `${command.name}: ${command.template}`),
        ],
      });
    }

    if (entry.hookCount > 0) {
      const hookState = this.pluginState.resolveState(`workspace-hook:${entry.slug}`, {
        installed: true,
        trust: 'trusted',
        installedRevision,
      });
      entries.push({
        id: `workspace-hook:${entry.slug}`,
        kind: 'workspace-hook-pack',
        source: 'workspace-profile',
        label: `${entry.workspaceName} hooks`,
        version: installedRevision || 'workspace-profile',
        readiness: 'workspace',
        trust: hookState.trust,
        summary: `${entry.hookCount} hook(s) do workspace expostos como pack observavel.`,
        actionHint: `npm run workspace:hook -- --workspace "${entry.workspace}" --list`,
        installState: 'workspace',
        registrySource: null,
        featured: false,
        tags: ['workspace', 'hooks', 'pack'],
        capabilities: ['hook-pack'],
        searchText: this.normalizeSearchText([
          entry.workspaceName,
          entry.workspace,
          'workspace hooks',
          ...hooks.map((hook) => `${hook.event} ${hook.command}`),
        ]),
        actions: [
          {
            id: `workspace-hook:${entry.slug}:inspect`,
            label: 'Listar hooks',
            command: `npm run workspace:hook -- --workspace "${entry.workspace}" --list`,
            kind: 'inspect',
          },
          {
            id: `workspace-hook:${entry.slug}:open`,
            label: 'Open next step',
            command: `/plugins open workspace-hook:${entry.slug}`,
            kind: 'open',
          },
          {
            id: `workspace-hook:${entry.slug}:${hookState.trust === 'trusted' ? 'review' : 'trust'}`,
            label: hookState.trust === 'trusted' ? 'Marcar review' : 'Marcar trusted',
            command: `/plugins ${hookState.trust === 'trusted' ? 'review' : 'trust'} workspace-hook:${entry.slug}`,
            kind: 'trust',
          },
        ],
        details: [
          `Workspace: ${entry.workspace}`,
          `Hooks: ${entry.hookCount}`,
          ...hooks.slice(0, 4).map((hook) => `${hook.event}: ${hook.command}`),
        ],
      });
    }

    return entries;
  }

  private buildWorkspaceCapabilities(entry: WorkspaceExtensionEntry): string[] {
    const capabilities: string[] = [];
    if (entry.commandCount > 0) {
      capabilities.push('workspace-commands');
    }
    if (entry.hookCount > 0) {
      capabilities.push('workspace-hooks');
    }
    if (entry.instructionFile) {
      capabilities.push('workspace-guidance');
    }
    return capabilities;
  }

  private resolveSelectedEntry(
    entries: ZavorthPluginEntry[],
    selectedId: string,
    query: string,
  ): ZavorthPluginEntry | null {
    if (entries.length === 0) {
      return null;
    }

    if (selectedId) {
      return entries.find((entry) => this.normalizeSearchValue(entry.id) === selectedId) || null;
    }

    if (query) {
      const exact = entries.find((entry) => this.normalizeSearchValue(entry.id) === query);
      if (exact) {
        return exact;
      }
    }

    return entries.find((entry) => ['installed', 'workspace'].includes(entry.installState))
      || entries.find((entry) => entry.trust === 'trusted')
      || entries[0]
      || null;
  }

  private buildFeaturedIds(entries: ZavorthPluginEntry[]): string[] {
    const preferred = ['openrouter', 'external-executor', 'AIGateway', 'workspace:repo'];
    const prioritized = [
      ...entries.filter((entry) => entry.featured),
      ...entries.filter((entry) => preferred.includes(entry.id)),
      ...entries.filter((entry) => ['installed', 'workspace'].includes(entry.installState)),
      ...entries,
    ];
    return Array.from(new Set(prioritized.map((entry) => entry.id))).slice(0, 8);
  }

  private renderEntryLines(entry: ZavorthPluginEntry): string[] {
    return [
      `${entry.label}`,
      '',
      entry.summary,
      '',
      `Kind: ${entry.kind}`,
      `Source: ${entry.source}`,
      `Readiness: ${entry.readiness}`,
      `Trust: ${entry.trust}`,
      `Install: ${entry.installState}`,
      `Action hint: ${entry.actionHint}`,
      ...(entry.actions.length > 0
        ? ['', 'Acoes:', ...entry.actions.slice(0, 5).map((action) => `- ${action.label}: ${action.command || 'manual'}`)]
        : []),
      ...(entry.details.length > 0 ? ['', 'Detalhes:', ...entry.details.map((detail) => `- ${detail}`)] : []),
    ];
  }

  private normalizeSearchText(values: Array<string | null | undefined>): string {
    return values
      .map((value) => this.normalizeSearchValue(value))
      .filter(Boolean)
      .join(' ');
  }

  private normalizeSearchValue(value: string | null | undefined): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizePluginCatalogId(value: string | null | undefined): string {
    return this.normalizeSearchValue(String(value || '').replace(/^plugin:/i, ''));
  }
}
