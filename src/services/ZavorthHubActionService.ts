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
      throw new Error('actionId obrigatorio.');
    }

    const requestedBy = this.normalizeText(input.requestedBy);
    const workspace = this.normalizeText(input.workspace) || this.workspaceRoot;
    const before = this.hubControlPlaneService.buildSnapshot(this.buildQuery(input));
    const action = this.resolveAction(before, actionId);
    if (!action) {
      throw new Error(`Acao do hub nao encontrada: ${actionId}.`);
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
      summary = sync.ok ? 'Registry remoto sincronizado pelo Hub.' : 'Falha ao sincronizar o registry remoto pelo Hub.';
      details = [
        sync.summary,
        `Status: ${sync.status}.`,
        `Entradas: ${sync.entryCount} | colecoes: ${sync.collectionCount} | recipes: ${sync.recipeCount}.`,
      ];
      if (sync.error) {
        details.push(`Erro: ${sync.error}`);
      }
    } else if (action.id === 'mcp-browser-doctor') {
      if (!this.mcpBrowserDoctorService) {
        status = 'blocked';
        summary = 'Doctor MCP indisponivel neste runtime.';
        details = [
          'O browser doctor do MCP nao foi ligado nesta surface.',
          'Use o runtime com MCP browser doctor habilitado antes de repetir esta acao.',
        ];
      } else {
        const doctor = await this.mcpBrowserDoctorService.run();
        result = doctor;
        status = doctor.ok ? 'completed' : 'blocked';
        summary = doctor.ok ? 'Doctor MCP executado pelo Hub.' : 'Doctor MCP encontrou pendencias no runtime.';
        details = [
          `Modulo: ${doctor.moduleName || 'n/d'}.`,
          `Launchable: ${doctor.launchable ? 'sim' : 'nao'}.`,
          ...(Array.isArray(doctor.recommendations) ? doctor.recommendations.slice(0, 4) : []),
        ];
        if (doctor.error) {
          details.push(`Erro: ${doctor.error}`);
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
      summary = `${draft.manifest.label} preparado pelo Hub.`;
      details = [
        draft.resolution.note,
        `Modo: ${draft.selectedMode}.`,
        `Capacidades: ${draft.enabledCapabilities.join(', ') || 'nenhuma'}.`,
        draft.unansweredQuestions.length > 0
          ? `${draft.unansweredQuestions.length} pergunta(s) ainda precisam ser respondidas.`
          : 'Nenhuma pergunta bloqueante ficou pendente nesta passada.',
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
      summary = `${action.label}: trilha guiada pronta.`;
      details = [
        action.rationale,
        action.command ? `Atalho sugerido: ${action.command}` : 'Use a biblioteca de skills para seguir.',
      ];
    } else {
      status = 'manual';
      summary = `${action.label}: acao guiada pronta.`;
      details = [
        action.rationale,
        action.command ? `Atalho sugerido: ${action.command}` : 'Revise o recorte atual do Hub para seguir.',
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
        label: 'Sincronizar registry remoto',
        surface: 'platform',
        kind: 'sync',
        rationale: snapshot.sync.summary,
        command: '/hub run platform-sync',
      };
    }
    if (normalized === 'mcp-browser-doctor' || normalized === 'mcp-doctor' || normalized === 'doctor') {
      return {
        id: 'mcp-browser-doctor',
        label: 'Rodar doctor MCP',
        surface: 'mcp',
        kind: 'doctor',
        rationale: 'Verifique se o manifesto MCP e o runtime vivo continuam coerentes.',
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
