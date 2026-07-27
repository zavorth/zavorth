import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthMutationPlan } from '../../../../contracts/ZavorthMutationPlaneContract.js';
import type { ZavorthWatchModeControlPlaneService } from '../../../../services/ZavorthWatchModeControlPlaneService.js';
import { ZavorthMutationPlaneService } from '../../../../services/ZavorthMutationPlaneService.js';
import type { ComputerUseWatchModePolicyFileService } from '../../../../services/ComputerUseWatchModePolicyFileService.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { TrustDecisionService } from '../../../../services/TrustDecisionService.js';
import { tSurface } from '../../../../i18n/surface.js';
import { tService } from '../../../../i18n/services.js';

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
      await ctx.reply(`${tService('watchmode.policy_updated')}\n\n${this.deps.watchModeControlPlaneService.renderReport()}`);
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

    const allowAppMatch = normalizedArgs.match(
      /^(?:allow-app)(?:\s+(.+))...$/i,
    );
    if (allowAppMatch) {
      const app = String(allowAppMatch[1] || '').trim();
      if (!app) {
        await ctx.reply(
          [
            'Usage:',
            '  /watchmode allow-app <window-or-application>',

          ].join('\n'),
        );
        return;
      }
      await ctx.reply(
        await this.createWatchModePolicyMutationPreview(ctx, 'allow-app', {
          app,
        }),
      );
      return;
    }

    const allowSiteMatch = normalizedArgs.match(
      /^(?:allow-site)(?:\s+(.+))...$/i,
    );
    if (allowSiteMatch) {
      const site = String(allowSiteMatch[1] || '').trim();
      if (!site) {
        await ctx.reply(
          [
            'Usage:',
            '  /watchmode allow-site <host>',

          ].join('\n'),
        );
        return;
      }
      await ctx.reply(
        await this.createWatchModePolicyMutationPreview(ctx, 'allow-site', {
          site,
        }),
      );
      return;
    }

    // Free text primary: host-like → allow-site, otherwise window name → allow-app
    if (this.looksLikeWatchModeHost(normalizedArgs)) {
      await ctx.reply(
        await this.createWatchModePolicyMutationPreview(ctx, 'allow-site', {
          site: normalizedArgs,
        }),
      );
      return;
    }

    await ctx.reply(
      await this.createWatchModePolicyMutationPreview(ctx, 'allow-app', {
        app: normalizedArgs,
      }),
    );
  }

  private looksLikeWatchModeHost(value: string): boolean {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    if (/^https?:\/\//i.test(trimmed)) return true;
    return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/\S*)...$/i.test(trimmed);
  }

  private async createWatchModePolicyMutationPreview(
    ctx: IMessageContext,
    actionId: WatchModeActionId,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const mutationPlane = new ZavorthMutationPlaneService();
    const requestedBy = String(ctx.userId || '').trim() || 'operator';
    const title = this.buildWatchModePolicyMutationTitle(actionId, payload);
    const summary = tService('watchmode.policy_adjustment_summary');
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
        notes: [tService('watchmode.resource_impact_note')],
      },
      retentionPolicy: {
        ttlMs: 24 * 60 * 60 * 1000,
        maxBytes: 1024 * 1024,
        cleanupOnSuccess: true,
        cleanupOnBoot: true,
        notes: [tService('watchmode.retention_note')],
      },
      validationPlan: [
        tService('watchmode.validation_step_1'),
        tService('watchmode.validation_step_2'),
        tService('watchmode.validation_step_3'),
      ],
      rollbackPlan: [tService('watchmode.rollback_note')],
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
      throw new Error(tService('watchmode.plan_not_found', { planId: planId || 'n/d' }));
    }
    if (!['set-strict-default', 'allow-app', 'allow-site'].includes(plan.actionId)) {
      throw new Error(tService('watchmode.plan_requires_dedicated_route'));
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
        const blocked = mutationPlane.markBlocked(plan.id, tService('watchmode.approval_rejected'));
        return this.formatWatchModePolicyMutationReply(blocked, tService('watchmode.approval_rejected'), true);
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      return this.formatWatchModePolicyMutationReply(plan, tService('watchmode.plan_awaiting_approval'), false);
    }

    if (plan.actionId === 'set-strict-default') {
      const strictApproval = plan.payload.strictApproval === true;
      this.deps.watchModePolicyFileService.setStrictApprovalDefault(strictApproval);
    } else if (plan.actionId === 'allow-app') {
      const app = String(plan.payload.app || '').trim();
      if (!app) {
        throw new Error(tService('watchmode.allow_app_no_window'));
      }
      this.deps.watchModePolicyFileService.allowApp(app);
    } else if (plan.actionId === 'allow-site') {
      const site = String(plan.payload.site || '').trim();
      if (!site) {
        throw new Error(tService('watchmode.allow_site_no_host'));
      }
      this.deps.watchModePolicyFileService.allowSite(site);
    }

    const applied = mutationPlane.markApplied(plan.id, tService('watchmode.policy_applied_summary'), [plan.actionId]);
    return [
      tService('watchmode.applied_title'),
      '',
      `${tService('watchmode.plan_label')}: ${applied.id}.`,
      tService('watchmode.policy_changed_from_payload'),
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
      blocked ? tService('watchmode.blocked_title') : tService('watchmode.preview_title'),
      '',
      plan.title,
      reason,
      '',
      `${tService('watchmode.plan_label')}: ${plan.id} (${plan.status}).`,
      plan.approval.permissionId ? `Approval: ${plan.approval.permissionId}.` : tSurface('approval_pending'),
    ];
    if (!blocked) {
      lines.push(`${tService('watchmode.apply_after_approval')}: /watchmode apply ${plan.id}`);
    }
    return lines.join('\n');
  }
}
