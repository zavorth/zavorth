import { AutomaticBrowserDoctorService } from '../mcp/AutomaticBrowserDoctorService.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { ZavorthPluginActionService } from './ZavorthPluginActionService.js';
import { ZavorthPlatformActionService } from './ZavorthPlatformActionService.js';
import { ZavorthPlatformCatalogSyncService } from './ZavorthPlatformCatalogSyncService.js';
import {
  ZavorthHubControlPlaneService,
  type ZavorthHubControlPlaneAction,
  type ZavorthHubControlPlaneQuery,
  type ZavorthHubControlPlaneSnapshot,
} from './ZavorthHubControlPlaneService.js';

type HubActionRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  hubControlPlaneService?: Pick<ZavorthHubControlPlaneService, 'buildSnapshot'>;
  integrationHubService?: Pick<IntegrationHubService, 'buildDraft'>;
  pluginActionService?: Pick<ZavorthPluginActionService, 'execute'>;
  platformActionService?: Pick<ZavorthPlatformActionService, 'execute'>;
  platformCatalogSyncService?: Pick<ZavorthPlatformCatalogSyncService, 'sync'>;
  mcpBrowserDoctorService?: Pick<AutomaticBrowserDoctorService, 'run'>;
};

export type ZavorthHubActionExecution = {
  generatedAt: string;
  actionId: string;
  status: 'completed' | 'manual' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  action: ZavorthHubControlPlaneAction | null;
  hub: ZavorthHubControlPlaneSnapshot;
  result: unknown;
};

export class ZavorthHubActionService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string | null;
  private readonly hubControlPlaneService: Pick<ZavorthHubControlPlaneService, 'buildSnapshot'>;
  private readonly integrationHubService: Pick<IntegrationHubService, 'buildDraft'>;
  private readonly pluginActionService: Pick<ZavorthPluginActionService, 'execute'>;
  private readonly platformActionService: Pick<ZavorthPlatformActionService, 'execute'>;
  private readonly platformCatalogSyncService: Pick<ZavorthPlatformCatalogSyncService, 'sync'>;
  private readonly mcpBrowserDoctorService: Pick<AutomaticBrowserDoctorService, 'run'> | null;

  constructor(runtime: HubActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = this.normalizeText(runtime.workspaceRoot) || process.cwd();
    this.hubControlPlaneService = runtime.hubControlPlaneService || new ZavorthHubControlPlaneService();
    this.integrationHubService = runtime.integrationHubService || new IntegrationHubService();
    this.pluginActionService = runtime.pluginActionService || new ZavorthPluginActionService();
    this.platformActionService = runtime.platformActionService || new ZavorthPlatformActionService();
    this.platformCatalogSyncService = runtime.platformCatalogSyncService || new ZavorthPlatformCatalogSyncService();
    this.mcpBrowserDoctorService = runtime.mcpBrowserDoctorService || null;
  }

  public async execute(input: {
    actionId: string;
    requestedBy?: string | null;
    workspace?: string | null;
    selectedId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }): Promise<ZavorthHubActionExecution> {
    const actionId = this.normalizeActionId(input.actionId);
    if (!actionId) {
      throw new Error('actionId required.');
    }

    const requestedBy = this.normalizeText(input.requestedBy);
    const workspace = this.normalizeText(input.workspace) || this.workspaceRoot;
    const before = this.hubControlPlaneService.buildSnapshot(this.buildQuery(input));
    const action = this.resolveAction(before, actionId);
    if (!action) {
      throw new Error(`Hub action not found: ${actionId}.`);
    }

    let status: ZavorthHubActionExecution['status'] = 'completed';
    let summary = action.label;
    let details: string[] = [];
    let result: unknown = null;
    let nextSelectedId = this.resolveSelectedIdFromAction(action) || this.normalizeText(input.selectedId);

    if (action.id === 'platform-sync') {
      const sync = await this.platformCatalogSyncService.sync();
      result = sync;
      status = sync.ok ? 'completed' : 'blocked';
      summary = sync.ok ? 'Remote registry synced by Hub.' : 'Failed to sync the remote registry by Hub.';
      details = [
        sync.summary,
        `Status: ${sync.status}.`,
        `Entries: ${sync.entryCount} | collections: ${sync.collectionCount} | recipes: ${sync.recipeCount}.`,
      ];
      if (sync.error) {
        details.push(`error: ${sync.error}`);
      }
    } else if (action.id === 'mcp-browser-doctor') {
      if (!this.mcpBrowserDoctorService) {
        status = 'blocked';
        summary = 'MCP doctor is unavailable in this runtime.';
        details = [
          'MCP browser doctor was not connected on this surface.',
          'Use the runtime with MCP browser doctor enabled before repeating this action.',
        ];
      } else {
        const doctor = await this.mcpBrowserDoctorService.run();
        result = doctor;
        status = doctor.ok ? 'completed' : 'blocked';
        summary = doctor.ok ? 'MCP doctor executed by the Hub.' : 'MCP doctor found pending items in the runtime.';
        details = [
          `Modulo: ${doctor.moduleName || 'n/d'}.`,
          `Launchable: ${doctor.launchable ? 'yes' : 'no'}.`,
          ...(Array.isArray(doctor.recommendations) ? doctor.recommendations.slice(0, 4) : []),
        ];
        if (doctor.error) {
          details.push(`error: ${doctor.error}`);
        }
      }
    } else if (action.surface === 'integrations') {
      const integrationId = this.resolveActionTarget(action.id, 'integration:');
      const draft = this.integrationHubService.buildDraft({
        requestedId: integrationId,
        requestedBy,
        persist: true,
      });
      result = draft;
      status = 'completed';
      summary = `${draft.manifest.label} prepared pelo Hub.`;
      details = [
        draft.resolution.note,
        `Modo: ${draft.selectedMode}.`,
        `Capabilities: ${draft.enabledCapabilities.join(', ') || 'none'}.`,
        draft.unansweredQuestions.length > 0
          ? `${draft.unansweredQuestions.length} question(s) still need answers.`
          : 'No blocking question remained pending in this pass.',
      ];
      nextSelectedId = integrationId;
    } else if (action.surface === 'plugins') {
      const pluginId = this.resolveActionTarget(action.id, 'plugin:');
      const execution = await this.pluginActionService.execute({
        pluginId,
        actionId: this.mapActionKindToLifecycle(action.kind),
        requestedBy,
        workspace,
      });
      result = execution;
      status = execution.ok ? 'completed' : 'blocked';
      summary = execution.summary;
      details = execution.details.slice(0, 6);
      nextSelectedId = pluginId;
    } else if (action.surface === 'platform' && action.id.startsWith('platform:')) {
      const entryId = this.resolveActionTarget(action.id, 'platform:');
      const execution = await this.platformActionService.execute({
        entryId,
        actionId: this.mapActionKindToLifecycle(action.kind),
        requestedBy,
        workspace,
      });
      result = execution;
      status = execution.ok ? 'completed' : 'blocked';
      summary = execution.summary;
      details = execution.details.slice(0, 6);
      nextSelectedId = entryId;
    } else if (action.surface === 'skills') {
      status = 'manual';
      summary = `${action.label}: trilha guiada ready.`;
      details = [
        action.rationale,
        action.command ? `shortcut sugerido: ${action.command}` : 'Use a biblioteca de skills para seguir.',
      ];
    } else {
      status = 'manual';
      summary = `${action.label}: action guiada ready.`;
      details = [
        action.rationale,
        action.command ? `shortcut sugerido: ${action.command}` : 'Revise o recorte current do Hub para seguir.',
      ];
    }

    const hub = this.hubControlPlaneService.buildSnapshot({
      selectedId: nextSelectedId || null,
      query: this.normalizeText(input.query),
      recommendFor: this.normalizeText(input.recommendFor),
    });

    return {
      generatedAt: this.now().toISOString(),
      actionId: action.id,
      status,
      ok: status !== 'blocked',
      summary,
      details,
      action,
      hub,
      result,
    };
  }

  private buildQuery(input: {
    selectedId?: string | null;
    query?: string | null;
    recommendFor?: string | null;
  }): ZavorthHubControlPlaneQuery {
    return {
      selectedId: this.normalizeText(input.selectedId),
      query: this.normalizeText(input.query),
      recommendFor: this.normalizeText(input.recommendFor),
    };
  }

  private resolveAction(
    snapshot: ZavorthHubControlPlaneSnapshot,
    actionId: string,
  ): ZavorthHubControlPlaneAction | null {
    const normalized = this.normalizeActionId(actionId);
    const action = snapshot.actions.find((entry) => this.normalizeActionId(entry.id) === normalized) || null;
    if (action) {
      return action;
    }
    if (normalized === 'platform-sync') {
      return {
        id: 'platform-sync',
        label: 'Sincronizar registry remote',
        surface: 'platform',
        kind: 'sync',
        rationale: snapshot.sync.summary,
        command: '/hub run platform-sync',
      };
    }
    if (normalized === 'mcp-browser-doctor' || normalized === 'mcp-doctor' || normalized === 'doctor') {
      return {
        id: 'mcp-browser-doctor',
        label: 'run doctor MCP',
        surface: 'mcp',
        kind: 'doctor',
        rationale: 'Check that the MCP manifest and live runtime remain coherent.',
        command: '/hub run mcp-browser-doctor',
      };
    }
    return null;
  }

  private resolveSelectedIdFromAction(action: ZavorthHubControlPlaneAction): string | null {
    if (action.id.startsWith('integration:')) {
      return this.resolveActionTarget(action.id, 'integration:');
    }
    if (action.id.startsWith('plugin:')) {
      return this.resolveActionTarget(action.id, 'plugin:');
    }
    if (action.id.startsWith('platform:')) {
      return this.resolveActionTarget(action.id, 'platform:');
    }
    return null;
  }

  private resolveActionTarget(actionId: string, prefix: string): string {
    return String(actionId.slice(prefix.length) || '').trim();
  }

  private mapActionKindToLifecycle(
    kind: ZavorthHubControlPlaneAction['kind'],
  ): 'inspect' | 'open' | 'doctor' | 'trust' | 'review' | 'install' | 'update' | 'remove' {
    switch (kind) {
      case 'inspect':
      case 'open':
      case 'doctor':
      case 'trust':
      case 'install':
        return kind;
      case 'sync':
        return 'update';
      default:
        return 'open';
    }
  }

  private normalizeActionId(value: string | null | undefined): string {
    return this.normalizeText(value)?.toLowerCase() || '';
  }

  private normalizeText(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
  }
}
