import type {
  ZavorthPluginEntry,
  ZavorthPluginRegistrySnapshot,
} from './ZavorthPluginRegistryService.js';
import { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import { IntegrationHubService } from './IntegrationHubService.js';
import { IntegrationInstallerService } from './IntegrationInstallerService.js';
import { PluginStateService } from './PluginStateService.js';
import { ToolHookPipelineService } from './ToolHookPipelineService.js';

type ZavorthPluginActionRuntime = {
  now?: () => Date;
  defaultWorkspace?: string | null;
  pluginRegistryService?: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  pluginStateService?: PluginStateService;
  integrationHubService?: Pick<IntegrationHubService, 'buildDraft'>;
  integrationInstallerService?: Pick<IntegrationInstallerService, 'removeInstalled'>;
  hookPipelineService?: Pick<ToolHookPipelineService, 'run'>;
};

export type ZavorthPluginActionExecution = {
  generatedAt: string;
  pluginId: string;
  actionId: 'inspect' | 'open' | 'doctor' | 'trust' | 'review' | 'install' | 'update' | 'remove';
  status: 'applied' | 'noop' | 'manual' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  selected: ZavorthPluginEntry | null;
  snapshot: ZavorthPluginRegistrySnapshot;
};

export class ZavorthPluginActionService {
  private readonly now: () => Date;
  private readonly defaultWorkspace: string | null;
  private readonly pluginRegistry: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  private readonly pluginState: PluginStateService;
  private readonly integrationHub: Pick<IntegrationHubService, 'buildDraft'>;
  private readonly integrationInstaller: Pick<IntegrationInstallerService, 'removeInstalled'>;
  private readonly hookPipeline: Pick<ToolHookPipelineService, 'run'>;

  constructor(runtime: ZavorthPluginActionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultWorkspace = this.normalizeWorkspace(runtime.defaultWorkspace);
    this.pluginRegistry = runtime.pluginRegistryService || new ZavorthPluginRegistryService();
    this.pluginState = runtime.pluginStateService || new PluginStateService();
    this.integrationHub = runtime.integrationHubService || new IntegrationHubService();
    this.integrationInstaller = runtime.integrationInstallerService || new IntegrationInstallerService();
    this.hookPipeline = runtime.hookPipelineService || new ToolHookPipelineService();
  }

  public async execute(input: {
    pluginId: string;
    actionId: string;
    requestedBy?: string | null;
    workspace?: string | null;
  }): Promise<ZavorthPluginActionExecution> {
    const pluginId = this.normalizePluginId(input.pluginId);
    const actionId = this.normalizeActionId(input.actionId);
    const workspace = this.normalizeWorkspace(input.workspace);
    if (!pluginId) {
      throw new Error('pluginId obrigatorio.');
    }
    if (!actionId) {
      throw new Error('actionId obrigatorio.');
    }

    const selected = this.pluginRegistry.buildSnapshot({ selectedId: pluginId }).selected;
    if (!selected) {
      throw new Error(`Plugin nao encontrado: ${pluginId}.`);
    }

    const requestedBy = String(input.requestedBy || '').trim() || null;
    const before = await this.hookPipeline.run({
      event: 'plugin.before_action',
      workspace,
      context: {
        pluginId,
        actionId,
        requestedBy,
      },
    });
    if (!before.ok) {
      return this.finish(actionId, selected, 'blocked', 'Um hook bloqueou a acao do plugin plane.', [
        'Revise o hook de workspace associado a plugin.before_action.',
      ]);
    }

    let result: ZavorthPluginActionExecution;
    switch (actionId) {
      case 'inspect':
        result = this.finish(actionId, selected, 'manual', 'Inspecao pronta.', [
          selected.summary,
          selected.actionHint,
        ]);
        break;
      case 'open':
        result = this.executeOpen(selected);
        break;
      case 'doctor':
        result = this.executeDoctor(selected);
        break;
      case 'trust':
        this.pluginState.upsertState({
          pluginId: selected.id,
          installed: ['installed', 'workspace'].includes(selected.installState),
          trust: 'trusted',
          installedRevision: selected.version || null,
        });
        result = this.finish(actionId, selected, 'applied', `${selected.label} marcado como trusted.`, [
          'O item agora entra no plano com trust explicito.',
          'Nenhum segredo nem runtime remoto foram alterados.',
        ]);
        break;
      case 'review':
        this.pluginState.upsertState({
          pluginId: selected.id,
          installed: ['installed', 'workspace'].includes(selected.installState),
          trust: 'review',
          installedRevision: selected.version || null,
        });
        result = this.finish(actionId, selected, 'applied', `${selected.label} voltou para review.`, [
          'O item continua visivel no registry.',
          'O trust explicito foi rebaixado para revisao.',
        ]);
        break;
      case 'install':
        result = this.executeInstall(selected, requestedBy);
        break;
      case 'update':
        result = this.executeUpdate(selected, requestedBy);
        break;
      case 'remove':
        result = this.executeRemove(selected);
        break;
      default:
        throw new Error(`Acao de plugin desconhecida: ${actionId}.`);
    }

    await this.hookPipeline.run({
      event: 'plugin.after_action',
      workspace,
      context: {
        pluginId,
        actionId,
        status: result.status,
        ok: result.ok,
        requestedBy,
      },
    });

    return result;
  }

  private executeInstall(
    selected: ZavorthPluginEntry,
    requestedBy: string | null,
  ): ZavorthPluginActionExecution {
    if (!this.isIntegrationEntry(selected)) {
      return this.finish('install', selected, 'manual', 'Esse item nao precisa de instalacao automatica.', [
        'Workspace packs ja nascem do ZAVORTH.md ou do perfil local.',
        'Use a inspecao do workspace para aprofundar os comandos e hooks expostos.',
      ]);
    }

    this.integrationHub.buildDraft({
      requestedId: selected.id,
      requestedBy,
      persist: true,
    });

    return this.finish('install', selected, 'applied', `${selected.label} registrado no plugin plane.`, [
      'O Integration Hub abriu ou atualizou o draft desta integracao.',
      'Se ainda faltar onboarding, o proximo passo continua sendo /connect ou o fluxo web.',
    ]);
  }

  private executeUpdate(
    selected: ZavorthPluginEntry,
    requestedBy: string | null,
  ): ZavorthPluginActionExecution {
    if (!this.isIntegrationEntry(selected)) {
      return this.finish('update', selected, 'manual', 'Esse item nao possui update automatico neste plane.', [
        'Workspace packs refletem o estado atual do workspace automaticamente.',
        'Se o ZAVORTH.md mudar, o registry se recompõe sozinho na proxima leitura.',
      ]);
    }

    this.integrationHub.buildDraft({
      requestedId: selected.id,
      requestedBy,
      persist: true,
    });

    this.pluginState.upsertState({
      pluginId: selected.id,
      installed: true,
      trust: selected.trust === 'trusted' ? 'trusted' : 'review',
      installedRevision: selected.version || null,
    });

    return this.finish('update', selected, 'applied', `${selected.label} reconciliado no plugin plane.`, [
      'O draft do Integration Hub foi regravado com o estado mais novo.',
      'O registry local agora reapresenta a revisao mais recente deste item.',
    ]);
  }

  private executeRemove(selected: ZavorthPluginEntry): ZavorthPluginActionExecution {
    const details: string[] = [];
    if (this.isIntegrationEntry(selected)) {
      const removed = this.integrationInstaller.removeInstalled(selected.id, { removeSecrets: false });
      details.push(
        removed
          ? 'O draft do Integration Hub foi removido; segredos guardados continuam preservados.'
          : 'Nao havia draft persistido no Integration Hub para remover.',
      );
    }

    const cleared = this.pluginState.clearState(selected.id);
    details.push(
      cleared
        ? 'Overrides locais de trust/install foram esquecidos neste plane.'
        : 'Nao havia override local adicional para esse item.',
    );

    if (!this.isIntegrationEntry(selected)) {
      details.push('Workspace packs continuam visiveis porque nascem do ZAVORTH.md, nao do state local.');
    }

    return this.finish('remove', selected, 'applied', `${selected.label} removido do cadastro local do plugin plane.`, details);
  }

  private executeDoctor(selected: ZavorthPluginEntry): ZavorthPluginActionExecution {
    return this.finish('doctor', selected, 'manual', `Doctor de ${selected.label} pronto.`, [
      `Readiness: ${selected.readiness}`,
      `Trust: ${selected.trust}`,
      `Install: ${selected.installState}`,
      `Proximo passo: ${selected.actionHint || 'n/d'}`,
      ...selected.details.slice(0, 4),
    ]);
  }

  private executeOpen(selected: ZavorthPluginEntry): ZavorthPluginActionExecution {
    return this.finish('open', selected, 'manual', `${selected.label}: proximo passo pronto.`, [
      `Atalho recomendado: ${selected.actionHint || 'n/d'}`,
      selected.summary,
      ...selected.details.slice(0, 4),
    ]);
  }

  private finish(
    actionId: ZavorthPluginActionExecution['actionId'],
    selected: ZavorthPluginEntry,
    status: ZavorthPluginActionExecution['status'],
    summary: string,
    details: string[],
  ): ZavorthPluginActionExecution {
    const snapshot = this.pluginRegistry.buildSnapshot({ selectedId: selected.id });
    return {
      generatedAt: this.now().toISOString(),
      pluginId: selected.id,
      actionId,
      status,
      ok: status !== 'blocked',
      summary,
      details,
      selected: snapshot.selected,
      snapshot,
    };
  }

  private isIntegrationEntry(entry: ZavorthPluginEntry): boolean {
    return entry.source === 'integration-hub';
  }

  private normalizePluginId(value: string | null | undefined): string {
    return String(value || '').trim();
  }

  private normalizeActionId(value: string | null | undefined): ZavorthPluginActionExecution['actionId'] | '' {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .split(':')
      .pop() || '';
    const aliased = normalized === 'next' ? 'open' : normalized;
    switch (aliased) {
      case 'inspect':
      case 'open':
      case 'doctor':
      case 'trust':
      case 'review':
      case 'install':
      case 'update':
      case 'remove':
        return aliased;
      default:
        return '';
    }
  }

  private normalizeWorkspace(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
    return this.defaultWorkspace || process.cwd();
  }
}
