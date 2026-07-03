import { Context } from 'grammy';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { OperationalMode } from '../../../../security/OperationalMode.js';
import { logger } from '../logger.js';

const VALID_OPERATIONAL_MODES = Object.values(OperationalMode);

export type TelegramOpsAdministrationServiceDeps = {
  auditLogger: AuditLogger;
  executionGateway: ExecutionGateway;
};

export class TelegramOpsAdministrationService {
  constructor(private readonly deps: TelegramOpsAdministrationServiceDeps) {}

  public async handleAudit(ctx: Context, args: string): Promise<void> {
    try {
      const limit = parseInt(args, 10) || 10;
      const events = await this.deps.auditLogger.getRecentEvents(Math.min(limit, 30));

      if (events.length === 0) {
        await ctx.reply('Nenhum evento de audit registrado ainda.');
        return;
      }

      const lines: string[] = [`Ultimos ${events.length} eventos do audit log:`];
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
      lines.push('', `Modo operacional atual: ${modeManager.getMode()}`);
      await ctx.reply(lines.join('\n'));
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await ctx.reply(`Nao consegui ler o audit log agora.\n\nMotivo: ${msg}`);
    }
  }

  public async handleOperationalMode(ctx: Context, args: string): Promise<void> {
    const modeManager = this.deps.executionGateway.getModeManager();

    if (!args || args.trim().length === 0) {
      const currentMode = modeManager.getMode();
      const perms = modeManager.getPermissions();
      const permLines = Object.entries(perms)
        .map(([key, val]) => `  ${key}: ${val ? 'sim' : 'nao'}`)
        .join('\n');

      await ctx.reply(
        `Modo operacional atual: ${currentMode}\n\nPermissoes:\n${permLines}\n\nPara trocar, use /mode <READ_ONLY|WORKSPACE|BUILD|PRIVILEGED>.`,
      );
      return;
    }

    const requestedMode = args.trim().toUpperCase();
    if (!VALID_OPERATIONAL_MODES.includes(requestedMode as OperationalMode)) {
      await ctx.reply(`Modo invalido: ${args}\n\nModos disponiveis: ${VALID_OPERATIONAL_MODES.join(', ')}`);
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
        execution_summary: `Modo alterado: ${previousMode} -> ${requestedMode}`,
        metadata: {},
      })
      .catch((err) => { logger.warn("[auto-fix] Empty catch block", err); });

    await ctx.reply(`Modo operacional alterado.\n\nAnterior: ${previousMode}\nAtual: ${requestedMode}`);
  }
}
