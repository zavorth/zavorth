import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { DashboardService } from '../../services/DashboardService.js';
import { RemoteModeManager } from '../../services/RemoteModeManager.js';
import type { RemoteModeCommand } from '../../services/RemoteModeManager.js';
import { RuntimeAccessManifestService } from '../../runtime/access/RuntimeAccessManifestService.js';
import { RuntimeBootstrapService } from '../../runtime/access/RuntimeBootstrapService.js';
import {
  RuntimeOfficialRemoteAccessService,
  type RuntimeOfficialRemoteAccessReport,
  type RuntimeOfficialRemoteRolloutCandidateId,
} from '../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import { SidecarStatusService } from '../../services/SidecarStatusService.js';
import { AutoRepairService } from '../../services/AutoRepairService.js';
import { SupervisedRuntimeService } from '../../services/SupervisedRuntimeService.js';
import { WslControlResult, WslControlService } from '../../services/WslControlService.js';
import {
  buildRuntimeSurfaceResponse,
  mapBooleanReceiptStatus,
  type SurfaceReceiptStatus,
} from '../../domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../TelegramSurfaceResponseSender.js';

export type TelegramOpsRuntimeMaintenanceCommand = {
  action: 'changes' | 'reload' | 'autorepair';
  force: boolean;
  dryRun: boolean;
  improve: boolean;
};

export type TelegramOpsRuntimeCommandServiceDeps = {
  dashboardService: DashboardService;
  remoteModeManager: RemoteModeManager;
  wslControl: WslControlService;
  supervisedRuntimeService: SupervisedRuntimeService;
  autoRepairService: AutoRepairService;
  runtimeAccessManifestService?: RuntimeAccessManifestService;
  runtimeBootstrapService?: RuntimeBootstrapService;
  runtimeOfficialRemoteAccessService?: Pick<RuntimeOfficialRemoteAccessService, 'inspect' | 'runAction'>;
};

export class TelegramOpsRuntimeCommandService {
  private readonly sidecarStatus = new SidecarStatusService();
  private readonly runtimeAccessManifestService: RuntimeAccessManifestService;
  private readonly runtimeBootstrapService: RuntimeBootstrapService;
  private readonly runtimeOfficialRemoteAccessService: Pick<RuntimeOfficialRemoteAccessService, 'inspect' | 'runAction'>;

  constructor(private readonly deps: TelegramOpsRuntimeCommandServiceDeps) {
    this.runtimeAccessManifestService =
      deps.runtimeAccessManifestService || new RuntimeAccessManifestService();
    this.runtimeBootstrapService =
      deps.runtimeBootstrapService || new RuntimeBootstrapService();
    this.runtimeOfficialRemoteAccessService =
      deps.runtimeOfficialRemoteAccessService || new RuntimeOfficialRemoteAccessService();
  }

  public parseRemoteModeCommand(rawText: string): RemoteModeCommand | null {
    const normalized = rawText
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (
      normalized === 'ativar modo remoto' ||
      normalized === 'ativar o modo remoto' ||
      normalized === 'ligar modo remoto' ||
      normalized === 'ligar o modo remoto' ||
      normalized === '/remote on' ||
      normalized === '/remote activate' ||
      normalized === '/remote ativar' ||
      normalized === '/remoto on' ||
      normalized === '/remoto ativar'
    ) {
      return 'activate';
    }

    if (
      normalized === 'desativar modo remoto' ||
      normalized === 'desativar o modo remoto' ||
      normalized === 'desligar modo remoto' ||
      normalized === 'desligar o modo remoto' ||
      normalized === '/remote off' ||
      normalized === '/remote deactivate' ||
      normalized === '/remote desativar' ||
      normalized === '/remoto off' ||
      normalized === '/remoto desativar'
    ) {
      return 'restore';
    }

    if (
      normalized === 'status do modo remoto' ||
      normalized === 'ver modo remoto' ||
      normalized === '/remote' ||
      normalized === '/remote status' ||
      normalized === '/remoto' ||
      normalized === '/remoto status'
    ) {
      return 'status';
    }

    return null;
  }

  public parseRuntimeMaintenanceCommand(
    rawText: string,
  ): TelegramOpsRuntimeMaintenanceCommand | null {
    const normalized = String(rawText || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    if (!normalized || normalized.startsWith('/')) {
      return null;
    }

    if (
      /^(resuma|mostre|me diga|quais sao)( as)? (ultimas|ultimas) (alteracoes|mudancas)/i.test(
        normalized,
      ) ||
      normalized.includes('resumo das ultimas alteracoes') ||
      normalized.includes('resumo das ultimas mudancas')
    ) {
      return { action: 'changes', force: false, dryRun: false, improve: false };
    }

    if (
      normalized.includes('se autoatualize') ||
      normalized.includes('se atualize') ||
      normalized.includes('atualize o zavorth') ||
      normalized.includes('recarregue o zavorth') ||
      normalized.includes('reinicie o zavorth') ||
      normalized.includes('suba o zavorth com as mudancas') ||
      normalized.includes('religue o zavorth')
    ) {
      return {
        action: 'reload',
        force: /(force|forcar|forcado|mesmo que ja esteja rodando)/i.test(normalized),
        dryRun: false,
        improve: false,
      };
    }

    if (
      normalized.includes('se autorepare') ||
      normalized.includes('se conserte') ||
      normalized.includes('tente se corrigir') ||
      normalized.includes('corrija o zavorth') ||
      normalized.includes('faca autoreparo') ||
      normalized.includes('faÃ§a autoreparo') ||
      normalized.includes('se melhore') ||
      normalized.includes('melhore o zavorth') ||
      normalized.includes('se otimize') ||
      normalized.includes('otimize o zavorth')
    ) {
      return {
        action: 'autorepair',
        force: /(force|forcar|forcado|mesmo sem erro)/i.test(normalized),
        dryRun: /(simule|dry run|dryrun|planeje|mostre o plano)/i.test(normalized),
        improve: /(melhore|otimize)/i.test(normalized),
      };
    }

    return null;
  }

  public async handleChanges(ctx: Context): Promise<void> {
    const summary = this.deps.supervisedRuntimeService.summarizeRecentChanges();
    await this.replyRuntimeSurface(ctx, {
      id: 'telegram-runtime-changes',
      title: 'Mudancas do Zavorth',
      summary: firstSurfaceLine(summary) || 'Resumo de mudancas recentes.',
      text: summary,
      status: 'done',
      metadata: {
        source: 'telegram',
      },
    });
  }

  public async handleAccess(ctx: Context, args: string): Promise<void> {
    const manifest = await this.runtimeAccessManifestService.buildManifest();
    const [mode = '', remoteAction = '', providerRaw = ''] = String(args || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (mode === 'local') {
      await ctx.reply(
        [
          'Acesso local do Zavorth',
          '',
          `Status: ${manifest.local.ready ? 'pronto' : 'pendente'}.`,
          `App: ${manifest.local.appUrl}`,
          `Dashboard legado: ${manifest.local.dashboardUrl}`,
          `API web: ${manifest.local.apiBaseUrl}`,
          '',
          ...manifest.guides.local.slice(0, 4).map((line) => `- ${line}`),
        ].join('\n'),
      );
      return;
    }

    if (mode === 'remote' || mode === 'remoto') {
      const normalizedRemoteAction = this.normalizeOfficialRemoteAction(remoteAction);
      const provider = this.normalizeOfficialRemoteProvider(providerRaw);
      const report = normalizedRemoteAction
        ? await this.runtimeOfficialRemoteAccessService.runAction(normalizedRemoteAction, {
            provider,
            autoTrustLocal: true,
          })
        : await this.runtimeOfficialRemoteAccessService.inspect();
      await ctx.reply(this.formatOfficialRemoteAccessReply(report, normalizedRemoteAction, manifest));
      return;
    }

    await ctx.reply(
      [
        'Manifesto de acesso do Zavorth',
        '',
        manifest.summary,
        '',
        `Local: ${manifest.local.appUrl} (${manifest.local.ready ? 'pronto' : 'pendente'})`,
        `Remoto: ${manifest.remote.appUrl || 'nao configurado'} (${manifest.remote.ready ? 'pronto' : 'pendente'})`,
        `Host autorizado: ${manifest.auth.authorizedHost === false ? 'nao' : 'sim'}`,
        '',
        `Install: ${manifest.commands.install}`,
        `Bootstrap: ${manifest.commands.bootstrap}`,
        `Access: ${manifest.commands.access}`,
        `Manifest: ${manifest.commands.manifest}`,
        `Trust: ${manifest.commands.trust}`,
      ].join('\n'),
    );
  }

  private normalizeOfficialRemoteAction(value: string): 'apply' | 'verify' | 'rollback' | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'apply' || normalized === 'aplicar') {
      return 'apply';
    }
    if (normalized === 'verify' || normalized === 'verificar') {
      return 'verify';
    }
    if (normalized === 'rollback' || normalized === 'limpar' || normalized === 'reset') {
      return 'rollback';
    }
    return null;
  }

  private normalizeOfficialRemoteProvider(value: string): RuntimeOfficialRemoteRolloutCandidateId | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'local-cloudflare' || normalized === 'oracle-cloudflare') {
      return normalized;
    }
    return null;
  }

  private formatOfficialRemoteAccessReply(
    report: RuntimeOfficialRemoteAccessReport,
    action: 'apply' | 'verify' | 'rollback' | null,
    manifest: Awaited<ReturnType<RuntimeAccessManifestService['buildManifest']>>,
  ): string {
    const activeCandidate = report.rollout.activeId
      ? report.rollout.candidates.find((candidate) => candidate.id === report.rollout.activeId) || null
      : null;
    const recommendedCandidate = report.actions.recommendedProvider
      ? report.rollout.candidates.find((candidate) => candidate.id === report.actions.recommendedProvider) || null
      : null;
    const remoteIssues = report.remote.issues.slice(0, 3);
    const nextSteps = report.nextSteps.slice(0, 3);
    const actionLabels = {
      apply: 'Wizard oficial aplicado.',
      verify: 'Wizard oficial verificado.',
      rollback: 'Wizard oficial limpo.',
    } as const;

    return [
      'Acesso remoto oficial do Zavorth',
      '',
      action ? actionLabels[action] : report.summary,
      action ? report.summary : null,
      '',
      `Status: ${report.remote.ready ? 'pronto' : 'pendente'}.`,
      `URL publica: ${report.remote.baseUrl || 'nao configurada'}`,
      `App remoto: ${report.remote.appUrl || 'nao configurado'}`,
      `Caminho ativo: ${activeCandidate ? `${activeCandidate.label} (${activeCandidate.id})` : 'nenhum aplicado'}`,
      `Caminho recomendado: ${recommendedCandidate ? `${recommendedCandidate.label} (${recommendedCandidate.id})` : 'caminho oficial direto'}`,
      `Proxima acao sugerida: ${report.actions.recommendedAction || 'nenhuma'}`,
      '',
      ...(remoteIssues.length > 0
        ? [
            'Pendencias principais:',
            ...remoteIssues.map((issue) => `- ${issue}`),
            '',
          ]
        : []),
      ...(nextSteps.length > 0
        ? [
            'Proximos passos:',
            ...nextSteps.map((step) => `- ${step}`),
            '',
          ]
        : []),
      'Comandos uteis:',
      `- iniciar: ${manifest.commands.start}`,
      `- verificar acesso: ${manifest.commands.access}`,
      `- rollout remoto: ${manifest.commands.remote}`,
      `- manifesto: ${manifest.commands.manifest}`,
      `- autorizar host: ${manifest.commands.trust}`,
      '',
      'Acoes no Telegram:',
      '- /access remote',
      '- /access remote apply [local-cloudflare|oracle-cloudflare]',
      '- /access remote verify [local-cloudflare|oracle-cloudflare]',
      '- /access remote rollback',
    ].filter(Boolean).join('\n');
  }

  public async handleBootstrap(ctx: Context): Promise<void> {
    const report = await this.runtimeBootstrapService.inspectLive();
    const nextActions = report.actions.slice(0, 5);

    await ctx.reply(
      [
        'Bootstrap operacional do Zavorth',
        '',
        report.summary,
        '',
        `.env: ${report.env.envFilePresent ? 'ok' : 'ausente'} | provider=${report.env.llmProvider} | credencial=${report.env.llmCredentialReady ? 'ok' : 'pendente'}`,
        `Dependencias: ${report.dependencies.installRequired ? 'npm install pendente' : 'ok'} | build=${report.dependencies.buildRequired ? 'pendente' : 'ok'}`,
        `Local: ${report.supervisedRuntime.accessReadiness.local.ready ? 'pronto' : 'pendente'} | remoto: ${report.supervisedRuntime.accessReadiness.remote.ready ? 'pronto' : 'pendente'}`,
        '',
        ...(nextActions.length > 0
          ? [
              'Passos recomendados:',
              ...nextActions.map((action) => `- ${action.title}: ${action.command}`),
            ]
          : ['Nenhum passo pendente. O bootstrap esta fechado.']),
      ].join('\n'),
    );
  }

  public async handleSelfUpdate(ctx: Context, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();

    if (normalized === 'status' || normalized === 'summary' || normalized === 'changes' || normalized === 'resumo') {
      await this.handleChanges(ctx);
      return;
    }

    if (normalized === 'help' || normalized === 'ajuda') {
      await ctx.reply(
        'Use /reload para reiniciar o Zavorth quando quiser, /autorepair para ele se ajustar sozinho e /changes para ver o resumo das mudancas.',
      );
      return;
    }

    const force = ['force', 'forcar', 'forcado', 'reload'].includes(normalized);
    const userId = ctx.from?.id?.toString() || 'unknown';
    const chatId = ctx.chat?.id?.toString() || '';
    const result = await this.deps.supervisedRuntimeService.requestReload({
      reason: force
        ? 'Reload supervisionado forcado via Telegram.'
        : 'Reload supervisionado solicitado via Telegram.',
      requestedBy: userId,
      notifyChatId: chatId,
      forceRestart: force,
    });

    await this.replyRuntimeSurface(ctx, {
      id: `telegram-runtime-reload-${result.requestId || 'request'}`,
      title: result.accepted ? 'Reload supervisionado aceito' : 'Reload supervisionado nao aplicado',
      summary: result.summary,
      text: result.summary,
      status: result.accepted ? 'done' : 'blocked',
      reason: result.summary,
      metadata: {
        requestId: result.requestId || null,
        force,
      },
    });
  }

  public async handleAutoRepair(ctx: Context, args: string): Promise<void> {
    const normalized = String(args || '').trim().toLowerCase();

    if (normalized === 'status' || normalized === 'summary' || normalized === 'resumo' || normalized === 'last') {
      const summary = this.deps.autoRepairService.summarizeLastRun();
      await this.replyRuntimeSurface(ctx, {
        id: 'telegram-autorepair-status',
        title: 'Autoreparo do Zavorth',
        summary: firstSurfaceLine(summary) || 'Ultimo estado do autoreparo.',
        text: summary,
        status: 'done',
      });
      return;
    }

    if (normalized === 'help' || normalized === 'ajuda') {
      await ctx.reply(
        'Use /autorepair para o ciclo completo automatico, /autorepair status para ver o ultimo relatorio, /reload para reiniciar manualmente e /changes para ver as mudancas.',
      );
      return;
    }

    const dryRun = ['dryrun', 'dry-run', 'plan', 'plano', 'simular', 'simule'].includes(normalized);
    const improve = ['improve', 'improvar', 'melhorar', 'melhore', 'otimizar', 'otimize'].includes(normalized);
    const force = ['force', 'forcar', 'forcado', 'now', 'agora', 'repair', 'reparar'].includes(normalized) || improve;
    const userId = ctx.from?.id?.toString() || 'unknown';
    const chatId = ctx.chat?.id?.toString() || '';

    await ctx.reply(
      dryRun
        ? 'Montando um plano seguro de autoreparo agora.'
        : improve
          ? 'Iniciando autoreparo com foco em melhoria segura e validada.'
          : 'Iniciando autoreparo completo do Zavorth agora.',
    );

    const result = await this.deps.autoRepairService.run({
      reason: improve
        ? 'Melhoria segura do Zavorth solicitada via Telegram.'
        : dryRun
          ? 'Planejamento de autoreparo solicitado via Telegram.'
          : 'Autoreparo solicitado via Telegram.',
      requestedBy: userId,
      notifyChatId: chatId,
      dryRun,
      force,
      goal: improve ? 'improve' : force ? 'repair' : 'auto',
    });

    await this.replyRuntimeSurface(ctx, {
      id: `telegram-autorepair-${result.status || 'run'}`,
      title: 'Autoreparo concluido',
      summary: result.summary,
      text: result.summary,
      status: mapBooleanReceiptStatus(result.success),
      reason: result.summary,
      metadata: {
        dryRun,
        force,
        goal: improve ? 'improve' : force ? 'repair' : 'auto',
        status: result.status,
      },
    });
  }

  public async handleRemoteMode(ctx: Context, mode: RemoteModeCommand): Promise<void> {
    try {
      const result =
        mode === 'activate'
          ? await this.deps.remoteModeManager.activate()
          : mode === 'restore'
            ? await this.deps.remoteModeManager.restore()
            : await this.deps.remoteModeManager.status();

      await ctx.reply(this.formatRemoteModeReply(result, mode));
    } catch (error: any) {
      await ctx.reply(`Nao consegui ajustar o modo remoto agora.\n\nMotivo: ${error.message}`);
    }
  }

  public formatRemoteModeReply(result: any, mode: string): string {
    const lines: string[] = [];

    if (mode === 'activate') {
      lines.push('Modo remoto ativado.', 'Agora o notebook fica mais preparado para o Zavorth operar de longe.');
    } else if (mode === 'restore') {
      lines.push('Modo remoto desativado.', 'As configuracoes principais do notebook foram restauradas.');
    } else {
      lines.push(result.active ? 'O modo remoto esta ativo.' : 'O modo remoto esta inativo.');
    }

    if (result.message) {
      lines.push(result.message);
    }

    if (result.appliedAt) {
      lines.push(`Ultima alteracao: ${result.appliedAt}`);
    }

    if (result.warnings?.length) {
      lines.push(`Avisos: ${result.warnings.join(' | ')}`);
    }

    return lines.join('\n');
  }

  public async handleDashboard(ctx: Context): Promise<void> {
    try {
      await this.deps.dashboardService.start();
      const url = this.deps.dashboardService.getUrl();
      const publicUrl =
        typeof (this.deps.dashboardService as any).getPublicBaseUrl === 'function'
          ? this.deps.dashboardService.getPublicBaseUrl()
          : null;
      const lines = [
        '**Zavorth Dashboard Online**',
        '',
        'Main web gateway on the host machine:',
        `${url}/dashboard`,
      ];

      if (publicUrl) {
        lines.push('', 'URL publica configurada:', publicUrl);
      }

      const sidecars = this.sidecarStatus.readSummary();
      if (sidecars.AIGateway.running || sidecars.AIGateway.ready) {
        lines.push('', 'Gateway AIGateway:', sidecars.AIGateway.baseUrl || config.AIGatewayBaseUrl);
      }

      if (sidecars.ZavorthTerminal.running || sidecars.ZavorthTerminal.ready) {
        lines.push(
          '',
          'ZavorthBridge remoto para celular:',
          sidecars.ZavorthTerminal.localUrl ||
            sidecars.ZavorthTerminal.baseUrl ||
            config.ZavorthTerminalBaseUrl,
        );
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (error: any) {
      await ctx.reply(`Falha ao iniciar Dashboard: ${error.message}`);
    }
  }

  public async handleWslCommand(ctx: Context, args: string): Promise<void> {
    try {
      const trimmedArgs = String(args || '').trim();
      const [rawAction = '', ...rest] = trimmedArgs.split(/\s+/).filter(Boolean);
      const action = rawAction.toLowerCase();
      const requestedDistro = rest.join(' ').trim() || undefined;

      if (action === 'on' || action === 'start') {
        await ctx.reply(requestedDistro ? `Iniciando WSL na distro ${requestedDistro}...` : 'Iniciando WSL...');
        const result = await this.deps.wslControl.start(requestedDistro);
        await this.replyWslSurface(ctx, result);
        return;
      }

      if (action === 'off' || action === 'shutdown' || action === 'stop') {
        await ctx.reply('Desligando WSL e liberando RAM...');
        const result = await this.deps.wslControl.shutdown();
        await this.replyWslSurface(ctx, result);
        return;
      }

      const result = await this.deps.wslControl.status();
      await this.replyWslSurface(ctx, result);
    } catch (error: any) {
      await ctx.reply(`Erro ao acessar WSL: ${error.message}`);
    }
  }

  public formatWslReply(result: WslControlResult): string {
    const lines = [result.message];
    const distros = Array.isArray(result.distros) ? result.distros : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];

    if (distros.length > 0) {
      lines.push('', 'Distros:');
      for (const distro of distros) {
        const marker = distro.isDefault ? ' (padrao)' : '';
        const stateEmoji = distro.state.toLowerCase() === 'running' ? 'RUN' : 'STOP';
        lines.push(`${stateEmoji} ${distro.name}${marker} - WSL${distro.version} - ${distro.state}`);
      }
    }

    if (warnings.length > 0) {
      lines.push('', `Avisos: ${warnings.join(' | ')}`);
    }

    lines.push('', 'Use /wsl on para ligar ou /wsl off para desligar.');
    return lines.join('\n');
  }

  private async replyWslSurface(ctx: Context, result: WslControlResult): Promise<void> {
    await this.replyRuntimeSurface(ctx, {
      id: `telegram-wsl-${result.action || 'status'}`,
      title: 'WSL',
      summary: result.message,
      text: this.formatWslReply(result),
      status: result.ok ? 'done' : 'failed',
      reason: result.message,
      metadata: {
        action: result.action,
        distroCount: Array.isArray(result.distros) ? result.distros.length : 0,
        warningCount: Array.isArray(result.warnings) ? result.warnings.length : 0,
      },
    });
  }

  private async replyRuntimeSurface(
    ctx: Context,
    input: {
      id: string;
      title: string;
      summary: string;
      text: string;
      status: SurfaceReceiptStatus;
      reason?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      buildRuntimeSurfaceResponse({
        ...input,
        policyProfile: 'telegram-runtime-maintenance',
      }),
    );
  }
}

function firstSurfaceLine(value: string): string {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}
