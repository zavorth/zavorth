import type { CapabilityDefinition, CapabilityType } from '../contracts/CapabilityContract.js';
import type { IntegrationCatalogEntry } from '../contracts/IntegrationHubContract.js';
import { getDefaultCapabilityRegistry, type CapabilityRegistry } from '../capabilities/CapabilityRegistry.js';
import {
  ZavorthToolCatalogService,
  type ZavorthToolCatalogSnapshot,
} from './ZavorthToolCatalogService.js';
import { ZavorthSessionToolsService } from '../runtime/sessions/ZavorthSessionToolsService.js';

import { ZavorthHookPlaneService } from './ZavorthHookPlaneService.js';
import { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import { ZavorthTeamCatalogService } from './ZavorthTeamCatalogService.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { WorkspaceExtensionRegistryService } from './WorkspaceExtensionRegistryService.js';
import type { ToolCatalogService } from './tools/ToolCatalogService.js';

type CapabilityRegistryLike = Pick<CapabilityRegistry, 'getAll'>;

type ZavorthToolSurfaceRuntime = {
  now?: () => Date;
  capabilityRegistry?: CapabilityRegistryLike;
  integrationHubService?: Pick<IntegrationHubService, 'buildCatalogSnapshot' | 'listCatalogEntries'>;
  teamCatalogService?: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
  sessionToolsService?: ZavorthSessionToolsService;
  workspaceExtensions?: WorkspaceExtensionRegistryService;
  hookPlaneService?: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  pluginRegistryService?: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  toolCatalogService?: Pick<ZavorthToolCatalogService, 'buildSnapshot'>;
  runtimeToolCatalogService?: Pick<ToolCatalogService, 'listTools'>;
};

export type ZavorthToolFamilySnapshot = {
  id: string;
  label: string;
  status: 'ready' | 'partial' | 'planned';
  total: number;
  summary: string;
  examples: string[];
};

export type ZavorthToolSurfaceSnapshot = {
  generatedAt: string;
  summary: {
    families: number;
    ready: number;
    partial: number;
    planned: number;
    explicitTools: number;
  };
  families: ZavorthToolFamilySnapshot[];
  catalog: ZavorthToolCatalogSnapshot;
  narrative: {
    headline: string;
    operatorSummary: string;
  };
};

export class ZavorthToolSurfaceService {
  private readonly now: () => Date;
  private readonly capabilityRegistry: CapabilityRegistryLike;
  private readonly integrationHub: Pick<IntegrationHubService, 'buildCatalogSnapshot' | 'listCatalogEntries'>;
  private readonly teamCatalog: Pick<ZavorthTeamCatalogService, 'buildSnapshot'>;
  private readonly sessionTools: ZavorthSessionToolsService;
  private readonly workspaceExtensions: WorkspaceExtensionRegistryService;
  private readonly hookPlane: Pick<ZavorthHookPlaneService, 'buildSnapshot'>;
  private readonly pluginRegistry: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  private readonly toolCatalog: Pick<ZavorthToolCatalogService, 'buildSnapshot'>;

  constructor(runtime: ZavorthToolSurfaceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityRegistry = runtime.capabilityRegistry || getDefaultCapabilityRegistry();
    this.integrationHub = runtime.integrationHubService || new IntegrationHubService();
    this.teamCatalog = runtime.teamCatalogService || new ZavorthTeamCatalogService();
    this.sessionTools = runtime.sessionToolsService || new ZavorthSessionToolsService();
    this.workspaceExtensions = runtime.workspaceExtensions || new WorkspaceExtensionRegistryService();
    this.hookPlane = runtime.hookPlaneService || new ZavorthHookPlaneService({
      workspaceExtensions: this.workspaceExtensions,
    });
    this.pluginRegistry = runtime.pluginRegistryService || new ZavorthPluginRegistryService({
      integrationHubService: this.integrationHub,
      workspaceExtensions: this.workspaceExtensions,
    });
    this.toolCatalog = runtime.toolCatalogService || new ZavorthToolCatalogService({
      capabilityRegistry: this.capabilityRegistry,
      integrationHubService: this.integrationHub,
      sessionToolsService: this.sessionTools,
      teamCatalogService: this.teamCatalog,
      runtimeToolCatalogService: runtime.runtimeToolCatalogService || null,
    });
  }

  public buildSnapshot(input?: {
    sessionId?: string;
    chatId?: string;
    userId?: string;
    query?: string | null;
    selectedId?: string | null;
  }): ZavorthToolSurfaceSnapshot {
    const capabilities = this.capabilityRegistry.getAll();
    const capabilityGroups = this.groupByType(capabilities);
    const integrationSnapshot = this.integrationHub.buildCatalogSnapshot();
    const teamSnapshot = this.teamCatalog.buildSnapshot();
    const hookSnapshot = this.hookPlane.buildSnapshot();
    const pluginSnapshot = this.pluginRegistry.buildSnapshot();
    const workspaceSummary = this.workspaceExtensions.buildSummary();
    const mcpEntries = integrationSnapshot.entries.filter((entry) => this.isMcpEntry(entry));
    const sessionSnapshot =
      input?.sessionId && input.chatId && input.userId
        ? this.sessionTools.buildSnapshot({
            sessionId: input.sessionId,
            chatId: input.chatId,
            userId: input.userId,
          })
        : null;
    const catalog = this.toolCatalog.buildSnapshot({
      selectedId: input?.selectedId || null,
      query: input?.query || null,
      sessionId: input?.sessionId || null,
      chatId: input?.chatId || null,
      userId: input?.userId || null,
    });

    const families: ZavorthToolFamilySnapshot[] = [
      {
        id: 'session',
        label: 'Session tools',
        status: sessionSnapshot ? 'ready' : 'partial',
        total: sessionSnapshot?.tools.length || 4,
        summary: sessionSnapshot
          ? sessionSnapshot.narrative.operatorSummary
          : 'Listing, history, send, and session spawn are defined for the gateway.',
        examples: (sessionSnapshot?.tools || []).map((tool) => tool.id).slice(0, 4),
      },
      {
        id: 'task',
        label: 'Tasks and workflows',
        status: capabilityGroups.workflow.length + capabilityGroups.executor.length > 0 ? 'ready' : 'planned',
        total: capabilityGroups.workflow.length + capabilityGroups.executor.length,
        summary: 'Tools that open tasks, workflows, execution, and core automation.',
        examples: this.extractExamples([...capabilityGroups.executor, ...capabilityGroups.workflow]),
      },
      {
        id: 'team',
        label: 'Teams and subagents',
        status: teamSnapshot.summary.total > 0 ? 'ready' : 'planned',
        total: teamSnapshot.summary.total,
        summary: teamSnapshot.narrative.operatorSummary,
        examples: teamSnapshot.teams.slice(0, 4).map((team) => team.entryCommand || team.label),
      },
      {
        id: 'integration',
        label: 'Integrations and sidecars',
        status: integrationSnapshot.entries.length > 0 ? 'ready' : 'planned',
        total: integrationSnapshot.entries.length,
        summary: 'Connectors, templates, and Integration Hub doctors.',
        examples: integrationSnapshot.entries.slice(0, 4).map((entry) => entry.manifest.id),
      },
      {
        id: 'workspace',
        label: 'Workspace extensions',
        status: workspaceSummary.workspaces > 0 ? 'ready' : 'partial',
        total: workspaceSummary.commands + workspaceSummary.hooks,
        summary:
          workspaceSummary.workspaces > 0
            ? `${workspaceSummary.commands} command(s) and ${workspaceSummary.hooks} hook(s) loaded from ZAVORTH.md.`
            : 'No cached workspace profiles exist yet to expose ZAVORTH.md as a tool plan.',
        examples: this.workspaceExtensions.listEntries().slice(0, 3).map((entry) => entry.workspaceName),
      },
      {
        id: 'plugin',
        label: 'Plugins and skills',
        status: pluginSnapshot.summary.total > 0 ? 'ready' : 'partial',
        total: pluginSnapshot.summary.total,
        summary: pluginSnapshot.narrative.operatorSummary,
        examples: pluginSnapshot.entries.slice(0, 4).map((entry) => entry.label || entry.id),
      },
      {
        id: 'hooks',
        label: 'Hooks',
        status: hookSnapshot.summary.supportedEvents > 0 ? 'ready' : 'planned',
        total: hookSnapshot.summary.supportedEvents,
        summary: hookSnapshot.narrative.operatorSummary,
        examples: hookSnapshot.events.filter((event) => event.registeredHooks > 0).slice(0, 4).map((event) => event.id),
      },
      {
        id: 'search',
        label: 'Search e research',
        status: capabilityGroups.research.length > 0 ? 'ready' : 'partial',
        total: capabilityGroups.research.length,
        summary: 'Search, deep search, and investigation routes.',
        examples: this.extractExamples(capabilityGroups.research),
      },
      {
        id: 'schedule',
        label: 'Schedule e automation',
        status: capabilityGroups.automation.length > 0 ? 'ready' : 'partial',
        total: capabilityGroups.automation.length,
        summary: 'Agendamento, maintenance recorrente e automations operacionais.',
        examples: this.extractExamples(capabilityGroups.automation),
      },
      {
        id: 'mcp',
        label: 'MCP',
        status: 'partial',
        total: mcpEntries.length,
        summary: 'Explicit plan for MCP tools inside the Zavorth Gateway.',
        examples: mcpEntries.slice(0, 4).map((entry) => entry.manifest.id),
      },
      {
        id: 'lsp',
        label: 'LSP and IDE',
        status: 'planned',
        total: 0,
        summary: 'There is no first-class LSP plan yet, but the family is already visible in the tool plane.',
        examples: ['planned'],
      },
    ];

    const summary = {
      families: families.length,
      ready: families.filter((family) => family.status === 'ready').length,
      partial: families.filter((family) => family.status === 'partial').length,
      planned: families.filter((family) => family.status === 'planned').length,
      explicitTools: families.reduce((total, family) => total + family.total, 0),
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      families,
      catalog,
      narrative: {
        headline: `Zavorth exposes ${summary.families} tool families in the current plan.`,
        operatorSummary: `${summary.ready} ready family/families, ${summary.partial} partial, and ${summary.planned} planned.`,
      },
    };
  }

  private groupByType(capabilities: CapabilityDefinition[]): Record<CapabilityType, CapabilityDefinition[]> {
    return capabilities.reduce(
      (groups, capability) => {
        groups[capability.type].push(capability);
        return groups;
      },
      {
        executor: [] as CapabilityDefinition[],
        workflow: [] as CapabilityDefinition[],
        research: [] as CapabilityDefinition[],
        automation: [] as CapabilityDefinition[],
        integration: [] as CapabilityDefinition[],
      },
    );
  }

  private extractExamples(capabilities: CapabilityDefinition[]): string[] {
    return capabilities.slice(0, 4).map((capability) => capability.command?.command || capability.id);
  }

  private isMcpEntry(entry: IntegrationCatalogEntry): boolean {
    if (entry.manifest.modes.some((mode) => mode.id === 'mcp')) {
      return true;
    }

    return entry.manifest.binding.kind === 'service'
      && String(entry.manifest.binding.key || '').trim().toLowerCase().includes('mcp');
  }
}
