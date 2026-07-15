import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { AutoRepairService } from '../../../../services/AutoRepairService.js';
import type { SupervisedRuntimeService } from '../../../../services/SupervisedRuntimeService.js';
import {
  buildRuntimeSurfaceResponse,
  mapBooleanReceiptStatus,
  renderPlainSurfaceResponse,
  type SurfaceReceiptStatus,
} from '../../application/surface-response/index.js';

export type RuntimeMaintenanceIntent = {
  action: 'changes' | 'reload' | 'autorepair';
  force: boolean;
  dryRun: boolean;
  improve: boolean;
};

type SharedSurfaceRuntimeMaintenanceCommandPackDeps = {
  supervisedRuntimeService: Pick<SupervisedRuntimeService, 'summarizeRecentChanges' | 'requestReload'>;
  autoRepairService: Pick<AutoRepairService, 'summarizeLastRun' | 'run'>;
  renderHelp: (ctx: IMessageContext) => string;
};

export class SharedSurfaceRuntimeMaintenanceCommandPack {
  constructor(private readonly deps: SharedSurfaceRuntimeMaintenanceCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/changes':
        await this.handleChanges(ctx);
        return true;
      case '/selfupdate':
      case '/reload':
        await this.handleReload(ctx, args);
        return true;
      case '/autorepair':
        await this.handleAutoRepair(ctx, args);
        return true;
      default:
        return false;
    }
  }

  public async handleRuntimeMaintenanceIntent(ctx: IMessageContext, intent: RuntimeMaintenanceIntent): Promise<void> {
    if (intent.action === 'changes') {
      await this.handleChanges(ctx);
      return;
    }

    if (intent.action === 'reload') {
      await this.handleReload(ctx, intent.force ? 'force' : '');
      return;
    }

    const args = [
      intent.dryRun ? 'dryrun' : '',
      intent.improve ? 'improve' : '',
      !intent.dryRun && !intent.improve && intent.force ? 'force' : '',
    ]
      .filter(Boolean)
      .join(' ');
    await this.handleAutoRepair(ctx, args);
  }

  private async handleChanges(ctx: IMessageContext): Promise<void> {
    const summary = this.deps.supervisedRuntimeService.summarizeRecentChanges();
    await this.replyRuntimeSurface(ctx, {
      id: 'shared-runtime-changes',
      title: 'Zavorth changes',
      summary: firstSurfaceLine(summary) || 'Recent changes summary.',
      text: summary,
      status: 'done',
      metadata: {
        platform: ctx.platform,
      },
    });
  }

  private async handleReload(ctx: IMessageContext, args: string): Promise<void> {
    const normalized = String(args || '')
      .trim()
      .toLowerCase();

    if (normalized === 'status' || normalized === 'summary' || normalized === 'changes' || normalized === 'resumo') {
      await this.handleChanges(ctx);
      return;
    }

    if (normalized === 'help' || normalized === 'ajuda') {
      await ctx.reply(this.deps.renderHelp(ctx));
      return;
    }

    const force = ['force', 'forcar', 'forcado', 'reload'].includes(normalized);
    const result = await this.deps.supervisedRuntimeService.requestReload({
      reason: force
        ? `Reload supervisionado forcado via ${ctx.platform}.`
        : `Reload supervisionado solicitado via ${ctx.platform}.`,
      requestedBy: String(ctx.userId || 'unknown').trim() || 'unknown',
      notifyChatId: ctx.platform === 'telegram' ? String(ctx.chatId || '').trim() || null : null,
      forceRestart: force,
    });

    await this.replyRuntimeSurface(ctx, {
      id: `shared-runtime-reload-${result.requestId || 'request'}`,
      title: result.accepted ? 'Reload supervisionado aceito' : 'Reload supervisionado nao aplicado',
      summary: result.summary,
      text: result.summary,
      status: result.accepted ? 'done' : 'blocked',
      reason: result.summary,
      metadata: {
        requestId: result.requestId || null,
        force,
        platform: ctx.platform,
      },
    });
  }

  private async handleAutoRepair(ctx: IMessageContext, args: string): Promise<void> {
    const normalized = String(args || '')
      .trim()
      .toLowerCase();

    if (normalized === 'status' || normalized === 'summary' || normalized === 'resumo' || normalized === 'last') {
      const summary = this.deps.autoRepairService.summarizeLastRun();
      await this.replyRuntimeSurface(ctx, {
        id: 'shared-autorepair-status',
        title: 'Zavorth autorepair',
        summary: firstSurfaceLine(summary) || 'Last autorepair state.',
        text: summary,
        status: 'done',
        metadata: {
          platform: ctx.platform,
        },
      });
      return;
    }

    if (normalized === 'help' || normalized === 'ajuda') {
      await ctx.reply(this.deps.renderHelp(ctx));
      return;
    }

    const dryRun = ['dryrun', 'dry-run', 'plan', 'plano', 'simular', 'simule'].includes(normalized);
    const improve = ['improve', 'improvar', 'melhorar', 'melhore', 'otimizar', 'otimize'].includes(normalized);
    const force = ['force', 'forcar', 'forcado', 'now', 'agora', 'repair', 'reparar'].includes(normalized) || improve;

    await ctx.reply(
      dryRun
        ? 'Building a safe autorepair plan right now.'
        : improve
          ? 'Starting autorepair focused on safe, validated improvement.'
          : 'Starting full Zavorth autorepair right now.',
    );

    const result = await this.deps.autoRepairService.run({
      reason: improve
        ? `Safe Zavorth improvement requested via ${ctx.platform}.`
        : dryRun
          ? `Autorepair planning requested via ${ctx.platform}.`
          : `Autorepair requested via ${ctx.platform}.`,
      requestedBy: String(ctx.userId || 'unknown').trim() || 'unknown',
      notifyChatId: ctx.platform === 'telegram' ? String(ctx.chatId || '').trim() || null : null,
      dryRun,
      force,
      goal: improve ? 'improve' : force ? 'repair' : 'auto',
    });

    await this.replyRuntimeSurface(ctx, {
      id: `shared-autorepair-${result.status || 'run'}`,
      title: 'Autorepair completed',
      summary: result.summary,
      text: result.summary,
      status: mapBooleanReceiptStatus(result.success),
      reason: result.summary,
      metadata: {
        dryRun,
        force,
        goal: improve ? 'improve' : force ? 'repair' : 'auto',
        platform: ctx.platform,
        status: result.status,
      },
    });
  }

  private async replyRuntimeSurface(
    ctx: IMessageContext,
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
    const rendered = renderPlainSurfaceResponse(
      buildRuntimeSurfaceResponse({
        ...input,
        policyProfile: 'shared-runtime-maintenance',
      }),
    );
    await ctx.reply(rendered.text);
  }
}

function firstSurfaceLine(value: string): string {
  return (
    String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || ''
  );
}
