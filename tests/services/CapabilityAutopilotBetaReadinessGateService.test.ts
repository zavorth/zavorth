import {
  CapabilityAutopilotBetaReadinessGateService,
  type CapabilityAutopilotBetaReadinessOptions,
} from '../../src/services/CapabilityAutopilotBetaReadinessGateService';
import type {
  CapabilityPreflightPostRunRollbackLedgerEntry,
  CapabilityPreflightPostRunRollbackLedgerSnapshot,
} from '../../src/services/CapabilityAutopilotPreflightPostRunRollbackLedgerService';

const FIXED_NOW = new Date('2026-04-26T08:00:00.000Z');

const readyOptions: CapabilityAutopilotBetaReadinessOptions = {
  betaChecklistApproved: true,
  releaseNotesReady: true,
  featureFlagDefaultOff: true,
  rollbackDrillReady: true,
  telemetryOptInReady: true,
  docsUpdated: true,
  minVerifiedEntries: 2,
  actorId: 'release-operator',
  betaReadinessReceiptId: 'beta-readiness-1',
  releaseChecklistId: 'release-checklist-1',
  flagPolicyId: 'flag-policy-1',
  rollbackDrillReceiptId: 'rollback-drill-1',
  telemetryReceiptId: 'telemetry-1',
  docsReceiptId: 'docs-1',
  reason: 'checkpoint-78-test',
};

function createEntry(
  sourceSurface: CapabilityPreflightPostRunRollbackLedgerEntry['sourceSurface'],
  sourceActionKind: string,
  overrides: Partial<CapabilityPreflightPostRunRollbackLedgerEntry> = {},
): CapabilityPreflightPostRunRollbackLedgerEntry {
  return {
    stage: '77',
    postRunLedgerEntryId: `entry-${sourceSurface}-${sourceActionKind}`,
    generatedAt: FIXED_NOW.toISOString(),
    surface: 'capability-autopilot-preflight-post-run-rollback-ledger',
    status: 'post_run_verified',
    capabilityId: 'executor-gemini-cli',
    sourceExecutionGate: '76',
    sourceControlledExecutionId: `execution-${sourceSurface}-${sourceActionKind}`,
    sourceSurface,
    sourceAction: {
      id: `action-${sourceSurface}-${sourceActionKind}`,
      kind: sourceActionKind,
      label: sourceActionKind,
      requiresApproval: true,
      requiresValidation: true,
    } as CapabilityPreflightPostRunRollbackLedgerEntry['sourceAction'],
    invocationKind: sourceSurface === 'api' ? 'api_request_dry_run' : 'cli_command_dry_run',
    applyAdapterKind: sourceSurface === 'api' ? 'api_request_plan' : 'cli_apply_plan',
    dispatchMode: sourceSurface === 'api' ? 'api_operation' : 'cli_command',
    target: {
      route: sourceSurface === 'api' ? '/api/capabilities/executor-gemini-cli/autopilot/preflight/resume' : null,
      command: sourceSurface === 'cli' ? 'zavorth capability preflight' : null,
      callbackData: null,
      method: sourceSurface === 'api' ? 'POST' : null,
    } as CapabilityPreflightPostRunRollbackLedgerEntry['target'],
    sourceExecutionStatus: 'controlled_apply_succeeded',
    sourceSideEffectInvoked: true,
    sourceExecutedAgainstRealTarget: false,
    sourceAdapterReceiptId: `adapter-${sourceSurface}-${sourceActionKind}`,
    sourceAdapterMode: 'fixture',
    postRunVerificationConfirmed: true,
    postRunVerified: true,
    verificationPassed: true,
    auditPersisted: true,
    rollbackLedgerPersisted: true,
    shouldRunAutomatically: false,
    rollback: {
      rollbackRequired: true,
      rollbackAvailable: true,
      rollbackInvoked: false,
      rollbackToken: `rollback-${sourceSurface}-${sourceActionKind}`,
      rollbackPlanId: 'rollback-plan-1',
      rollbackLedgerId: 'rollback-ledger-1',
    },
    audit: {
      sourceExecutionGeneratedAt: FIXED_NOW.toISOString(),
      actorId: 'operator-1',
      postRunReceiptId: 'post-run-1',
      verificationReceiptId: 'verification-1',
      rollbackLedgerId: 'rollback-ledger-1',
      auditReceiptId: 'audit-1',
      reason: 'fixture',
    },
    blockers: [],
    evidence: [
      `entry=${sourceSurface}:${sourceActionKind}`,
      'verificationPassed=true',
      'rollbackAvailable=true',
    ],
    safeSummary: `Post-run verified for ${sourceActionKind}.`,
    metadata: {
      autoExecute: false,
      postRunVerified: true,
      rollbackRequired: true,
      rollbackAvailable: true,
      rollbackInvoked: false,
      auditPersisted: true,
      rollbackLedgerPersisted: true,
    },
    ...overrides,
  };
}

function createSource(
  entries: CapabilityPreflightPostRunRollbackLedgerEntry[] = [
    createEntry('cli', 'view_preflight'),
    createEntry('api', 'resume_after_check'),
  ],
  overrides: Partial<CapabilityPreflightPostRunRollbackLedgerSnapshot> = {},
): CapabilityPreflightPostRunRollbackLedgerSnapshot {
  return {
    stage: '77',
    surface: 'capability-autopilot-preflight-post-run-rollback-ledger',
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status: 'ready',
    summary: {
      ok: true,
      passed: 7,
      warnings: 0,
      failed: 0,
    },
    sourceSnapshotStage: '76',
    entries,
    checks: [],
    nextRecommendedGate: {
      stage: '78',
      title: 'Capability Autopilot v1.1 Beta Readiness Gate',
      reason: 'Decide beta readiness.',
    },
    metadata: {
      autoExecute: false,
      verifiedCount: entries.filter((entry) => entry.postRunVerified).length,
      rollbackInvoked: false,
    },
    ...overrides,
  };
}

function createService() {
  return new CapabilityAutopilotBetaReadinessGateService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotBetaReadinessGateService', () => {
  it('recommends beta promotion when post-run ledger and release controls are ready', () => {
    const service = createService();
    const source = createSource();

    const snapshot = service.buildReadinessSnapshot(source, readyOptions);

    expect(snapshot).toMatchObject({
      stage: '78',
      status: 'beta_candidate_ready',
      recommendation: 'promote_to_beta_candidate',
      summary: {
        ok: true,
        failed: 0,
      },
      releaseControls: {
        betaReadinessReceiptId: 'beta-readiness-1',
        releaseChecklistId: 'release-checklist-1',
        flagPolicyId: 'flag-policy-1',
      },
      metadata: {
        autoExecute: false,
        betaCandidateReady: true,
      },
    });
    expect(snapshot.verifiedEntries).toBe(2);
    expect(snapshot.rollbackAvailableEntries).toBe(2);
    expect(snapshot.rollbackInvokedEntries).toBe(0);
    expect(snapshot.entrySummaries.every((entry) => entry.postRunVerified)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('rawText');
    expect(JSON.stringify(snapshot)).not.toContain('normalizedText');
  });

  it('stays alpha when release controls are missing', () => {
    const service = createService();
    const source = createSource();

    const snapshot = service.buildReadinessSnapshot(source, {
      ...readyOptions,
      betaChecklistApproved: false,
      featureFlagDefaultOff: false,
      telemetryOptInReady: false,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.recommendation).toBe('stay_alpha');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'beta_checklist_required',
      'feature_flag_default_off_required',
      'telemetry_opt_in_required',
    ]));
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-beta-readiness:release-controls'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks beta readiness when minimum verified entry coverage is not met', () => {
    const service = createService();
    const source = createSource([
      createEntry('cli', 'view_preflight'),
      createEntry('api', 'resume_after_check', {
        status: 'rollback_required',
        postRunVerified: false,
        verificationPassed: false,
        blockers: ['post_run_verification_failed'],
      }),
    ]);

    const snapshot = service.buildReadinessSnapshot(source, {
      ...readyOptions,
      minVerifiedEntries: 2,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.verifiedEntries).toBe(1);
    expect(snapshot.blockers).toContain('min_verified_entries_not_met');
    expect(snapshot.checks.find((check) => check.id === 'capability-autopilot-beta-readiness:verified-entries'))
      .toMatchObject({
        status: 'fail',
      });
  });

  it('blocks beta readiness when rollback ledger or audit evidence is incomplete', () => {
    const service = createService();
    const incomplete = createEntry('api', 'resume_after_check', {
      auditPersisted: false,
      rollbackLedgerPersisted: false,
      rollback: {
        rollbackRequired: true,
        rollbackAvailable: false,
        rollbackInvoked: false,
        rollbackToken: null,
        rollbackPlanId: 'rollback-plan-1',
        rollbackLedgerId: null,
      },
      audit: {
        sourceExecutionGeneratedAt: FIXED_NOW.toISOString(),
        actorId: 'operator-1',
        postRunReceiptId: 'post-run-1',
        verificationReceiptId: 'verification-1',
        rollbackLedgerId: null,
        auditReceiptId: null,
        reason: 'fixture',
      },
    });
    const source = createSource([createEntry('cli', 'view_preflight'), incomplete]);

    const snapshot = service.buildReadinessSnapshot(source, readyOptions);

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.blockers).toEqual(expect.arrayContaining([
      'rollback_not_available_for_all_entries',
      'post_run_audit_incomplete',
      'rollback_ledger_incomplete',
    ]));
  });

  it('renders the next gate for beta field trial loop', () => {
    const service = createService();
    const snapshot = service.buildReadinessSnapshot(createSource(), readyOptions);

    expect(service.renderReport(snapshot)).toContain('Gate capability-autopilot-beta-readiness - Capability Autopilot v1.1 Beta Readiness Gate');
    expect(service.renderReport(snapshot)).toContain('next step recomendada: 79 - Capability Autopilot Beta Field Trial Loop');
  });
});
