import { gateMissionCompletion, gateRunCompletionFromMetadata } from '../../src/services/AgentMissionCompletionGate';
import type { ZavorthMissionDefinition, ZavorthMissionEvidence } from '../../src/contracts/runtime/ZavorthMissionContract';

const definition: ZavorthMissionDefinition = {
  objective: 'Ship health endpoint',
  expectedOutcome: 'Endpoint responds healthy',
  completionCriteria: [{
    id: 'health',
    description: 'Health check passes',
    requiredEvidence: ['test_result', 'service_probe'],
    minimumEvidenceCount: 2,
  }],
  boundaries: {
    workspaceRoots: ['.'],
    allowedFilePatterns: ['src/**'],
    deniedFilePatterns: ['**/.env'],
    allowedServices: ['api'],
    networkAccess: 'denied',
    maximumDurationMs: 60_000,
  },
  approvalRequirements: [],
  verificationRequirements: ['Independent probe'],
  stopConditions: ['Stop on secret'],
  rollbackPlan: null,
};

function evidence(partial: Partial<ZavorthMissionEvidence>): ZavorthMissionEvidence {
  return {
    id: 'e1',
    criterionId: 'health',
    kind: 'test_result',
    observedBy: 'verifier',
    capturedAt: '2026-07-14T04:00:00.000Z',
    status: 'passed',
    summary: 'ok',
    digest: 'a'.repeat(64),
    details: { exitCode: 0 },
    ...partial,
  };
}

describe('AgentMissionCompletionGate', () => {
  it('does not complete without independent evidence', () => {
    const result = gateMissionCompletion({
      missionId: 'm1',
      definition,
      evidence: [evidence({ kind: 'executor_claim', observedBy: 'executor' })],
      proposedStatus: 'completed',
    });
    expect(result.blocked).toBe(true);
    expect(result.allowedStatus).not.toBe('completed');
    expect(result.verification?.executorClaimsAccepted).toBe(false);
  });

  it('completes only when independent evidence verifies all criteria', () => {
    const result = gateMissionCompletion({
      missionId: 'm1',
      definition,
      evidence: [
        evidence({ id: 't1', kind: 'test_result', observedBy: 'verifier' }),
        evidence({ id: 'p1', kind: 'service_probe', observedBy: 'runtime', summary: '200' }),
      ],
      proposedStatus: 'completed',
    });
    expect(result.blocked).toBe(false);
    expect(result.allowedStatus).toBe('completed');
    expect(result.verification?.status).toBe('verified');
  });

  it('passes through non-completed statuses and runs without mission definition', () => {
    expect(gateMissionCompletion({
      missionId: 'm1',
      definition,
      evidence: [],
      proposedStatus: 'running',
    }).blocked).toBe(false);

    const noDef = gateRunCompletionFromMetadata({
      runId: 'run-1',
      proposedStatus: 'completed',
      metadata: {},
    });
    expect(noDef.blocked).toBe(false);
    expect(noDef.allowedStatus).toBe('completed');
  });
});
