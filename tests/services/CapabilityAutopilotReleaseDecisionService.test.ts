import {
  CapabilityAutopilotReleaseDecisionService,
  type CapabilityAutopilotReleaseGateEvidence,
} from '../../src/services/CapabilityAutopilotReleaseDecisionService';

const FIXED_NOW = new Date('2026-04-26T00:30:00.000Z');

function createService() {
  return new CapabilityAutopilotReleaseDecisionService({
    now: () => FIXED_NOW,
  });
}

describe('CapabilityAutopilotReleaseDecisionService', () => {
  it('ships v1.1 behind a feature flag when every required gate passed with medium risk', () => {
    const service = createService();

    const snapshot = service.buildDecision({
      evidence: service.defaultEvidence(),
    });

    expect(snapshot).toMatchObject({
      versionCandidate: 'v1.1.0',
      decision: 'ship_v1_1_flagged',
      releaseChannel: 'alpha',
      riskPosture: 'medium',
      featureFlag: {
        name: 'ZAVORTH_CAPABILITY_AUTOPILOT',
        defaultEnabled: false,
      },
      metadata: {
        gate: 'capability-autopilot-fallback-handoff',
        baseline: 'v1.0.0',
      },
    });
    expect(snapshot.passedCheckpoints).toEqual([
      'capability-autopilot-preflight-diagnosis',
      'capability-autopilot-repair-runner',
      'capability-autopilot-validation-resume',
      'capability-autopilot-cross-surface-ux',
      'capability-autopilot-memory-replay',
      'capability-autopilot-provider-expansion',
    ]);
    expect(snapshot.missingCheckpoints).toEqual([]);
    expect(snapshot.failedCheckpoints).toEqual([]);
    expect(snapshot.guardrails).toEqual(expect.arrayContaining([
      'Fallback requires explicit user selection and permission when sensitive.',
      'Memory/replay stores hashes and redacted lessons, not raw intent or workspace.',
    ]));
  });

  it('requires more evidence when a gate is missing', () => {
    const service = createService();
    const evidence = service.defaultEvidence().filter((entry) => entry.id !== 'capability-autopilot-memory-replay');

    const snapshot = service.buildDecision({ evidence });

    expect(snapshot).toMatchObject({
      decision: 'needs_more_evidence',
      releaseChannel: 'backlog',
      missingCheckpoints: ['capability-autopilot-memory-replay'],
      featureFlag: {
        defaultEnabled: false,
      },
    });
    expect(snapshot.rolloutPlan[0]).toContain('Do not include');
  });

  it('holds the feature in backlog when a required gate failed', () => {
    const service = createService();
    const evidence: CapabilityAutopilotReleaseGateEvidence[] = service.defaultEvidence().map((entry) =>
      entry.id === 'capability-autopilot-provider-expansion'
        ? { ...entry, passed: false, summary: 'Provider expansion gate failed.', risk: 'high' }
        : entry,
    );

    const snapshot = service.buildDecision({ evidence });

    expect(snapshot).toMatchObject({
      decision: 'hold_backlog',
      riskPosture: 'high',
      releaseChannel: 'backlog',
      failedCheckpoints: ['capability-autopilot-provider-expansion'],
      featureFlag: {
        defaultEnabled: false,
      },
    });
    expect(snapshot.rollbackPlan).toEqual(['No rollback required because the feature remains out of release.']);
  });

  it('only allows default-on when risk is low and explicitly requested', () => {
    const service = createService();
    const lowRiskEvidence = service.defaultEvidence().map((entry) => ({
      ...entry,
      risk: 'low' as const,
    }));

    const snapshot = service.buildDecision({
      evidence: lowRiskEvidence,
      allowDefaultOn: true,
    });

    expect(snapshot).toMatchObject({
      decision: 'ship_v1_1_default_on',
      releaseChannel: 'beta',
      riskPosture: 'low',
      featureFlag: {
        defaultEnabled: true,
      },
    });
  });
});
