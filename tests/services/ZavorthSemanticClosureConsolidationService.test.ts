import { ZavorthSemanticClosureConsolidationService } from '../../src/services/ZavorthSemanticClosureConsolidationService.js';
import type { ZavorthSemanticClosurePhaseId } from '../../src/contracts/ZavorthSemanticClosureConsolidationContract.js';

describe('ZavorthSemanticClosureConsolidationService', () => {
  const now = () => new Date('2026-05-05T23:00:00.000Z');

  it('consolidates S1-S9 semantic receipts into one release gate', async () => {
    const service = new ZavorthSemanticClosureConsolidationService({
      now,
      certifiers: fixtureCertifiers(),
    });
    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticScope).toBe('S1-S9');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      phases: 9,
      passed: 9,
      failed: 0,
      semanticClaims: 12,
      covered: 7,
      replaced: 1,
      ownerGated: 2,
      rejected: 2,
      gaps: 0,
      p0Claims: 9,
      p1Claims: 2,
      p2Claims: 1,
      receiptBackedClaims: 12,
      releaseAllowed: true,
      releaseBlockers: 0,
      machineReadableClosurePassed: true,
      functionalReleaseAllowed: true,
      liveExternalIoPerformed: false,
      runtimeExecutionPerformed: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
      enabledByDefault: false,
    }));
    expect(snapshot.phaseReceipts.map((receipt) => receipt.stage)).toEqual([
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
      'S6',
      'S7',
      'S8',
      'S9',
    ]);
    expect(snapshot.releaseGate).toEqual(expect.objectContaining({
      status: 'passed',
      releaseAllowed: true,
      phasesPassed: 9,
      phasesFailed: 0,
      allClaimsReceiptBacked: true,
      allPhaseClaimIdsUnique: true,
      allReceiptIdsValid: true,
      machineReadableClosurePassed: true,
      functionalReleaseAllowed: true,
      noLiveExternalIo: true,
      noRuntimeExecutionDuringCertification: true,
      noSecretValuesSerialized: true,
    }));
  });

  it('blocks release when any semantic phase regresses', async () => {
    const certifiers = fixtureCertifiers();
    certifiers.S4 = () => phaseSnapshot('S4', [
      claim('s4-gap', 'gap', 'P0'),
    ], {
      status: 'failed',
      gaps: 1,
    });
    const service = new ZavorthSemanticClosureConsolidationService({
      now,
      certifiers,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('failed');
    expect(snapshot.summary.failed).toBe(1);
    expect(snapshot.summary.gaps).toBe(1);
    expect(snapshot.releaseGate.releaseAllowed).toBe(false);
    expect(snapshot.releaseGate.blockers).toEqual(expect.arrayContaining([
      'S4: phase status is failed',
      'S4: phase has 1 semantic gap(s)',
    ]));
  });

  it('formats readable operator and release gate summaries', async () => {
    const service = new ZavorthSemanticClosureConsolidationService({
      now,
      certifiers: fixtureCertifiers(),
    });
    const snapshot = await service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);
    const gateText = service.formatReleaseGateText(snapshot);

    expect(text).toContain('Zavorth Semantic Closure Consolidation - S1-S9');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Gate receipts:');
    expect(gateText).toContain('Zavorth Semantic Closure Consolidation Release Gate: passed');
    expect(gateText).toContain('Phases passed: 9/9');
  });
});

function fixtureCertifiers() {
  return {
    S1: () => phaseSnapshot('S1', [
      claim('s1-covered', 'covered', 'P0'),
      claim('s1-replaced', 'replaced', 'P1'),
    ]),
    S2: () => phaseSnapshot('S2', [
      claim('s2-owner-gated', 'owner-gated', 'P0'),
    ]),
    S3: () => phaseSnapshot('S3', [
      claim('s3-covered', 'covered', 'P0'),
    ]),
    S4: () => phaseSnapshot('S4', [
      claim('s4-rejected', 'rejected', 'P0'),
    ]),
    S5: () => phaseSnapshot('S5', [
      claim('s5-covered', 'covered', 'P2'),
    ]),
    S6: () => phaseSnapshot('S6', [
      claim('s6-covered', 'covered', 'P0'),
    ]),
    S7: () => phaseSnapshot('S7', [
      claim('s7-covered', 'covered', 'P0'),
      claim('s7-rejected', 'rejected', 'P0'),
    ]),
    S8: () => phaseSnapshot('S8', [
      claim('s8-owner-gated', 'owner-gated', 'P1'),
    ]),
    S9: () => phaseSnapshot('S9', [
      claim('s9-covered-a', 'covered', 'P0'),
      claim('s9-covered-b', 'covered', 'P0'),
    ], {
      releaseAllowed: true,
      releaseBlockers: 0,
      machineReadableReceipt: true,
    }),
  };
}

function phaseSnapshot(
  stage: ZavorthSemanticClosurePhaseId,
  claims: ReturnType<typeof claim>[],
  overrides: Record<string, unknown> & { status-: 'passed' | 'failed' } = {},
) {
  const status = overrides.status || 'passed';
  const summary = {
    semanticClaims: claims.length,
    covered: claims.filter((entry) => entry.status === 'covered').length,
    replaced: claims.filter((entry) => entry.status === 'replaced').length,
    ownerGated: claims.filter((entry) => entry.status === 'owner-gated').length,
    rejected: claims.filter((entry) => entry.status === 'rejected').length,
    gaps: claims.filter((entry) => entry.status === 'gap').length,
    p0Claims: claims.filter((entry) => entry.priority === 'P0').length,
    p1Claims: claims.filter((entry) => entry.priority === 'P1').length,
    p2Claims: claims.filter((entry) => entry.priority === 'P2').length,
    receiptBackedClaims: claims.filter((entry) => entry.receiptIds.length > 0).length,
    liveExternalIoPerformed: false,
    liveExecutionPerformed: false,
    runtimeExecutionPerformed: false,
    secretValuesSerialized: false,
    sourceCodeCopied: false,
    enabledByDefault: false,
    ...overrides,
  };
  return {
    generatedAt: '2026-05-05T23:00:00.000Z',
    contractVersion: `fixture.${phase}`,
    status,
    semanticPhase: phase,
    statement: `${phase} fixture semantic statement`,
    claims,
    summary,
    commands: {
      inspect: `npm run fixture-${phase.toLowerCase()}`,
      inspectJson: `npm run fixture-${phase.toLowerCase()}:json`,
      check: `npm run fixture-${phase.toLowerCase()}:check`,
      qa: `npm run qa:fixture-${phase.toLowerCase()}`,
      nextAction: `${phase} next`,
      nextStep: `${phase} complete`,
    },
  };
}

function claim(
  id: string,
  status: 'covered' | 'replaced' | 'owner-gated' | 'rejected' | 'gap',
  priority: 'P0' | 'P1' | 'P2',
) {
  return {
    id,
    status,
    priority,
    receiptIds: [`receipt.${id}`],
  };
}
