import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightControlledRealApplyExecution,
  CapabilityPreflightControlledRealApplyExecutorSnapshot,
} from './CapabilityAutopilotPreflightControlledRealApplyExecutorService.js';

export type CapabilityPreflightPostRunRollbackLedgerStatus =
  | 'post_run_verified'
  | 'rollback_required'
  | 'blocked';

export type CapabilityPreflightPostRunRollbackLedgerOptions = {
  postRunVerificationConfirmed?: boolean;
  verificationPassed?: boolean;
  rollbackLedgerPersisted?: boolean;
  auditPersisted?: boolean;
  actorId?: string | null;
  postRunReceiptId?: string | null;
  verificationReceiptId?: string | null;
  rollbackLedgerId?: string | null;
  auditReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityPreflightPostRunRollbackLedgerEntry = {
  phase: '77';
  postRunLedgerEntryId: string;
  generatedAt: string;
  surface: 'capability-autopilot-preflight-post-run-rollback-ledger';
  status: CapabilityPreflightPostRunRollbackLedgerStatus;
  capabilityId: string;
  sourceExecutionPhase: CapabilityPreflightControlledRealApplyExecution['phase'];
  sourceControlledExecutionId: string;
  sourceSurface: CapabilityPreflightControlledRealApplyExecution['sourceSurface'];
  sourceAction: CapabilityPreflightControlledRealApplyExecution['sourceAction'];
  invocationKind: CapabilityPreflightControlledRealApplyExecution['invocationKind'];
  applyAdapterKind: CapabilityPreflightControlledRealApplyExecution['applyAdapterKind'];
  dispatchMode: CapabilityPreflightControlledRealApplyExecution['dispatchMode'];
  target: CapabilityPreflightControlledRealApplyExecution['target'];
  sourceExecutionStatus: CapabilityPreflightControlledRealApplyExecution['status'];
  sourceSideEffectInvoked: boolean;
  sourceExecutedAgainstRealTarget: boolean;
  sourceAdapterReceiptId: string | null;
  sourceAdapterMode: string | null;
  postRunVerificationConfirmed: boolean;
  postRunVerified: boolean;
  verificationPassed: boolean;
  auditPersisted: boolean;
  rollbackLedgerPersisted: boolean;
  shouldRunAutomatically: false;
  rollback: {
    rollbackRequired: boolean;
    rollbackAvailable: boolean;
    rollbackInvoked: false;
    rollbackToken: string | null;
    rollbackPlanId: string | null;
    rollbackLedgerId: string | null;
  };
  audit: {
    sourceExecutionGeneratedAt: string;
    actorId: string | null;
    postRunReceiptId: string | null;
    verificationReceiptId: string | null;
    rollbackLedgerId: string | null;
    auditReceiptId: string | null;
    reason: string | null;
  };
  blockers: string[];
  evidence: string[];
  safeSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightPostRunRollbackLedgerSnapshot = {
  phase: '77';
  surface: 'capability-autopilot-preflight-post-run-rollback-ledger';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityPreflightControlledRealApplyExecutorSnapshot['phase'];
  entries: CapabilityPreflightPostRunRollbackLedgerEntry[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedPhase: {
    phase: '78';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightPostRunRollbackLedgerRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotPreflightPostRunRollbackLedgerService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightPostRunRollbackLedgerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildEntry(
    execution: CapabilityPreflightControlledRealApplyExecution,
    options: CapabilityPreflightPostRunRollbackLedgerOptions = {},
  ): CapabilityPreflightPostRunRollbackLedgerEntry {
    const generatedAt = this.now().toISOString();
    const postRunVerificationConfirmed = options.postRunVerificationConfirmed === true;
    const verificationPassed = options.verificationPassed === true;
    const rollbackLedgerPersisted = options.rollbackLedgerPersisted === true;
    const auditPersisted = options.auditPersisted === true;
    const rollbackRequired = execution.sideEffectInvoked || execution.rollbackPlan.rollbackRequired;
    const rollbackToken = execution.rollbackPlan.rollbackToken || execution.adapterResult?.rollbackToken || null;
    const rollbackAvailable = !rollbackRequired || Boolean(rollbackToken && execution.rollbackPlan.rollbackPlanId);
    const baseBlockers = this.resolveBaseBlockers(execution, {
      postRunVerificationConfirmed,
      rollbackLedgerPersisted,
      auditPersisted,
      rollbackRequired,
      rollbackAvailable,
    });
    const status = this.resolveStatus(baseBlockers, verificationPassed, rollbackRequired, rollbackAvailable);
    const postRunLedgerEntryId = this.buildPostRunLedgerEntryId(execution, generatedAt, options.postRunReceiptId || null);

    return {
      phase: '77',
      postRunLedgerEntryId,
      generatedAt,
      surface: 'capability-autopilot-preflight-post-run-rollback-ledger',
      status,
      capabilityId: execution.capabilityId,
      sourceExecutionPhase: execution.phase,
      sourceControlledExecutionId: execution.controlledExecutionId,
      sourceSurface: execution.sourceSurface,
      sourceAction: execution.sourceAction,
      invocationKind: execution.invocationKind,
      applyAdapterKind: execution.applyAdapterKind,
      dispatchMode: execution.dispatchMode,
      target: execution.target,
      sourceExecutionStatus: execution.status,
      sourceSideEffectInvoked: execution.sideEffectInvoked,
      sourceExecutedAgainstRealTarget: execution.executedAgainstRealTarget,
      sourceAdapterReceiptId: execution.adapterResult?.adapterReceiptId || null,
      sourceAdapterMode: execution.adapterResult?.mode || null,
      postRunVerificationConfirmed,
      postRunVerified: status === 'post_run_verified',
      verificationPassed,
      auditPersisted,
      rollbackLedgerPersisted,
      shouldRunAutomatically: false,
      rollback: {
        rollbackRequired,
        rollbackAvailable,
        rollbackInvoked: false,
        rollbackToken,
        rollbackPlanId: execution.rollbackPlan.rollbackPlanId,
        rollbackLedgerId: options.rollbackLedgerId || null,
      },
      audit: {
        sourceExecutionGeneratedAt: execution.generatedAt,
        actorId: options.actorId || null,
        postRunReceiptId: options.postRunReceiptId || null,
        verificationReceiptId: options.verificationReceiptId || null,
        rollbackLedgerId: options.rollbackLedgerId || null,
        auditReceiptId: options.auditReceiptId || null,
        reason: options.reason || null,
      },
      blockers: this.resolveEntryBlockers(baseBlockers, verificationPassed),
      evidence: this.buildEvidence(execution, {
        verificationPassed,
        rollbackRequired,
        rollbackAvailable,
        rollbackLedgerPersisted,
        auditPersisted,
        rollbackToken,
      }),
      safeSummary: this.buildSafeSummary(execution, status),
      metadata: {
        phase: 'capability-autopilot-phase-77',
        sourceExecutionStatus: execution.status,
        sourceActionKind: execution.sourceAction?.kind || null,
        autoExecute: false,
        postRunVerified: status === 'post_run_verified',
        rollbackRequired,
        rollbackAvailable,
        rollbackInvoked: false,
        auditPersisted,
        rollbackLedgerPersisted,
      },
    };
  }

  public buildLedgerSnapshot(
    source: CapabilityPreflightControlledRealApplyExecutorSnapshot,
    options: CapabilityPreflightPostRunRollbackLedgerOptions = {},
  ): CapabilityPreflightPostRunRollbackLedgerSnapshot {
    const generatedAt = this.now().toISOString();
    const entries = source.executions.map((execution) => this.buildEntry(execution, options));
    const checks = this.buildChecks(source, entries);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '77',
      surface: 'capability-autopilot-preflight-post-run-rollback-ledger',
      generatedAt,
      capabilityId: source.capabilityId,
      status: failed > 0 ? 'blocked' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      sourceSnapshotPhase: source.phase,
      entries,
      checks,
      nextRecommendedPhase: {
        phase: '78',
        title: 'Capability Autopilot v1.1 Beta Readiness Gate',
        reason:
          'Depois da verificacao pos-run e rollback ledger, o proximo passo e decidir se o Capability Autopilot pode avancar do alpha para beta com gates agregados.',
      },
      metadata: {
        phase: 'capability-autopilot-phase-77',
        sourceSnapshotStatus: source.status,
        executionCount: source.executions.length,
        ledgerEntryCount: entries.length,
        autoExecute: false,
        verifiedCount: entries.filter((entry) => entry.status === 'post_run_verified').length,
        rollbackRequiredCount: entries.filter((entry) => entry.rollback.rollbackRequired).length,
        rollbackInvoked: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightPostRunRollbackLedgerSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-post-run] Fase 77 - Real Apply Post-Run Verification And Rollback Ledger');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`ledgerEntries: ${snapshot.entries.length}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveBaseBlockers(
    execution: CapabilityPreflightControlledRealApplyExecution,
    gates: {
      postRunVerificationConfirmed: boolean;
      rollbackLedgerPersisted: boolean;
      auditPersisted: boolean;
      rollbackRequired: boolean;
      rollbackAvailable: boolean;
    },
  ): string[] {
    const blockers = [...execution.blockers];
    if (execution.status !== 'controlled_apply_succeeded') {
      blockers.push(`controlled_execution_not_succeeded:${execution.status}`);
    }
    if (!execution.adapterInvoked || !execution.realApplyInvoked || !execution.applyInvoked || !execution.dispatchExecuted) {
      blockers.push('controlled_apply_invocation_evidence_required');
    }
    if (!execution.sideEffectInvoked) {
      blockers.push('side_effect_evidence_required');
    }
    if (!gates.postRunVerificationConfirmed) {
      blockers.push('post_run_verification_confirmation_required');
    }
    if (!gates.rollbackLedgerPersisted) {
      blockers.push('rollback_ledger_persistence_required');
    }
    if (!gates.auditPersisted) {
      blockers.push('post_run_audit_persistence_required');
    }
    if (gates.rollbackRequired && !gates.rollbackAvailable) {
      blockers.push('rollback_token_required');
    }
    if (execution.shouldRunAutomatically !== false) {
      blockers.push('automatic_post_run_verification_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private resolveStatus(
    baseBlockers: string[],
    verificationPassed: boolean,
    rollbackRequired: boolean,
    rollbackAvailable: boolean,
  ): CapabilityPreflightPostRunRollbackLedgerStatus {
    if (baseBlockers.length > 0) {
      return 'blocked';
    }
    if (!verificationPassed) {
      return rollbackRequired && rollbackAvailable ? 'rollback_required' : 'blocked';
    }
    return 'post_run_verified';
  }

  private resolveEntryBlockers(baseBlockers: string[], verificationPassed: boolean): string[] {
    const blockers = [...baseBlockers];
    if (!verificationPassed) {
      blockers.push('post_run_verification_failed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightControlledRealApplyExecutorSnapshot,
    entries: CapabilityPreflightPostRunRollbackLedgerEntry[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, entries });
    const blocked = entries.filter((entry) => entry.status === 'blocked');
    const rollbackRequired = entries.filter((entry) => entry.status === 'rollback_required');

    return [
      this.check(
        'capability-autopilot-preflight-post-run:coverage',
        'ledger entry por controlled execution',
        entries.length === source.executions.length && blocked.length === 0 && rollbackRequired.length === 0 ? 'pass' : 'fail',
        'Cada controlled execution precisa gerar ledger entry verificado.',
        [
          `executions=${source.executions.length}`,
          `entries=${entries.length}`,
          `blocked=${blocked.length}`,
          `rollbackRequired=${rollbackRequired.length}`,
          ...blocked.map((entry) => `${entry.sourceSurface}:${entry.blockers.join('|')}`),
          ...rollbackRequired.map((entry) => `${entry.sourceSurface}:${entry.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-post-run:source-controlled',
        'fonte controlada concluida',
        entries.every((entry) =>
          entry.sourceExecutionStatus === 'controlled_apply_succeeded' &&
          entry.sourceSideEffectInvoked &&
          entry.sourceAdapterReceiptId !== null
        ) ? 'pass' : 'fail',
        'Post-run so pode verificar execucoes controladas bem-sucedidas.',
        entries.map((entry) =>
          `${entry.sourceSurface}:${entry.sourceAction?.kind || '<none>'}:status=${entry.sourceExecutionStatus}:sideEffect=${entry.sourceSideEffectInvoked}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-post-run:verification',
        'post-run verificado',
        entries.every((entry) =>
          entry.postRunVerificationConfirmed &&
          entry.verificationPassed &&
          entry.postRunVerified
        ) ? 'pass' : 'fail',
        'Resultado real precisa ser verificado antes de fechar a execucao.',
        entries.map((entry) =>
          `${entry.sourceSurface}:${entry.sourceAction?.kind || '<none>'}:confirmed=${entry.postRunVerificationConfirmed}:verified=${entry.postRunVerified}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-post-run:rollback-ledger',
        'rollback ledger persistido',
        entries.every((entry) =>
          entry.rollbackLedgerPersisted &&
          entry.rollback.rollbackLedgerId !== null &&
          (!entry.rollback.rollbackRequired || (entry.rollback.rollbackAvailable && entry.rollback.rollbackToken !== null))
        ) ? 'pass' : 'fail',
        'Toda execucao com side effect precisa deixar rollback token no ledger.',
        entries.map((entry) =>
          `${entry.sourceSurface}:rollbackRequired=${entry.rollback.rollbackRequired}:available=${entry.rollback.rollbackAvailable}:ledger=${entry.rollback.rollbackLedgerId || '<none>'}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-post-run:audit',
        'auditoria pos-run persistida',
        entries.every((entry) =>
          entry.auditPersisted &&
          entry.audit.auditReceiptId !== null &&
          entry.audit.postRunReceiptId !== null &&
          entry.audit.verificationReceiptId !== null
        ) ? 'pass' : 'fail',
        'Post-run precisa registrar audit receipt, verification receipt e post-run receipt.',
        entries.map((entry) =>
          `${entry.sourceSurface}:audit=${entry.audit.auditReceiptId || '<none>'}:verification=${entry.audit.verificationReceiptId || '<none>'}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-post-run:no-auto-rollback',
        'rollback nao invocado automaticamente',
        entries.every((entry) =>
          entry.rollback.rollbackInvoked === false &&
          entry.shouldRunAutomatically === false &&
          entry.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'A Fase 77 registra rollback ledger, mas nao dispara rollback automatico.',
        entries.map((entry) =>
          `${entry.sourceSurface}:rollbackInvoked=${entry.rollback.rollbackInvoked}:auto=${entry.shouldRunAutomatically}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-post-run:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Snapshots publicos pos-run nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildPostRunLedgerEntryId(
    execution: CapabilityPreflightControlledRealApplyExecution,
    generatedAt: string,
    postRunReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        execution.capabilityId,
        execution.sourceSurface,
        execution.controlledExecutionId,
        execution.sourceAction?.id || '<none>',
        execution.adapterResult?.adapterReceiptId || '<none>',
        generatedAt,
        postRunReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${execution.capabilityId}-post-run-ledger-${digest}`;
  }

  private buildEvidence(
    execution: CapabilityPreflightControlledRealApplyExecution,
    data: {
      verificationPassed: boolean;
      rollbackRequired: boolean;
      rollbackAvailable: boolean;
      rollbackLedgerPersisted: boolean;
      auditPersisted: boolean;
      rollbackToken: string | null;
    },
  ): string[] {
    return [
      `controlledExecutionId=${execution.controlledExecutionId}`,
      `adapterReceiptId=${execution.adapterResult?.adapterReceiptId || '<none>'}`,
      `sideEffectInvoked=${execution.sideEffectInvoked}`,
      `verificationPassed=${data.verificationPassed}`,
      `rollbackRequired=${data.rollbackRequired}`,
      `rollbackAvailable=${data.rollbackAvailable}`,
      `rollbackToken=${data.rollbackToken || '<none>'}`,
      `rollbackLedgerPersisted=${data.rollbackLedgerPersisted}`,
      `auditPersisted=${data.auditPersisted}`,
    ];
  }

  private buildSafeSummary(
    execution: CapabilityPreflightControlledRealApplyExecution,
    status: CapabilityPreflightPostRunRollbackLedgerStatus,
  ): string {
    if (status === 'post_run_verified') {
      return `Post-run verificado para ${execution.sourceAction?.kind || '<sem-action>'}; rollback token registrado.`;
    }
    if (status === 'rollback_required') {
      return `Post-run falhou para ${execution.sourceAction?.kind || '<sem-action>'}; rollback disponivel no ledger.`;
    }
    return `Post-run bloqueado para ${execution.sourceAction?.kind || '<sem-action>'}; ledger incompleto.`;
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
