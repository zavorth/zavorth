import {
  validateZavorthMissionDefinition,
  validateZavorthMissionEvidence,
  verifyZavorthMission,
} from '../../src/services/ZavorthMissionVerificationService.js';
import type { ZavorthMissionDefinition, ZavorthMissionEvidence } from '../../src/contracts/runtime/ZavorthMissionContract.js';

const definition: ZavorthMissionDefinition = {
  objective: 'Deliver a working status endpoint.',
  expectedOutcome: 'The endpoint returns a successful health response.',
  completionCriteria: [{
    id: 'endpoint-ready',
    description: 'The endpoint passes its test and live probe.',
    requiredEvidence: ['test_result', 'service_probe'],
    minimumEvidenceCount: 2,
  }],
  boundaries: {
    workspaceRoots: ['/workspace'],
    allowedFilePatterns: ['src/**', 'tests/**'],
    deniedFilePatterns: ['**/.env'],
    allowedServices: ['local-api'],
    networkAccess: 'denied',
    maximumDurationMs: 60_000,
  },
  approvalRequirements: [],
  verificationRequirements: ['Run the targeted test.', 'Probe the local endpoint.'],
  stopConditions: ['Stop if a secret is detected.'],
  rollbackPlan: 'Restore the modified endpoint files.',
};

function evidence(overrides: Partial<ZavorthMissionEvidence>): ZavorthMissionEvidence {
  return {
    id: 'evidence-test',
    criterionId: 'endpoint-ready',
    kind: 'test_result',
    observedBy: 'verifier',
    capturedAt: '2026-07-14T03:00:00.000Z',
    status: 'passed',
    summary: 'Targeted test passed.',
    digest: 'a'.repeat(64),
    details: { exitCode: 0 },
    ...overrides,
  };
}

describe('ZavorthMissionVerificationService', () => {
  it('validates complete definitions and rejects executor claims as required evidence', () => {
    expect(validateZavorthMissionDefinition(definition)).toEqual({ ok: true, value: definition });
    expect(validateZavorthMissionDefinition({
      ...definition,
      completionCriteria: [{ ...definition.completionCriteria[0], requiredEvidence: ['executor_claim'] }],
    })).toMatchObject({ ok: false });
  });

  it('validates evidence dates, digests, and scalar details at runtime', () => {
    expect(validateZavorthMissionEvidence(evidence({}))).toMatchObject({ ok: true });
    expect(validateZavorthMissionEvidence(evidence({
      capturedAt: 'not-a-date',
      digest: 'not-a-digest',
      details: { nested: {} } as never,
    }))).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        'capturedAt must be an ISO-compatible date.',
        'digest must be null or a lowercase SHA-256 digest.',
        'details must contain only scalar JSON values.',
      ]),
    });
  });

  it('verifies every criterion only from complete independent evidence', () => {
    const receipt = verifyZavorthMission({
      missionId: 'mission-1',
      definition,
      verifiedAt: '2026-07-14T03:05:00.000Z',
      evidence: [
        evidence({}),
        evidence({ id: 'evidence-probe', kind: 'service_probe', observedBy: 'runtime', summary: 'Probe returned 200.' }),
      ],
    });
    expect(receipt).toMatchObject({
      status: 'verified',
      executorClaimsAccepted: false,
      criteria: [{ status: 'verified', acceptedEvidenceIds: ['evidence-test', 'evidence-probe'] }],
    });
    expect(receipt.evidenceDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does not accept executor reports as proof of completion', () => {
    const receipt = verifyZavorthMission({
      missionId: 'mission-1',
      definition,
      evidence: [
        evidence({ kind: 'executor_claim', observedBy: 'executor', summary: 'Executor says all work passed.' }),
      ],
    });
    expect(receipt.status).toBe('inconclusive');
    expect(receipt.criteria[0]).toMatchObject({
      acceptedEvidenceIds: [],
      rejectedEvidenceIds: ['evidence-test'],
    });
  });

  it('fails the mission when independently observed evidence fails', () => {
    const receipt = verifyZavorthMission({
      missionId: 'mission-1',
      definition,
      evidence: [evidence({ status: 'failed', summary: 'Targeted test failed.' })],
    });
    expect(receipt.status).toBe('failed');
    expect(receipt.criteria[0].reason).toBe('Independent evidence reported a failed check.');
  });

  it('rejects an invalid mission definition before verification', () => {
    expect(() => verifyZavorthMission({ missionId: 'mission-1', definition: {}, evidence: [] }))
      .toThrow('Invalid mission definition');
  });
});
