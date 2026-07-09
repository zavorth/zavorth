import { Context } from 'grammy';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { OperationalMode } from '../../../../security/OperationalMode.js';
import { logger } from '../../../../logger.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

const VALID_OPERATIONAL_MODES = Object.values(OperationalMode);

export type TelegramOpsAdministrationServiceDeps = {
  auditLogger: AuditLogger;
  executionGateway: ExecutionGateway;
};

export class TelegramOpsAdministrationService {
  constructor(private readonly deps: TelegramOpsAdministrationServiceDeps) {}

  public async handleAudit(ctx: Context, args: string): Promise<void> {
    try {
      const limit = safeParseInt(args, 10);
      const events = await this.deps.auditLogger.getRecentEvents(Math.min(limit, 30));

      if (events.length === 0) {
        await ctx.reply('No audit events have been recorded yet.');
        return;
      }

      const lines: string[] = [`Latest ${events.length} audit log events:`];
      for (const event of events) {
        const time = event.timestamp.substring(11, 19);
        const emoji =
          event.event_type === 'SECURITY_BLOCK'
            ? 'BLOCK'
            : event.event_type === 'POLICY_EVALUATED'
              ? 'POLICY'
              : event.event_type === 'EXECUTION_COMPLETED'
                ? 'EXEC'
                : 'INFO';

        lines.push(
          `${emoji} [${time}] ${event.event_type} | task=${event.task_id.substring(0, 8)} | ${event.policy_decision}${event.execution_summary ? ' | ' + event.execution_summary.substring(0, 60) : ''}`,
        );
      }

      const modeManager = this.deps.executionGateway.getModeManager();
      lines.push('', `Current operational mode: ${modeManager.getMode()}`);
      await ctx.reply(lines.join('\n'));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const msg = error instanceof Error ? err.message : String(error);
      await ctx.reply(`I could not read the audit log right now.\n\nReason: ${msg}`);
    }
  }

  public async handleOperationalMode(ctx: Context, args: string): Promise<void> {
    const modeManager = this.deps.executionGateway.getModeManager();

    if (!args || args.trim().length === 0) {
      const currentMode = modeManager.getMode();
      const perms = modeManager.getPermissions();
      const permLines = Object.entries(perms)
        .map(([key, val]) => `  ${key}: ${val ? 'yes' : 'no'}`)
        .join('\n');

      await ctx.reply(
        `Current operational mode: ${currentMode}\n\nPermissions:\n${permLines}\n\nTo change it, use /mode <READ_ONLY|WORKSPACE|BUILD|PRIVILEGED>.`,
      );
      return;
    }

    const requestedMode = args.trim().toUpperCase();
    if (!VALID_OPERATIONAL_MODES.includes(requestedMode as OperationalMode)) {
      await ctx.reply(`Invalid mode: ${args}\n\nAvailable modes: ${VALID_OPERATIONAL_MODES.join(', ')}`);
      return;
    }

    const previousMode = modeManager.getMode();
    modeManager.setMode(requestedMode as OperationalMode);

    this.deps.auditLogger
      .logEvent({
        timestamp: new Date().toISOString(),
        event_type: 'MODE_CHANGE',
        task_id: 'system',
        user_id: ctx.from?.id?.toString() || '',
        user_input: `/mode ${requestedMode}`,
        intent: 'mode_change',
        plan_id: null,
        risk_level: requestedMode === OperationalMode.PRIVILEGED ? 2 : 0,
        policy_decision: 'ALLOWED',
        policy_violations: null,
        operational_mode: requestedMode,
        executor: null,
        execution_success: true,
        execution_summary: `Mode changed: ${previousMode} -> ${requestedMode}`,
        metadata: {},
      })
      .catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });

    await ctx.reply(`Operational mode changed.\n\nPrevious: ${previousMode}\nCurrent: ${requestedMode}`);
  }
}
