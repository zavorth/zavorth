import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthMutationPlan } from '../../../../contracts/ZavorthMutationPlaneContract.js';
import type { ZavorthWatchModeControlPlaneService } from '../../../../services/ZavorthWatchModeControlPlaneService.js';
import { ZavorthMutationPlaneService } from '../../../../services/ZavorthMutationPlaneService.js';
import type { ComputerUseWatchModePolicyFileService } from '../../../../services/ComputerUseWatchModePolicyFileService.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { TrustDecisionService } from '../../../../services/TrustDecisionService.js';

type WatchModeActionId = 'set-strict-default' | 'allow-app' | 'allow-site';

type SharedSurfaceWatchModeCommandPackDeps = {
  watchModeControlPlaneService: Pick<ZavorthWatchModeControlPlaneService, 'renderReport'>;
  watchModePolicyFileService: Pick<
    ComputerUseWatchModePolicyFileService,
    'setStrictApprovalDefault' | 'allowApp' | 'allowSite'
  >;
  permissionService?: PermissionService | null;
};

export class SharedSurfaceWatchModeCommandPack {
  constructor(private readonly deps: SharedSurfaceWatchModeCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    if (commandType !== '/watchmode') {
      return false;
    }

    await this.handleWatchMode(ctx, args);
    return true;
  }

  private async handleWatchMode(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();

    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open') {
      await ctx.reply(this.deps.watchModeControlPlaneService.renderReport());
      return;
    }

    const applyMatch = normalizedArgs.match(/^apply\s+(.+)$/i);
    if (applyMatch) {
      await ctx.reply(
        await this.applyWatchModePolicyMutationPlan(
          String(applyMatch[1] || '').trim(),
          String(ctx.userId || '').trim() || null,
        ),
      );
      return;
    }

    if (lower === 'strict on' || lower === 'strict true') {
      this.deps.watchModePolicyFileService.setStrictApprovalDefault(true);
      await ctx.reply(`Policy do Watch Mode atualizada.\n\n${this.deps.watchModeControlPlaneService.renderReport()}`);
      return;
    }

    if (lower === 'strict off' || lower === 'strict false') {
      await ctx.reply(
        await this.createWatchModePolicyMutationPreview(ctx, 'set-strict-default', {
          strictApproval: false,
        }),
      );
      return;
    }

    if (lower.startsWith('allow-app ')) {
      const app = normalizedArgs.slice('allow-app '.length).trim();
      if (!app) {
        await ctx.reply('Uso: /watchmode allow-app <janela>');
        return;
      }
      await ctx.reply(
        await this.createWatchModePolicyMutationPreview(ctx, 'allow-app', {
          app,
        }),
      );
      return;
    }

    if (lower.startsWith('allow-site ')) {
      const site = normalizedArgs.slice('allow-site '.length).trim();
      if (!site) {
        await ctx.reply('Uso: /watchmode allow-site <host>');
        return;
      }
      await ctx.reply(
        await this.createWatchModePolicyMutationPreview(ctx, 'allow-site', {
          site,
        }),
      );
      return;
    }

    await ctx.reply(
      'Uso: /watchmode [status|apply <planId>|strict on|strict off|allow-app <janela>|allow-site <host>]',
    );
  }

  private async createWatchModePolicyMutationPreview(
    ctx: IMessageContext,
    actionId: WatchModeActionId,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const mutationPlane = new ZavorthMutationPlaneService();
    const requestedBy = String(ctx.userId || '').trim() || 'operator';
    const title = this.buildWatchModePolicyMutationTitle(actionId, payload);
    const summary = 'Ajuste de policy do Watch Mode aumenta poder visual/mutavel e precisa de approval antes do apply.';
    const plan = mutationPlane.createPlan({
      domain: 'watch',
      actionId,
      title,
      summary,
      requestedBy,
      sourceSurface: ctx.platform,
      riskLevel: 'medium',
      approvalRequired: true,
      approvalReason: summary,
      resourceImpact: {
        ramMb: 0,
        diskMb: 1,
        processCount: 0,
        externalExposure: 'local',
        recurring: false,
        notes: ['Preview de policy; nenhum watcher ou sidecar e iniciado.'],
      },
      retentionPolicy: {
        ttlMs: 24 * 60 * 60 * 1000,
        maxBytes: 1024 * 1024,
        cleanupOnSuccess: true,
        cleanupOnBoot: true,
        notes: ['Plano efemero de Watch Mode, removivel apos apply ou expiracao.'],
      },
      validationPlan: [
        'Validar payload salvo no Mutation Plane.',
        'Confirmar approval canonico antes de aplicar.',
        'Recarregar snapshot do Watch Mode apos apply.',
      ],
      rollbackPlan: ['Reverter manualmente a policy anterior a partir do historico/auditoria.'],
      payload,
    });
    const decision = await new TrustDecisionService({
      permissionService: this.deps.permissionService || undefined,
    }).evaluate({
      domain: 'watch',
      actionId,
      planId: plan.id,
      requestedBy,
      sourceSurface: ctx.platform,
      riskLevel: 'medium',
      approvalRequired: true,
      capabilityId: 'watch-mode',
      reason: summary,
      payload,
      resourceImpact: plan.resourceImpact,
    });
    const persistedPlan = decision.permission
      ? mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;

    if (decision.decision === 'blocked') {
      const blocked = mutationPlane.markBlocked(persistedPlan.id, decision.reason);
      return this.formatWatchModePolicyMutationReply(blocked, decision.reason, true);
    }

    return this.formatWatchModePolicyMutationReply(persistedPlan, decision.reason, false);
  }

  private async applyWatchModePolicyMutationPlan(planId: string, requestedBy: string | null): Promise<string> {
    const mutationPlane = new ZavorthMutationPlaneService();
    let plan = mutationPlane.readPlan(planId);
    if (!plan || plan.domain !== 'watch') {
      throw new Error(`Plano de Watch Mode nao encontrado: ${planId || 'n/d'}.`);
    }
    if (!['set-strict-default', 'allow-app', 'allow-site'].includes(plan.actionId)) {
      throw new Error('Este plano de Watch Mode precisa ser aplicado pela rota runtime dedicada.');
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permissionService = this.deps.permissionService || new PermissionService();
      const permission = plan.approval.permissionId
        ? await permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      }
      if (permission?.status === 'rejected') {
        const blocked = mutationPlane.markBlocked(plan.id, 'Approval rejeitado no Permission Plane.');
        return this.formatWatchModePolicyMutationReply(blocked, 'Approval rejeitado no Permission Plane.', true);
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      return this.formatWatchModePolicyMutationReply(plan, 'Plano ainda aguarda approval.', false);
    }

    if (plan.actionId === 'set-strict-default') {
      const strictApproval = plan.payload.strictApproval === true;
      this.deps.watchModePolicyFileService.setStrictApprovalDefault(strictApproval);
    } else if (plan.actionId === 'allow-app') {
      const app = String(plan.payload.app || '').trim();
      if (!app) {
        throw new Error('Plano de allow-app sem janela valida.');
      }
      this.deps.watchModePolicyFileService.allowApp(app);
    } else if (plan.actionId === 'allow-site') {
      const site = String(plan.payload.site || '').trim();
      if (!site) {
        throw new Error('Plano de allow-site sem host valido.');
      }
      this.deps.watchModePolicyFileService.allowSite(site);
    }

    const applied = mutationPlane.markApplied(plan.id, 'Policy do Watch Mode aplicada por plan aprovado.', [plan.actionId]);
    return [
      'Watch Mode aplicado',
      '',
      `Plano: ${applied.id}.`,
      'A policy foi alterada exatamente do payload salvo.',
      '',
      this.deps.watchModeControlPlaneService.renderReport(),
    ].join('\n');
  }

  private buildWatchModePolicyMutationTitle(actionId: WatchModeActionId, payload: Record<string, unknown>): string {
    if (actionId === 'set-strict-default') {
      return `Watch Mode strict approval -> ${payload.strictApproval === true ? 'on' : 'off'}`;
    }
    if (actionId === 'allow-app') {
      return `Watch Mode allow-app ${String(payload.app || '').trim() || 'n/d'}`;
    }
    return `Watch Mode allow-site ${String(payload.site || '').trim() || 'n/d'}`;
  }

  private formatWatchModePolicyMutationReply(plan: ZavorthMutationPlan, reason: string, blocked: boolean): string {
    const lines = [
      blocked ? 'Watch Mode bloqueado' : 'Watch Mode em preview',
      '',
      plan.title,
      reason,
      '',
      `Plano: ${plan.id} (${plan.status}).`,
      plan.approval.permissionId ? `Approval: ${plan.approval.permissionId}.` : 'Approval: pendente.',
    ];
    if (!blocked) {
      lines.push(`Aplicar depois de aprovado: /watchmode apply ${plan.id}`);
    }
    return lines.join('\n');
  }
}
