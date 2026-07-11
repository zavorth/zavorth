import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightApplyAdapterKind,
  CapabilityPreflightApplyAdapterSnapshot,
  CapabilityPreflightApplyReceipt,
} from './CapabilityAutopilotPreflightApplyAdapterService.js';

export type CapabilityPreflightApplyDryRunStatus =
  | 'dry_run_passed'
  | 'blocked';

export type CapabilityPreflightApplyDryRunInvocationKind =
  | 'cli_command_dry_run'
  | 'web_navigation_dry_run'
  | 'chat_callback_dry_run'
  | 'telegram_callback_dry_run'
  | 'api_request_dry_run'
  | 'manual_operator_dry_run';

export type CapabilityPreflightApplyDryRunOptions = {
  dryRunConfirmed?: boolean;
  actorId?: string | null;
  dryRunReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityPreflightApplyDryRunExecution = {
  gate: 'capability-autopilot-preflight-apply-dry-run';
  dryRunExecutionId: string;
  generatedAt: string;
  surface: 'capability-autopilot-preflight-apply-dry-run-executor';
  status: CapabilityPreflightApplyDryRunStatus;
  capabilityId: string;
  sourceApplyReceiptGate: CapabilityPreflightApplyReceipt['gate'];
  sourceApplyReceiptId: string;
  sourceSurface: CapabilityPreflightApplyReceipt['sourceSurface'];
  sourceAction: CapabilityPreflightApplyReceipt['sourceAction'];
  applyAdapterKind: CapabilityPreflightApplyAdapterKind;
  invocationKind: CapabilityPreflightApplyDryRunInvocationKind;
  dispatchMode: CapabilityPreflightApplyReceipt['dispatchMode'];
  target: CapabilityPreflightApplyReceipt['target'];
  dryRunConfirmed: boolean;
  requiresExplicitUserAction: true;
  sourceApplyPrepared: boolean;
  sourceApplyStatus: CapabilityPreflightApplyReceipt['status'];
  sourceInvocationPlan: CapabilityPreflightApplyReceipt['invocationPlan'];
  dryRunAttempted: boolean;
  dryRunCompleted: boolean;
  dryRunPassed: boolean;
  applyInvoked: false;
  adapterInvoked: false;
  sideEffectInvoked: false;
  dispatchExecuted: false;
  executedAgainstRealTarget: false;
  commandExecuted: false;
  requestSent: false;
  callbackSent: false;
  navigationOpened: false;
  shouldRunAutomatically: false;
  sideEffectLevel: 'dry_run_only';
  blockers: string[];
  evidence: string[];
  rollbackHint: string;
  safeSummary: string;
  audit: {
    sourceApplyGeneratedAt: string;
    actorId: string | null;
    dryRunReceiptId: string | null;
    reason: string | null;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightApplyDryRunExecutorSnapshot = {
  gate: 'capability-autopilot-preflight-apply-dry-run';
  surface: 'capability-autopilot-preflight-apply-dry-run-executor';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityPreflightApplyAdapterSnapshot['gate'];
  executions: CapabilityPreflightApplyDryRunExecution[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedGate: {
    gate: 'capability-autopilot-preflight-real-apply-approval';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightApplyDryRunExecutorRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotPreflightApplyDryRunExecutorService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightApplyDryRunExecutorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildExecution(
    receipt: CapabilityPreflightApplyReceipt,
    options: CapabilityPreflightApplyDryRunOptions = {},
  ): CapabilityPreflightApplyDryRunExecution {
    const generatedAt = this.now().toISOString();
    const dryRunConfirmed = options.dryRunConfirmed === true;
    const invocationKind = this.resolveInvocationKind(receipt.applyAdapterKind);
    const blockers = this.resolveBlockers(receipt, dryRunConfirmed);
    const status: CapabilityPreflightApplyDryRunStatus = blockers.length > 0 ? 'blocked' : 'dry_run_passed';
    const dryRunAttempted = status === 'dry_run_passed';
    const dryRunExecutionId = this.buildDryRunExecutionId(receipt, generatedAt, options.dryRunReceiptId || null);

    return {
      gate: 'capability-autopilot-preflight-apply-dry-run',
      dryRunExecutionId,
      generatedAt,
      surface: 'capability-autopilot-preflight-apply-dry-run-executor',
      status,
      capabilityId: receipt.capabilityId,
      sourceApplyReceiptGate: receipt.gate,
      sourceApplyReceiptId: receipt.applyReceiptId,
      sourceSurface: receipt.sourceSurface,
      sourceAction: receipt.sourceAction,
      applyAdapterKind: receipt.applyAdapterKind,
      invocationKind,
      dispatchMode: receipt.dispatchMode,
      target: receipt.target,
      dryRunConfirmed,
      requiresExplicitUserAction: true,
      sourceApplyPrepared: receipt.applyPrepared,
      sourceApplyStatus: receipt.status,
      sourceInvocationPlan: receipt.invocationPlan,
      dryRunAttempted,
      dryRunCompleted: dryRunAttempted,
      dryRunPassed: dryRunAttempted,
      applyInvoked: false,
      adapterInvoked: false,
      sideEffectInvoked: false,
      dispatchExecuted: false,
      executedAgainstRealTarget: false,
      commandExecuted: false,
      requestSent: false,
      callbackSent: false,
      navigationOpened: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'dry_run_only',
      blockers,
      evidence: this.buildEvidence(receipt, invocationKind, status),
      rollbackHint: this.buildRollbackHint(receipt),
      safeSummary: this.buildSafeSummary(receipt, status),
      audit: {
        sourceApplyGeneratedAt: receipt.generatedAt,
        actorId: options.actorId || null,
        dryRunReceiptId: options.dryRunReceiptId || null,
        reason: options.reason || null,
      },
      metadata: {
        gate: 'capability-autopilot-preflight-apply-dry-run',
        sourceApplyStatus: receipt.status,
        sourceActionKind: receipt.sourceAction?.kind || null,
        autoExecute: false,
        dryRunOnly: true,
        dryRunAttempted,
        dryRunPassed: dryRunAttempted,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
        executedAgainstRealTarget: false,
      },
    };
  }

  public buildExecutorSnapshot(
    source: CapabilityPreflightApplyAdapterSnapshot,
    options: CapabilityPreflightApplyDryRunOptions = {},
  ): CapabilityPreflightApplyDryRunExecutorSnapshot {
    const generatedAt = this.now().toISOString();
    const executions = source.applyReceipts.map((receipt) => this.buildExecution(receipt, options));
    const checks = this.buildChecks(source, executions);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'capability-autopilot-preflight-apply-dry-run',
      surface: 'capability-autopilot-preflight-apply-dry-run-executor',
      generatedAt,
      capabilityId: source.capabilityId,
      status: failed > 0 ? 'blocked' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      sourceSnapshotGate: source.gate,
      executions,
      checks,
      nextRecommendedGate: {
        gate: 'capability-autopilot-preflight-real-apply-approval',
        title: 'Preflight Real Apply Approval Gate',
        reason:
          'Depois do dry-run instrumentado, o proximo passo e exigir approval final e budget antes de qualquer side effect real por superficie.',
      },
      metadata: {
        gate: 'capability-autopilot-preflight-apply-dry-run',
        sourceSnapshotStatus: source.status,
        applyReceiptCount: source.applyReceipts.length,
        dryRunExecutionCount: executions.length,
        autoExecute: false,
        dryRunOnly: true,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
        executedAgainstRealTarget: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightApplyDryRunExecutorSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-dry-run] Preflight Apply Dry-Run Executor');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`dryRunExecutions: ${snapshot.executions.length}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private resolveInvocationKind(
    applyAdapterKind: CapabilityPreflightApplyAdapterKind,
  ): CapabilityPreflightApplyDryRunInvocationKind {
    switch (applyAdapterKind) {
      case 'cli_apply_plan':
        return 'cli_command_dry_run';
      case 'web_navigation_plan':
        return 'web_navigation_dry_run';
      case 'chat_callback_plan':
        return 'chat_callback_dry_run';
      case 'telegram_callback_plan':
        return 'telegram_callback_dry_run';
      case 'api_request_plan':
        return 'api_request_dry_run';
      case 'manual_operator_plan':
      default:
        return 'manual_operator_dry_run';
    }
  }

  private resolveBlockers(
    receipt: CapabilityPreflightApplyReceipt,
    dryRunConfirmed: boolean,
  ): string[] {
    const blockers = [...receipt.blockers];
    if (receipt.status !== 'apply_receipt_ready') {
      blockers.push(`apply_receipt_not_ready:${receipt.status}`);
    }
    if (!receipt.applyPrepared) {
      blockers.push('apply_not_prepared');
    }
    if (!dryRunConfirmed) {
      blockers.push('dry_run_confirmation_required');
    }
    if (receipt.invocationPlan.dryRun !== true) {
      blockers.push('dry_run_plan_required');
    }
    if (receipt.applyInvoked || receipt.adapterInvoked || receipt.sideEffectInvoked || receipt.dispatchExecuted) {
      blockers.push('source_apply_already_invoked');
    }
    if (receipt.shouldRunAutomatically !== false) {
      blockers.push('automatic_apply_not_allowed');
    }
    if (receipt.sideEffectLevel !== 'prepared_only') {
      blockers.push(`unexpected_source_side_effect_level:${receipt.sideEffectLevel}`);
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightApplyAdapterSnapshot,
    executions: CapabilityPreflightApplyDryRunExecution[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, executions });
    const blocked = executions.filter((execution) => execution.status === 'blocked');

    return [
      this.check(
        'capability-autopilot-preflight-dry-run:coverage',
        'dry-run execution por apply receipt',
        executions.length === source.applyReceipts.length && blocked.length === 0 ? 'pass' : 'fail',
        'Cada apply receipt preparado precisa gerar uma execution dry-run aprovada.',
        [
          `applyReceipts=${source.applyReceipts.length}`,
          `dryRunExecutions=${executions.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((execution) => `${execution.sourceSurface}:${execution.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-dry-run:no-real-target',
        'sem alvo real invocado',
        executions.every((execution) =>
          execution.executedAgainstRealTarget === false &&
          execution.commandExecuted === false &&
          execution.requestSent === false &&
          execution.callbackSent === false &&
          execution.navigationOpened === false &&
          execution.applyInvoked === false &&
          execution.adapterInvoked === false &&
          execution.sideEffectInvoked === false &&
          execution.dispatchExecuted === false &&
          execution.shouldRunAutomatically === false &&
          execution.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'Dry-run executor gera evidence sem chamar CLI, rota, callback ou API reais.',
        executions.map((execution) =>
          `${execution.sourceSurface}:${execution.invocationKind}:realTarget=${execution.executedAgainstRealTarget}:sideEffect=${execution.sideEffectInvoked}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-dry-run:attempted',
        'dry-run concluido',
        executions.every((execution) =>
          execution.dryRunConfirmed &&
          execution.dryRunAttempted &&
          execution.dryRunCompleted &&
          execution.dryRunPassed &&
          execution.sideEffectLevel === 'dry_run_only'
        ) ? 'pass' : 'fail',
        'Este gate so considera ready quando todos os dry-runs foram simulados com sucesso.',
        executions.map((execution) =>
          `${execution.sourceSurface}:${execution.sourceAction?.kind || '<none>'}:confirmed=${execution.dryRunConfirmed}:passed=${execution.dryRunPassed}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-dry-run:source-dry-run-plan',
        'fonte exige dry-run',
        executions.every((execution) =>
          execution.sourceApplyPrepared &&
          execution.sourceInvocationPlan.dryRun === true &&
          execution.sourceApplyStatus === 'apply_receipt_ready'
        ) ? 'pass' : 'fail',
        'Dry-run executor aceita somente apply receipts preparados pelo gate de apply adapter.',
        executions.map((execution) =>
          `${execution.sourceSurface}:${execution.applyAdapterKind}:sourcePrepared=${execution.sourceApplyPrepared}:sourceDryRun=${execution.sourceInvocationPlan.dryRun}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-dry-run:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Dry-run snapshots publicos nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildDryRunExecutionId(
    receipt: CapabilityPreflightApplyReceipt,
    generatedAt: string,
    dryRunReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        receipt.capabilityId,
        receipt.sourceSurface,
        receipt.applyReceiptId,
        receipt.sourceAction?.id || '<none>',
        receipt.applyAdapterKind,
        generatedAt,
        dryRunReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${receipt.capabilityId}-preflight-dry-run-${digest}`;
  }

  private buildEvidence(
    receipt: CapabilityPreflightApplyReceipt,
    invocationKind: CapabilityPreflightApplyDryRunInvocationKind,
    status: CapabilityPreflightApplyDryRunStatus,
  ): string[] {
    if (status === 'blocked') {
      return [
        `dryRun=${receipt.invocationPlan.dryRun}`,
        `sourceApplyStatus=${receipt.status}`,
        `sourceApplyPrepared=${receipt.applyPrepared}`,
        'realInvocation=false',
      ];
    }
    return [
      `invocationKind=${invocationKind}`,
      `sourceApplyReceiptId=${receipt.applyReceiptId}`,
      `sourceAction=${receipt.sourceAction?.kind || '<none>'}`,
      `targetShape=${this.describeTargetShape(receipt)}`,
      'realInvocation=false',
      'dryRunOnly=true',
    ];
  }

  private describeTargetShape(receipt: CapabilityPreflightApplyReceipt): string {
    switch (receipt.applyAdapterKind) {
      case 'cli_apply_plan':
        return receipt.invocationPlan.command ? 'command-preview' : 'manual-cli';
      case 'web_navigation_plan':
        return receipt.invocationPlan.route ? 'route-intent' : 'manual-web';
      case 'chat_callback_plan':
      case 'telegram_callback_plan':
        return receipt.invocationPlan.callbackData ? 'callback-ack' : 'manual-callback';
      case 'api_request_plan':
        return receipt.invocationPlan.route && receipt.invocationPlan.method ? 'api-operation' : 'manual-api';
      case 'manual_operator_plan':
      default:
        return 'manual-operator';
    }
  }

  private buildRollbackHint(receipt: CapabilityPreflightApplyReceipt): string {
    return [
      `Dry-run only for ${receipt.sourceAction?.kind || '<none>'}.`,
      'Rollback is to discard this dry-run execution and keep the apply receipt for audit.',
    ].join(' ');
  }

  private buildSafeSummary(
    receipt: CapabilityPreflightApplyReceipt,
    status: CapabilityPreflightApplyDryRunStatus,
  ): string {
    if (status === 'blocked') {
      return `Dry-run bloqueado para ${receipt.sourceAction?.kind || '<sem-action>'}; nenhum alvo real foi invocado.`;
    }
    return `Dry-run concluido para ${receipt.sourceAction?.kind || '<sem-action>'}; nenhum alvo real foi invocado.`;
  }

  private check(
    id: string,
    title: string,
    status: CapabilityAutopilotPreflightCheck['status'],
    reason: string,
    evidence: string[] = [],
  ): CapabilityAutopilotPreflightCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
