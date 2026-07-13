import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthAutomationActionService } from '../../../../services/ZavorthAutomationActionService.js';
import type { ZavorthAutomationControlPlaneService } from '../../../../services/ZavorthAutomationControlPlaneService.js';
import type { ZavorthHubActionService } from '../../../../services/ZavorthHubActionService.js';
import type { ZavorthHubControlPlaneService } from '../../../../services/ZavorthHubControlPlaneService.js';
import type { ZavorthTrustPlaneActionService } from '../../../../services/ZavorthTrustPlaneActionService.js';
import type { ZavorthTrustPlaneService } from '../../../../services/ZavorthTrustPlaneService.js';
import { tSurface } from '../../../../i18n/surface.js';
import { tService } from '../../../../i18n/services.js';
import {
  buildReportSurfaceResponse,
  buildRuntimeSurfaceResponse,
  mapBooleanReceiptStatus,
  renderPlainSurfaceResponse,
  type SurfaceReceiptStatus,
} from '../../application/surface-response/index.js';

type HubActionResult = Awaited<ReturnType<Pick<ZavorthHubActionService, 'execute'>['execute']>>;
type AutomationExecutionResult =
  | Awaited<ReturnType<Pick<ZavorthAutomationActionService, 'execute'>['execute']>>
  | Awaited<ReturnType<Pick<ZavorthAutomationActionService, 'apply'>['apply']>>;

type SharedSurfaceOperationsCommandPackDeps = {
  hubControlPlaneService: Pick<ZavorthHubControlPlaneService, 'renderReport'>;
  hubActionService: Pick<ZavorthHubActionService, 'execute'>;
  automationControlPlaneService: Pick<ZavorthAutomationControlPlaneService, 'renderReport'>;
  automationActionService: Pick<ZavorthAutomationActionService, 'execute' | 'apply'>;
  trustPlaneService: Pick<ZavorthTrustPlaneService, 'renderReport'>;
  trustPlaneActionService: Pick<ZavorthTrustPlaneActionService, 'execute' | 'apply' | 'rollback'>;
};

export class SharedSurfaceOperationsCommandPack {
  constructor(private readonly deps: SharedSurfaceOperationsCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/hub':
        await this.handleHub(ctx, args);
        return true;
      case '/automations':
        await this.handleAutomations(ctx, args);
        return true;
      case '/schedule':
        await this.handleSchedule(ctx, args);
        return true;
      case '/schedules':
        await ctx.reply(this.renderOperationsReport(
          'schedules-status',
          tService('operations.governed_schedules'),
          await this.deps.automationControlPlaneService.renderReport(),
        ));
        return true;
      case '/unschedule':
        await this.handleUnschedule(ctx, args);
        return true;
      case '/report':
        await this.handleReport(ctx, args);
        return true;
      case '/trust':
        await this.handleTrustPlane(ctx, args);
        return true;
      default:
        return false;
    }
  }

  private async handleHub(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();

    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open' || lower === 'help' || lower === 'ajuda' || lower === '?') {
      const report = this.deps.hubControlPlaneService.renderReport({
        selectedId: null,
        query: null,
        recommendFor: null,
      });
      await ctx.reply(this.renderOperationsReport('hub-report', 'Hub + MCP product plane', report, {
        query: null,
      }));
      return;
    }

    if (lower.startsWith('open ')) {
      const filter = normalizedArgs.slice('open '.length).trim();
      await ctx.reply(this.renderOperationsReport(
        'hub-filtered-report',
        'Hub + MCP product plane',
        this.deps.hubControlPlaneService.renderReport({
          selectedId: filter || null,
          query: filter || null,
          recommendFor: filter || null,
        }),
        { query: filter || null },
      ));
      return;
    }

    if (lower === 'sync') {
      const execution = await this.deps.hubActionService.execute({
        actionId: 'platform-sync',
        requestedBy: String(ctx.userId || '').trim() || null,
        workspace: process.cwd(),
      });
      await ctx.reply(this.formatHubActionReply(execution));
      return;
    }

    if (['doctor', 'mcp-doctor', 'mcp doctor'].includes(lower)) {
      const execution = await this.deps.hubActionService.execute({
        actionId: 'mcp-browser-doctor',
        requestedBy: String(ctx.userId || '').trim() || null,
        workspace: process.cwd(),
      });
      await ctx.reply(this.formatHubActionReply(execution));
      return;
    }

    if (lower.startsWith('run ')) {
      const actionId = normalizedArgs.slice(4).trim();
      if (!actionId) {
        await ctx.reply(
          [
            'Run a hub action.',
            '',
            '/hub <actionId>',
            '  Ex.: /hub platform-sync',
            'Power form: /hub run <actionId>',
          ].join('\n'),
        );
        return;
      }
      try {
        const execution = await this.deps.hubActionService.execute({
          actionId,
          requestedBy: String(ctx.userId || '').trim() || null,
          workspace: process.cwd(),
        });
        await ctx.reply(this.formatHubActionReply(execution));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error || '');
        const looksUnknownAction =
          /nao encontrada|not found/i.test(message)
          || /reading ['"]actions['"]/i.test(message);
        if (!looksUnknownAction) {
          await ctx.reply(message || tSurface('error_hub_action'));
          return;
        }
        // NaturalSlashConvention rewrites bare tokens to "run <id>".
        // If that id is not a hub action (e.g. connector/catalog name), fall back to search.
        await ctx.reply(this.renderOperationsReport(
          'hub-search',
          'Hub + MCP product plane',
          this.deps.hubControlPlaneService.renderReport({
            selectedId: actionId,
            query: actionId,
            recommendFor: actionId,
          }),
          { query: actionId },
        ));
      }
      return;
    }

    if (lower.startsWith('recommend ')) {
      const recommendFor = normalizedArgs.slice('recommend '.length).trim();
      await ctx.reply(this.renderOperationsReport(
        'hub-recommendation',
        'Hub + MCP product plane',
        this.deps.hubControlPlaneService.renderReport({
          selectedId: null,
          query: null,
          recommendFor: recommendFor || null,
        }),
        { recommendFor: recommendFor || null },
      ));
      return;
    }

    await ctx.reply(this.renderOperationsReport(
      'hub-search',
      'Hub + MCP product plane',
      this.deps.hubControlPlaneService.renderReport({
        selectedId: normalizedArgs || null,
        query: normalizedArgs || null,
        recommendFor: normalizedArgs || null,
      }),
      { query: normalizedArgs || null },
    ));
  }

  private async handleAutomations(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();

    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open') {
      await ctx.reply(this.renderOperationsReport(
        'automations-status',
        'Automations e scheduled runs',
        await this.deps.automationControlPlaneService.renderReport(),
      ));
      return;
    }

    const applyMatch = normalizedArgs.match(/^apply\s+(.+)$/i);
    if (applyMatch) {
      const execution = await this.deps.automationActionService.apply({
        planId: String(applyMatch[1] || '').trim(),
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      await ctx.reply(this.formatAutomationActionReply(execution));
      return;
    }

    if (lower === 'maintenance on' || lower === 'maint on') {
      const execution = await this.deps.automationActionService.execute({
        actionId: 'maintenance-on',
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
      });
      await ctx.reply(this.formatAutomationActionReply(execution));
      return;
    }

    if (lower === 'maintenance off' || lower === 'maint off') {
      const execution = await this.deps.automationActionService.execute({
        actionId: 'maintenance-off',
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
      });
      await ctx.reply(this.formatAutomationActionReply(execution));
      return;
    }

    if (lower === 'maintenance run' || lower === 'maint run') {
      const execution = await this.deps.automationActionService.execute({
        actionId: 'maintenance-run',
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
      });
      await ctx.reply(this.formatAutomationActionReply(execution));
      return;
    }

    const pauseMatch = normalizedArgs.match(/^(pause|resume|remove|delete|reapprove|renew)\s+(.+)$/i);
    if (pauseMatch) {
      const verb = pauseMatch[1].toLowerCase();
      const execution = await this.deps.automationActionService.execute({
        actionId: verb === 'pause'
          ? 'pause'
          : verb === 'resume'
            ? 'resume'
            : (verb === 'reapprove' || verb === 'renew') ? 'reapprove' : 'remove',
        taskId: String(pauseMatch[2] || '').trim() || null,
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
      });
      await ctx.reply(this.formatAutomationActionReply(execution));
      return;
    }

    const execution = await this.deps.automationActionService.execute({
      actionId: 'create',
      intentText: normalizedArgs,
      requestedBy: String(ctx.userId || '').trim() || null,
      sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
    });
    await ctx.reply(this.formatAutomationActionReply(execution));
  }

  private async handleSchedule(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();

    // Empty / status / list / help → home report (NaturalSlashConvention rewrites empty → status).
    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open' || lower === 'list' || lower === 'ls') {
      await ctx.reply(this.renderOperationsReport(
        'schedule-status',
        tService('operations.governed_schedules'),
        await this.deps.automationControlPlaneService.renderReport(),
      ));
      return;
    }

    if (lower === 'help' || lower === 'ajuda' || lower === '?') {
      await ctx.reply(this.renderOperationsReport(
        'schedule-help',
        tService('operations.governed_schedules'),
        [
          'Schedule a recurring action (preview + governed approval).',
          '',
          '/schedule <request>',
          '  Ex.: /schedule every 1h /status',
          '  Ex.: /schedule todo dia as 9h verifique meus canais',
          '',
          '/schedule',
          '  → status of governed schedules',
        ].join('\n'),
      ));
      return;
    }

    // Free-text primary path: create with the natural request as intent payload.
    const execution = await this.deps.automationActionService.execute({
      actionId: 'create',
      intentText: normalizedArgs,
      requestedBy: String(ctx.userId || '').trim() || null,
      sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
    });
    await ctx.reply(this.formatAutomationActionReply(execution));
  }

  private async handleReport(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();

    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open' || lower === 'list' || lower === 'ls') {
      await ctx.reply(this.renderOperationsReport(
        'report-status',
        tService('operations.governed_reports'),
        await this.deps.automationControlPlaneService.renderReport(),
      ));
      return;
    }

    if (lower === 'help' || lower === 'ajuda' || lower === '?') {
      await ctx.reply(this.renderOperationsReport(
        'report-help',
        tService('operations.governed_reports'),
        [
          'Schedule a recurring report (preview + governed approval).',
          '',
          '/report <request>',
          '  Ex.: /report every 6h ultimas noticias de IA',
          '  Ex.: /report a cada 1h resumo do runtime',
          '',
          '/report',
          '  → status of governed report schedules',
        ].join('\n'),
      ));
      return;
    }

    // Structured cadence + topic → deepresearch report intent.
    const match = normalizedArgs.match(/^(every\s+\d+[mh]|a\s+cada\s+\d+\s*[mh]|todo\s+dia.*?\d{1,2}(?::\d{2})?\s*h?)\s+(.+)$/iu);
    const intentText = match
      ? `${match[1]} /deepresearch ${String(match[2] || '').trim()}`
      : normalizedArgs;

    // Free-text primary path (with or without explicit cadence) still creates via automation plane.
    const execution = await this.deps.automationActionService.execute({
      actionId: 'create',
      intentText,
      requestedBy: String(ctx.userId || '').trim() || null,
      sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
    });
    await ctx.reply(this.formatAutomationActionReply(execution));
  }

  private async handleUnschedule(ctx: IMessageContext, args: string): Promise<void> {
    const taskId = String(args || '').trim();
    if (!taskId) {
      await ctx.reply(this.renderOperationsReport(
        'unschedule-help',
        tService('operations.governed_schedules'),
        [
          'Remove a governed schedule by id.',
          '',
          '/unschedule <id>',
          '  Ex.: /unschedule task-123',
          '',
          'Removal goes through the governed lifecycle.',
        ].join('\n'),
      ));
      return;
    }
    const execution = await this.deps.automationActionService.execute({
      actionId: 'remove',
      taskId,
      requestedBy: String(ctx.userId || '').trim() || null,
      sourceSurface: ctx.platform === 'telegram' ? 'telegram' : 'app',
    });
    await ctx.reply(this.formatAutomationActionReply(execution));
  }

  private async handleTrustPlane(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const lower = normalizedArgs.toLowerCase();
    if (!normalizedArgs || lower === 'status' || lower === 'show' || lower === 'open') {
      await ctx.reply(this.renderOperationsReport(
        'trust-status',
        tService('operations.trust_plane_title'),
        this.deps.trustPlaneService.renderReport(),
      ));
      return;
    }

    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    if (tokens[0] === 'rollback' && tokens[1]) {
      const action = await this.deps.trustPlaneActionService.rollback({
        ledgerId: tokens[1],
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform,
      });
      await ctx.reply(this.formatTrustPlaneActionReply(action));
      return;
    }

    if (tokens[0] === 'apply' && tokens[1]) {
      const action = await this.deps.trustPlaneActionService.apply({
        planId: tokens[1],
        requestedBy: String(ctx.userId || '').trim() || null,
      });
      await ctx.reply(this.formatTrustPlaneActionReply(action));
      return;
    }

    if (tokens[0] === 'mcp' && ['safe', 'trusted', 'dangerous'].includes(tokens[1] || '')) {
      const action = await this.deps.trustPlaneActionService.execute({
        actionId: 'set-mcp-profile',
        profile: tokens[1],
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform,
      });
      await ctx.reply(this.formatTrustPlaneActionReply(action));
      return;
    }

    if (tokens[0] === 'mcp' && tokens[1] === 'allow' && tokens[2]) {
      const action = await this.deps.trustPlaneActionService.execute({
        actionId: 'allow-mcp-tool',
        toolName: tokens[2],
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform,
      });
      await ctx.reply(this.formatTrustPlaneActionReply(action));
      return;
    }

    if (tokens[0] === 'mcp' && ['remove', 'revoke', 'deny'].includes(tokens[1] || '') && tokens[2]) {
      const action = await this.deps.trustPlaneActionService.execute({
        actionId: 'remove-mcp-tool',
        toolName: tokens[2],
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform,
      });
      await ctx.reply(this.formatTrustPlaneActionReply(action));
      return;
    }

    if (tokens[0] === 'skills' && ['allow', 'deny'].includes(tokens[1] || '')) {
      const action = await this.deps.trustPlaneActionService.execute({
        actionId: 'set-skill-default',
        defaultPolicy: tokens[1],
        requestedBy: String(ctx.userId || '').trim() || null,
        sourceSurface: ctx.platform,
      });
      await ctx.reply(this.formatTrustPlaneActionReply(action));
      return;
    }

    await ctx.reply(this.renderOperationsReport('trust-help', tService('operations.trust_plane_title'), [
      tService('operations.trust_plane_title'),
      '',
      this.deps.trustPlaneService.renderReport(),
      '',
      tService('operations.mutation_shortcuts'),
      '- /trust mcp trusted',
      '- /trust mcp safe',
      '- /trust mcp allow <tool>',
      '- /trust mcp remove <tool>',
      '- /trust skills deny',
      '- /trust skills allow',
      '- /trust apply <planId>',
      '- /trust rollback <ledgerId>',
    ].join('\n')));
  }

  private formatHubActionReply(execution: HubActionResult): string {
    const text = [
      'Hub + MCP product plane',
      '',
      execution.summary,
      ...execution.details.map((detail) => `- ${detail}`),
      '',
      execution.hub.narrative.operatorSummary,
      `${tService('operations.next_step')}: ${execution.hub.narrative.nextAction}`,
    ].join('\n');
    return this.renderOperationsAction('hub-action', 'Hub + MCP product plane', execution.summary, text, {
      status: this.mapExecutionStatus(execution),
      metadata: { details: execution.details.length },
    });
  }

  private formatAutomationActionReply(execution: AutomationExecutionResult): string {
    const lines = [
      'Scheduled runs: Automations e scheduled runs',
      '',
      `${execution.summary}`,
      ...execution.details.map((entry) => `- ${entry}`),
      '',
      execution.snapshot.narrative.operatorSummary,
      `${tService('operations.next_step')}: ${execution.snapshot.narrative.nextAction}`,
    ];
    const plan = 'mutationPlan' in execution ? execution.mutationPlan : null;
    if (plan?.id) {
      lines.push(
        '',
        `${tService('operations.plan_label')}: ${plan.id} (${plan.status || execution.status || 'waiting_approval'}).`,
        plan.approval?.permissionId ? `Approval: ${plan.approval.permissionId}.` : tSurface('approval_pending'),
        `${tService('operations.apply_after_approval')}: /automations apply ${plan.id}`,
      );
    }
    return this.renderOperationsAction(
      `automation-${String((execution as any).actionId || 'action')}`,
      'Automations e scheduled runs',
      String(execution.summary || tService('operations.automation_action_completed')),
      lines.join('\n'),
      {
        status: this.mapExecutionStatus(execution),
        metadata: {
          actionId: (execution as any).actionId || null,
          planId: plan?.id || null,
        },
      },
    );
  }

  private formatTrustPlaneActionReply(result: {
    summary?: string;
    details?: string[];
    snapshot?: any;
    status?: string;
    mutationPlan?: { id?: string; status?: string; approval?: { permissionId?: string | null } } | null;
    diffPreview?: { entries?: Array<{ path?: string; summary?: string }>; approvalScope?: string } | null;
    ledgerEntry?: { id?: string } | null;
    rollbackPlan?: { available?: boolean; ledgerId?: string | null; reason?: string } | null;
  }): string {
    const lines = [
      result.status === 'waiting_approval'
        ? tService('operations.trust_plane_preview')
        : result.status === 'blocked'
          ? tService('operations.trust_plane_blocked')
          : tService('operations.trust_plane_updated'),
      '',
      String(result.summary || tService('operations.trust_plane_adjustment_applied')).trim(),
    ];
    const details = Array.isArray(result.details) ? result.details.filter(Boolean) : [];
    if (details.length > 0) {
      lines.push('', ...details.map((entry) => `- ${entry}`));
    }
    const snapshot = result.snapshot || null;
    if (snapshot?.summary) {
      lines.push(
        '',
        `${tService('operations.posture')}: ${snapshot.summary.posture}.`,
        `MCP: ${snapshot.summary.mcpProfile} | Skills: ${snapshot.summary.skillDefaultPolicy} | Plugins trusted: ${snapshot.summary.trustedPlugins}/${snapshot.summary.installedPlugins}.`,
      );
    }
    const diffEntries = Array.isArray(result.diffPreview?.entries) ? result.diffPreview.entries : [];
    if (diffEntries.length > 0) {
      lines.push(
        '',
        `Diff preview (${result.diffPreview?.approvalScope || 'once'}):`,
        ...diffEntries.slice(0, 4).map((entry) => `- ${entry.path || 'policy'}: ${entry.summary || tService('operations.policy_change')}`),
      );
    }
    if (result.ledgerEntry?.id) {
      lines.push('', `Ledger: ${result.ledgerEntry.id}.`);
    }
    if (result.rollbackPlan?.available && result.rollbackPlan.ledgerId) {
      lines.push(`Rollback: /trust rollback ${result.rollbackPlan.ledgerId}`);
    }
    if (result.mutationPlan?.id) {
      lines.push(
        '',
        `${tService('operations.plan_label')}: ${result.mutationPlan.id} (${result.mutationPlan.status || 'waiting_approval'}).`,
        result.mutationPlan.approval?.permissionId
          ? `Approval: ${result.mutationPlan.approval.permissionId}.`
          : tSurface('approval_pending'),
        `${tService('operations.apply_after_approval')}: /trust apply ${result.mutationPlan.id}`,
      );
    }
    return this.renderOperationsAction(
      `trust-${String(result.status || 'action')}`,
      result.status === 'waiting_approval'
        ? tService('operations.trust_plane_preview')
        : result.status === 'blocked'
          ? tService('operations.trust_plane_blocked')
          : tService('operations.trust_plane_updated'),
      String(result.summary || tService('operations.trust_plane_adjustment_applied')).trim(),
      lines.join('\n'),
      {
        status: this.mapExecutionStatus(result),
        metadata: {
          mutationPlanId: result.mutationPlan?.id || null,
          ledgerId: result.ledgerEntry?.id || null,
        },
      },
    );
  }

  private renderOperationsReport(
    id: string,
    title: string,
    text: string,
    metadata: Record<string, unknown> = {},
    status: SurfaceReceiptStatus = 'done',
  ): string {
    return renderPlainSurfaceResponse(buildReportSurfaceResponse({
      id: `shared-operations-${id}`,
      title,
      text,
      status,
      policyProfile: 'shared-operations',
      metadata,
    })).text;
  }

  private renderOperationsAction(
    id: string,
    title: string,
    summary: string,
    text: string,
    options: {
      status?: SurfaceReceiptStatus;
      metadata?: Record<string, unknown>;
    } = {},
  ): string {
    return renderPlainSurfaceResponse(buildRuntimeSurfaceResponse({
      id: `shared-operations-${id}`,
      title,
      summary,
      text,
      status: options.status || 'done',
      policyProfile: 'shared-operations',
      metadata: options.metadata,
    })).text;
  }

  private mapExecutionStatus(result: { ok?: boolean; status?: string } | null | undefined): SurfaceReceiptStatus {
    if (typeof result?.ok === 'boolean') {
      return mapBooleanReceiptStatus(result.ok);
    }
    switch (String(result?.status || '').trim()) {
      case 'blocked':
        return 'blocked';
      case 'failed':
        return 'failed';
      case 'waiting_approval':
        return 'require_user_confirmation';
      default:
        return 'done';
    }
  }
}
