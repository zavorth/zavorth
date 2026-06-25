import { Context } from 'grammy';
import { config } from '@zavorth/config/index.js';
import { t, getNluPatterns } from '../../../../gateways/channels/telegram/i18n.js';
import { DashboardService } from '@zavorth/services/DashboardService.js';
import { RemoteModeManager } from '@zavorth/services/RemoteModeManager.js';
import type { RemoteModeCommand } from '@zavorth/services/RemoteModeManager.js';
import { RuntimeAccessManifestService } from '@zavorth/runtime/access/RuntimeAccessManifestService.js';
import { RuntimeBootstrapService } from '@zavorth/runtime/access/RuntimeBootstrapService.js';
import {
  RuntimeOfficialRemoteAccessService,
  type RuntimeOfficialRemoteAccessReport,
  type RuntimeOfficialRemoteRolloutCandidateId,
} from '@zavorth/runtime/access/RuntimeOfficialRemoteAccessService.js';
import { SidecarStatusService } from '@zavorth/services/SidecarStatusService.js';
import { AutoRepairService } from '@zavorth/services/AutoRepairService.js';
import { SupervisedRuntimeService } from '@zavorth/services/SupervisedRuntimeService.js';
import { WslControlResult, WslControlService } from '@zavorth/services/WslControlService.js';
import {
  buildRuntimeSurfaceResponse,
  mapBooleanReceiptStatus,
  type SurfaceReceiptStatus,
} from '@zavorth/domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

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

    const patterns = getNluPatterns();

    if (patterns.remoteActivate.test(normalized)) {
      return 'activate';
    }

    if (patterns.remoteDeactivate.test(normalized)) {
      return 'restore';
    }

    if (patterns.remoteStatus.test(normalized)) {
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

    const patterns = getNluPatterns();

    if (patterns.changesSummary.test(normalized)) {
      return { action: 'changes', force: false, dryRun: false, improve: false };
    }

    if (patterns.reload.test(normalized)) {
      return {
        action: 'reload',
        force: /(force|forcar|forcado|mesmo que ja esteja rodando|even if already running)/i.test(normalized),
        dryRun: false,
        improve: false,
      };
    }

    if (patterns.autorepair.test(normalized)) {
      return {
        action: 'autorepair',
        force: /(force|forcar|forcado|mesmo sem erro)/i.test(normalized),
        dryRun: /(simule|dry run|dryrun|planeje|mostre o plano)/i.test(normalized),
        improve: /(melhore|otimize|improve)/i.test(normalized),
      };
    }

    return null;
  }

  public async handleChanges(ctx: Context): Promise<void> {
    const summary = this.deps.supervisedRuntimeService.summarizeRecentChanges();
    await this.replyRuntimeSurface(ctx, {
      id: 'telegram-runtime-changes',
      title: 'Zavorth Changes',
      summary: firstSurfaceLine(summary) || 'Summary of recent changes.',
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
          'Zavorth Local Access',
          '',
          `Status: ${manifest.local.ready ? 'ready' : 'pending'}.`,
          `App: ${manifest.local.appUrl}`,
          `Legacy dashboard: ${manifest.local.dashboardUrl}`,
          `Web API: ${manifest.local.apiBaseUrl}`,
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
        'Zavorth Access Manifest',
        '',
        manifest.summary,
        '',
        `Local: ${manifest.local.appUrl} (${manifest.local.ready ? 'ready' : 'pending'})`,
        `Remote: ${manifest.remote.appUrl || 'not configured'} (${manifest.remote.ready ? 'ready' : 'pending'})`,
        `Host authorized: ${manifest.auth.authorizedHost === false ? 'no' : 'yes'}`,
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
      'Zavorth Official Remote Access',
      '',
      action ? actionLabels[action] : report.summary,
      action ? report.summary : null,
      '',
      `Status: ${report.remote.ready ? 'ready' : 'pending'}.`,
      `Public URL: ${report.remote.baseUrl || 'not configured'}`,
      `Remote app: ${report.remote.appUrl || 'not configured'}`,
      `Active route: ${activeCandidate ? `${activeCandidate.label} (${activeCandidate.id})` : 'none applied'}`,
      `Recommended route: ${recommendedCandidate ? `${recommendedCandidate.label} (${recommendedCandidate.id})` : 'direct official route'}`,
      `Suggested next action: ${report.actions.recommendedAction || 'none'}`,
      '',
      ...(remoteIssues.length > 0
        ? [
            'Main pending items:',
            ...remoteIssues.map((issue) => `- ${issue}`),
            '',
          ]
        : []),
      ...(nextSteps.length > 0
        ? [
            'Next steps:',
            ...nextSteps.map((step) => `- ${step}`),
            '',
          ]
        : []),
      'Useful commands:',
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
        'Zavorth Operational Bootstrap',
        '',
        report.summary,
        '',
        `.env: ${report.env.envFilePresent ? 'ok' : 'missing'} | provider=${report.env.llmProvider} | credential=${report.env.llmCredentialReady ? 'ok' : 'pending'}`,
        `Dependencies: ${report.dependencies.installRequired ? 'npm install pending' : 'ok'} | build=${report.dependencies.buildRequired ? 'pending' : 'ok'}`,
        `Local: ${report.supervisedRuntime.accessReadiness.local.ready ? 'ready' : 'pending'} | remote: ${report.supervisedRuntime.accessReadiness.remote.ready ? 'ready' : 'pending'}`,
        '',
        ...(nextActions.length > 0
          ? [
              'Recommended steps:',
              ...nextActions.map((action) => `- ${action.title}: ${action.command}`),
            ]
          : ['No pending steps. Bootstrap is complete.']),
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
        'Use /reload to restart Zavorth when needed, /autorepair for it to self-adjust, and /changes to see the changes summary.',
      );
      return;
    }

    const force = ['force', 'forcar', 'forcado', 'reload'].includes(normalized);
    const userId = ctx.from?.id?.toString() || 'unknown';
    const chatId = ctx.chat?.id?.toString() || '';
    const result = await this.deps.supervisedRuntimeService.requestReload({
      reason: force
        ? 'Forced supervised reload via Telegram.'
        : 'Supervised reload requested via Telegram.',
      requestedBy: userId,
      notifyChatId: chatId,
      forceRestart: force,
    });

    await this.replyRuntimeSurface(ctx, {
      id: `telegram-runtime-reload-${result.requestId || 'request'}`,
      title: result.accepted ? 'Supervised reload accepted' : 'Supervised reload not applied',
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
        title: 'Zavorth Autorepair',
        summary: firstSurfaceLine(summary) || 'Latest autorepair status.',
        text: summary,
        status: 'done',
      });
      return;
    }

    if (normalized === 'help' || normalized === 'ajuda') {
      await ctx.reply(
        'Use /autorepair for the full automatic cycle, /autorepair status to see the latest report, /reload to restart manually, and /changes to see the changes.',
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
        ? 'Preparing a safe autorepair plan now.'
        : improve
          ? 'Starting autorepair with focus on safe and validated improvement.'
          : 'Starting full Zavorth autorepair now.',
    );

    const result = await this.deps.autoRepairService.run({
      reason: improve
        ? 'Safe Zavorth improvement requested via Telegram.'
        : dryRun
          ? 'Autorepair planning requested via Telegram.'
          : 'Autorepair requested via Telegram.',
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
    } catch (error: unknown) {
      await ctx.reply(`Nao consegui ajustar o modo remoto agora.\n\nMotivo: ${error.message}`);
    }
  }

  public formatRemoteModeReply(result: unknown, mode: string): string {
    const lines: string[] = [];

    if (mode === 'activate') {
      lines.push('Remote mode activated.', 'Now the notebook is more prepared for Zavorth to operate remotely.');
    } else if (mode === 'restore') {
      lines.push('Remote mode deactivated.', 'Main notebook settings have been restored.');
    } else {
      lines.push(result.active ? 'Remote mode is active.' : 'Remote mode is inactive.');
    }

    if (result.message) {
      lines.push(result.message);
    }

    if (result.appliedAt) {
      lines.push(`Last change: ${result.appliedAt}`);
    }

    if (result.warnings?.length) {
      lines.push(`Warnings: ${result.warnings.join(' | ')}`);
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
        lines.push('', 'Public URL configured:', publicUrl);
      }

      const sidecars = this.sidecarStatus.readSummary();
      if (sidecars.AIGateway.running || sidecars.AIGateway.ready) {
        lines.push('', 'Gateway AIGateway:', sidecars.AIGateway.baseUrl || config.AIGatewayBaseUrl);
      }

      if (sidecars.ZavorthTerminal.running || sidecars.ZavorthTerminal.ready) {
        lines.push(
          '',
          'Remote ZavorthBridge for mobile:',
          sidecars.ZavorthTerminal.localUrl ||
            sidecars.ZavorthTerminal.baseUrl ||
            config.ZavorthTerminalBaseUrl,
        );
      }

      await ctx.reply(lines.join('\n'), { parse_mode: 'Markdown' });
    } catch (error: unknown) {
      await ctx.reply(`Failed to start Dashboard: ${error.message}`);
    }
  }

  public async handleWslCommand(ctx: Context, args: string): Promise<void> {
    try {
      const trimmedArgs = String(args || '').trim();
      const [rawAction = '', ...rest] = trimmedArgs.split(/\s+/).filter(Boolean);
      const action = rawAction.toLowerCase();
      const requestedDistro = rest.join(' ').trim() || undefined;

      if (action === 'on' || action === 'start') {
        await ctx.reply(requestedDistro ? `Starting WSL on distro ${requestedDistro}...` : 'Starting WSL...');
        const result = await this.deps.wslControl.start(requestedDistro);
        await this.replyWslSurface(ctx, result);
        return;
      }

      if (action === 'off' || action === 'shutdown' || action === 'stop') {
        await ctx.reply('Shutting down WSL and freeing RAM...');
        const result = await this.deps.wslControl.shutdown();
        await this.replyWslSurface(ctx, result);
        return;
      }

      const result = await this.deps.wslControl.status();
      await this.replyWslSurface(ctx, result);
    } catch (error: unknown) {
      await ctx.reply(`Error accessing WSL: ${error.message}`);
    }
  }

  public formatWslReply(result: WslControlResult): string {
    const lines = [result.message];
    const distros = Array.isArray(result.distros) ? result.distros : [];
    const warnings = Array.isArray(result.warnings) ? result.warnings : [];

    if (distros.length > 0) {
      lines.push('', 'Distros:');
      for (const distro of distros) {
        const marker = distro.isDefault ? ' (default)' : '';
        const stateEmoji = distro.state.toLowerCase() === 'running' ? 'RUN' : 'STOP';
        lines.push(`${stateEmoji} ${distro.name}${marker} - WSL${distro.version} - ${distro.state}`);
      }
    }

    if (warnings.length > 0) {
      lines.push('', `Warnings: ${warnings.join(' | ')}`);
    }

    lines.push('', 'Use /wsl on to start or /wsl off to stop.');
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
