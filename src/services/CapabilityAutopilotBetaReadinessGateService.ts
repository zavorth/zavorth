import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightPostRunRollbackLedgerEntry,
  CapabilityPreflightPostRunRollbackLedgerSnapshot,
} from './CapabilityAutopilotPreflightPostRunRollbackLedgerService.js';

export type CapabilityAutopilotBetaReadinessStatus =
  | 'beta_candidate_ready'
  | 'blocked';

export type CapabilityAutopilotBetaReadinessRecommendation =
  | 'promote_to_beta_candidate'
  | 'stay_alpha';

export type CapabilityAutopilotBetaReadinessOptions = {
  betaChecklistApproved?: boolean;
  releaseNotesReady?: boolean;
  featureFlagDefaultOff?: boolean;
  rollbackDrillReady?: boolean;
  telemetryOptInReady?: boolean;
  docsUpdated?: boolean;
  minVerifiedEntries?: number;
  actorId?: string | null;
  betaReadinessReceiptId?: string | null;
  releaseChecklistId?: string | null;
  flagPolicyId?: string | null;
  rollbackDrillReceiptId?: string | null;
  telemetryReceiptId?: string | null;
  docsReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotBetaReadinessEntrySummary = {
  sourceSurface: CapabilityPreflightPostRunRollbackLedgerEntry['sourceSurface'];
  sourceActionKind: string | null;
  postRunVerified: boolean;
  rollbackAvailable: boolean;
  rollbackInvoked: false;
  auditPersisted: boolean;
  rollbackLedgerPersisted: boolean;
  status: CapabilityPreflightPostRunRollbackLedgerEntry['status'];
};

export type CapabilityAutopilotBetaReadinessSnapshot = {
  phase: '78';
  betaReadinessId: string;
  generatedAt: string;
  surface: 'capability-autopilot-beta-readiness-gate';
  capabilityId: string;
  status: CapabilityAutopilotBetaReadinessStatus;
  recommendation: CapabilityAutopilotBetaReadinessRecommendation;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityPreflightPostRunRollbackLedgerSnapshot['phase'];
  sourceStatus: CapabilityPreflightPostRunRollbackLedgerSnapshot['status'];
  betaChecklistApproved: boolean;
  releaseNotesReady: boolean;
  featureFlagDefaultOff: boolean;
  rollbackDrillReady: boolean;
  telemetryOptInReady: boolean;
  docsUpdated: boolean;
  minVerifiedEntries: number;
  verifiedEntries: number;
  rollbackRequiredEntries: number;
  rollbackAvailableEntries: number;
  rollbackInvokedEntries: number;
  auditPersistedEntries: number;
  rollbackLedgerPersistedEntries: number;
  entrySummaries: CapabilityAutopilotBetaReadinessEntrySummary[];
  blockers: string[];
  checks: CapabilityAutopilotPreflightCheck[];
  releaseControls: {
    betaReadinessReceiptId: string | null;
    releaseChecklistId: string | null;
    flagPolicyId: string | null;
    rollbackDrillReceiptId: string | null;
    telemetryReceiptId: string | null;
    docsReceiptId: string | null;
  };
  audit: {
    sourceGeneratedAt: string;
    actorId: string | null;
    reason: string | null;
  };
  nextRecommendedPhase: {
    phase: '79';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotBetaReadinessGateRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotBetaReadinessGateService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotBetaReadinessGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildReadinessSnapshot(
    source: CapabilityPreflightPostRunRollbackLedgerSnapshot,
    options: CapabilityAutopilotBetaReadinessOptions = {},
  ): CapabilityAutopilotBetaReadinessSnapshot {
    const generatedAt = this.now().toISOString();
    const minVerifiedEntries = this.resolveMinVerifiedEntries(source, options);
    const entrySummaries = source.entries.map((entry) => this.summarizeEntry(entry));
    const verifiedEntries = source.entries.filter((entry) => entry.status === 'post_run_verified' && entry.postRunVerified).length;
    const rollbackRequiredEntries = source.entries.filter((entry) => entry.rollback.rollbackRequired).length;
    const rollbackAvailableEntries = source.entries.filter((entry) =>
      !entry.rollback.rollbackRequired || (entry.rollback.rollbackAvailable && entry.rollback.rollbackToken !== null)
    ).length;
    const rollbackInvokedEntries = source.entries.filter((entry) => entry.rollback.rollbackInvoked).length;
    const auditPersistedEntries = source.entries.filter((entry) => entry.auditPersisted && entry.audit.auditReceiptId !== null).length;
    const rollbackLedgerPersistedEntries = source.entries.filter((entry) =>
      entry.rollbackLedgerPersisted && entry.rollback.rollbackLedgerId !== null
    ).length;
    const gateBooleans = this.resolveGateBooleans(options);
    const blockers = this.resolveBlockers(source, {
      ...gateBooleans,
      minVerifiedEntries,
      verifiedEntries,
      rollbackRequiredEntries,
      rollbackAvailableEntries,
      rollbackInvokedEntries,
      auditPersistedEntries,
      rollbackLedgerPersistedEntries,
    });
    const checks = this.buildChecks(source, entrySummaries, {
      ...gateBooleans,
      minVerifiedEntries,
      verifiedEntries,
      rollbackRequiredEntries,
      rollbackAvailableEntries,
      rollbackInvokedEntries,
      auditPersistedEntries,
      rollbackLedgerPersistedEntries,
      blockers,
    });
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const status: CapabilityAutopilotBetaReadinessStatus = failed > 0 || blockers.length > 0 ? 'blocked' : 'beta_candidate_ready';
    const recommendation: CapabilityAutopilotBetaReadinessRecommendation = status === 'beta_candidate_ready'
      ? 'promote_to_beta_candidate'
      : 'stay_alpha';

    return {
      phase: '78',
      betaReadinessId: this.buildBetaReadinessId(source, generatedAt, options.betaReadinessReceiptId || null),
      generatedAt,
      surface: 'capability-autopilot-beta-readiness-gate',
      capabilityId: source.capabilityId,
      status,
      recommendation,
      summary: {
        ok: status === 'beta_candidate_ready',
        passed,
        warnings,
        failed,
      },
      sourceSnapshotPhase: source.phase,
      sourceStatus: source.status,
      betaChecklistApproved: gateBooleans.betaChecklistApproved,
      releaseNotesReady: gateBooleans.releaseNotesReady,
      featureFlagDefaultOff: gateBooleans.featureFlagDefaultOff,
      rollbackDrillReady: gateBooleans.rollbackDrillReady,
      telemetryOptInReady: gateBooleans.telemetryOptInReady,
      docsUpdated: gateBooleans.docsUpdated,
      minVerifiedEntries,
      verifiedEntries,
      rollbackRequiredEntries,
      rollbackAvailableEntries,
      rollbackInvokedEntries,
      auditPersistedEntries,
      rollbackLedgerPersistedEntries,
      entrySummaries,
      blockers,
      checks,
      releaseControls: {
        betaReadinessReceiptId: options.betaReadinessReceiptId || null,
        releaseChecklistId: options.releaseChecklistId || null,
        flagPolicyId: options.flagPolicyId || null,
        rollbackDrillReceiptId: options.rollbackDrillReceiptId || null,
        telemetryReceiptId: options.telemetryReceiptId || null,
        docsReceiptId: options.docsReceiptId || null,
      },
      audit: {
        sourceGeneratedAt: source.generatedAt,
        actorId: options.actorId || null,
        reason: options.reason || null,
      },
      nextRecommendedPhase: {
        phase: '79',
        title: 'Capability Autopilot Beta Field Trial Loop',
        reason:
          'Depois do beta readiness, o proximo passo e operar um field trial limitado com feedback, rollback rehearsal e criterio de promocao para release candidate.',
      },
      metadata: {
        phase: 'capability-autopilot-checkpoint-78',
        sourceSnapshotStatus: source.status,
        autoExecute: false,
        recommendation,
        betaCandidateReady: status === 'beta_candidate_ready',
        entryCount: source.entries.length,
        verifiedEntries,
        rollbackRequiredEntries,
        rollbackInvokedEntries,
      },
    };
  }

  public renderReport(snapshot: CapabilityAutopilotBetaReadinessSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-beta-readiness] Etapa 78 - Capability Autopilot v1.1 Beta Readiness Gate');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`recommendation: ${snapshot.recommendation}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`verifiedEntries: ${snapshot.verifiedEntries}/${snapshot.minVerifiedEntries}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveGateBooleans(options: CapabilityAutopilotBetaReadinessOptions) {
    return {
      betaChecklistApproved: options.betaChecklistApproved === true,
      releaseNotesReady: options.releaseNotesReady === true,
      featureFlagDefaultOff: options.featureFlagDefaultOff === true,
      rollbackDrillReady: options.rollbackDrillReady === true,
      telemetryOptInReady: options.telemetryOptInReady === true,
      docsUpdated: options.docsUpdated === true,
    };
  }

  private resolveMinVerifiedEntries(
    source: CapabilityPreflightPostRunRollbackLedgerSnapshot,
    options: CapabilityAutopilotBetaReadinessOptions,
  ): number {
    const requested = options.minVerifiedEntries;
    if (typeof requested === 'number' && Number.isFinite(requested) && requested >= 0) {
      return requested;
    }
    return source.entries.length;
  }

  private summarizeEntry(
    entry: CapabilityPreflightPostRunRollbackLedgerEntry,
  ): CapabilityAutopilotBetaReadinessEntrySummary {
    return {
      sourceSurface: entry.sourceSurface,
      sourceActionKind: entry.sourceAction?.kind || null,
      postRunVerified: entry.postRunVerified,
      rollbackAvailable: entry.rollback.rollbackAvailable,
      rollbackInvoked: false,
      auditPersisted: entry.auditPersisted,
      rollbackLedgerPersisted: entry.rollbackLedgerPersisted,
      status: entry.status,
    };
  }

  private resolveBlockers(
    source: CapabilityPreflightPostRunRollbackLedgerSnapshot,
    data: {
      betaChecklistApproved: boolean;
      releaseNotesReady: boolean;
      featureFlagDefaultOff: boolean;
      rollbackDrillReady: boolean;
      telemetryOptInReady: boolean;
      docsUpdated: boolean;
      minVerifiedEntries: number;
      verifiedEntries: number;
      rollbackRequiredEntries: number;
      rollbackAvailableEntries: number;
      rollbackInvokedEntries: number;
      auditPersistedEntries: number;
      rollbackLedgerPersistedEntries: number;
    },
  ): string[] {
    const blockers: string[] = [];
    if (source.status !== 'ready' || !source.summary.ok) {
      blockers.push(`source_post_run_not_ready:${source.status}`);
    }
    if (source.entries.length === 0) {
      blockers.push('post_run_entries_required');
    }
    if (data.verifiedEntries < data.minVerifiedEntries) {
      blockers.push('min_verified_entries_not_met');
    }
    if (data.rollbackAvailableEntries < source.entries.length) {
      blockers.push('rollback_not_available_for_all_entries');
    }
    if (data.rollbackInvokedEntries > 0) {
      blockers.push('rollback_already_invoked');
    }
    if (data.auditPersistedEntries < source.entries.length) {
      blockers.push('post_run_audit_incomplete');
    }
    if (data.rollbackLedgerPersistedEntries < source.entries.length) {
      blockers.push('rollback_ledger_incomplete');
    }
    if (!data.betaChecklistApproved) {
      blockers.push('beta_checklist_required');
    }
    if (!data.releaseNotesReady) {
      blockers.push('release_notes_required');
    }
    if (!data.featureFlagDefaultOff) {
      blockers.push('feature_flag_default_off_required');
    }
    if (!data.rollbackDrillReady) {
      blockers.push('rollback_drill_required');
    }
    if (!data.telemetryOptInReady) {
      blockers.push('telemetry_opt_in_required');
    }
    if (!data.docsUpdated) {
      blockers.push('docs_update_required');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightPostRunRollbackLedgerSnapshot,
    entrySummaries: CapabilityAutopilotBetaReadinessEntrySummary[],
    data: {
      betaChecklistApproved: boolean;
      releaseNotesReady: boolean;
      featureFlagDefaultOff: boolean;
      rollbackDrillReady: boolean;
      telemetryOptInReady: boolean;
      docsUpdated: boolean;
      minVerifiedEntries: number;
      verifiedEntries: number;
      rollbackRequiredEntries: number;
      rollbackAvailableEntries: number;
      rollbackInvokedEntries: number;
      auditPersistedEntries: number;
      rollbackLedgerPersistedEntries: number;
      blockers: string[];
    },
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, entrySummaries });

    return [
      this.check(
        'capability-autopilot-beta-readiness:source-ready',
        'post-run source ready',
        source.status === 'ready' && source.summary.ok && source.entries.length > 0 ? 'pass' : 'fail',
        'Beta readiness so pode partir de post-run ledger pronto.',
        [
          `sourceStatus=${source.status}`,
          `sourceOk=${source.summary.ok}`,
          `entries=${source.entries.length}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-readiness:verified-entries',
        'entradas verificadas suficientes',
        data.verifiedEntries >= data.minVerifiedEntries ? 'pass' : 'fail',
        'Todas as entradas exigidas precisam estar post-run verified.',
        [
          `verifiedEntries=${data.verifiedEntries}`,
          `minVerifiedEntries=${data.minVerifiedEntries}`,
          ...entrySummaries.map((entry) => `${entry.sourceSurface}:${entry.sourceActionKind || '<none>'}:verified=${entry.postRunVerified}`),
        ],
      ),
      this.check(
        'capability-autopilot-beta-readiness:rollback-ready',
        'rollback disponivel e nao invocado',
        data.rollbackAvailableEntries === source.entries.length && data.rollbackInvokedEntries === 0 ? 'pass' : 'fail',
        'Beta exige rollback ledger completo e nenhum rollback ja disparado.',
        [
          `rollbackRequiredEntries=${data.rollbackRequiredEntries}`,
          `rollbackAvailableEntries=${data.rollbackAvailableEntries}`,
          `rollbackInvokedEntries=${data.rollbackInvokedEntries}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-readiness:audit-ledger',
        'auditoria e ledger persistidos',
        data.auditPersistedEntries === source.entries.length && data.rollbackLedgerPersistedEntries === source.entries.length ? 'pass' : 'fail',
        'Beta exige audit e rollback ledger persistidos para todas as entries.',
        [
          `auditPersistedEntries=${data.auditPersistedEntries}`,
          `rollbackLedgerPersistedEntries=${data.rollbackLedgerPersistedEntries}`,
          `entries=${source.entries.length}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-readiness:release-controls',
        'controles beta aprovados',
        data.betaChecklistApproved &&
          data.releaseNotesReady &&
          data.featureFlagDefaultOff &&
          data.rollbackDrillReady &&
          data.telemetryOptInReady &&
          data.docsUpdated
          ? 'pass'
          : 'fail',
        'Promocao beta exige checklist, notas, flag off por padrao, rollback drill, telemetria opt-in e docs.',
        [
          `betaChecklistApproved=${data.betaChecklistApproved}`,
          `releaseNotesReady=${data.releaseNotesReady}`,
          `featureFlagDefaultOff=${data.featureFlagDefaultOff}`,
          `rollbackDrillReady=${data.rollbackDrillReady}`,
          `telemetryOptInReady=${data.telemetryOptInReady}`,
          `docsUpdated=${data.docsUpdated}`,
        ],
      ),
      this.check(
        'capability-autopilot-beta-readiness:no-blockers',
        'sem blockers beta',
        data.blockers.length === 0 ? 'pass' : 'fail',
        'Nao pode haver blocker agregado para recomendar beta.',
        data.blockers.length > 0 ? data.blockers : ['blockers=0'],
      ),
      this.check(
        'capability-autopilot-beta-readiness:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Snapshot beta publico nao pode reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildBetaReadinessId(
    source: CapabilityPreflightPostRunRollbackLedgerSnapshot,
    generatedAt: string,
    betaReadinessReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        source.capabilityId,
        source.phase,
        source.generatedAt,
        source.entries.length,
        generatedAt,
        betaReadinessReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${source.capabilityId}-beta-readiness-${digest}`;
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
