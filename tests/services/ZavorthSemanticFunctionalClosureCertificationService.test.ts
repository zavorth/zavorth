import { ZavorthFunctionalClosureService } from '../../src/services/ZavorthFunctionalClosureService.js';
import { ZavorthSemanticFunctionalClosureCertificationService } from '../../src/services/ZavorthSemanticFunctionalClosureCertificationService.js';

describe('ZavorthSemanticFunctionalClosureCertificationService S9', () => {
  const now = () => new Date('2026-05-05T22:00:00.000Z');

  it('certifies S9 final functional closure semantics with release gate proof', async () => {
    const snapshot = await buildFixtureService().buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.semanticPhase).toBe('S9');
    expect(snapshot.closureStatus).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      semanticClaims: 39,
      covered: 35,
      ownerGated: 0,
      rejected: 4,
      gaps: 0,
      receiptBackedClaims: 39,
      itemClaimsCertified: 10,
      receiptClaimsCertified: 10,
      priorityPoliciesCertified: 4,
      decisionPoliciesCertified: 3,
      scenariosPassed: 4,
      closureItems: 10,
      closureReceipts: 10,
      p0Items: 6,
      p1Items: 3,
      p2Items: 1,
      passedItems: 10,
      warnedItems: 0,
      failedItems: 0,
      implemented: 8,
      optionalPacks: 2,
      releaseAllowed: true,
      releaseBlockers: 0,
      ledgerUpdatesPreviewOnly: true,
      ledgerUpdatesApplied: false,
      machineReadableReceipt: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
      sourceCodeCopied: false,
    }));
    expect(snapshot.policy).toEqual(expect.objectContaining({
      semanticClaimRequiredForEveryClosureItem: true,
      semanticClaimRequiredForEveryClosureReceipt: true,
      allP0ClosedWithProof: true,
      allP1ClosedWithPackOrOwnerDecision: true,
      allP2ClosedWithOptionalPathOrNonGoal: true,
      optionalPacksExplicit: true,
      ledgerUpdatesPreviewOnlyByDefault: true,
      releaseGateMustPass: true,
      defaultLedgerMutationRejected: true,
      releaseWithBlockersRejected: true,
      unreceiptedClosureRejected: true,
    }));
  });

  it('keeps closure items and optional-pack decisions explicit by semantic status', async () => {
    const snapshot = await buildFixtureService().buildSnapshot();

    expect(itemClaim(snapshot, 'checkpoint-0-ledger-governance')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P0',
      decision: 'implemented',
    }));
    expect(itemClaim(snapshot, 'checkpoint-8-skill-ecosystem')).toEqual(expect.objectContaining({
      status: 'covered',
      priority: 'P2',
      decision: 'optional-pack',
    }));
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'decision-closure-policy',
        status: 'covered',
        decision: 'implemented',
      }),
      expect.objectContaining({
        kind: 'decision-closure-policy',
        status: 'covered',
        decision: 'optional-pack',
      }),
      expect.objectContaining({
        kind: 'release-gate-policy',
        status: 'covered',
        expectedBehavior: 'Functional release gate passes only when P0/P1/P2 closure policies have no blockers.',
      }),
    ]));
  });

  it('certifies final closure scenarios without ledger mutation or live IO', async () => {
    const snapshot = await buildFixtureService().buildSnapshot();
    const scenarios = Object.fromEntries(snapshot.scenarios.map((scenario) => [scenario.id, scenario]));

    expect(scenarios['all-p0-closed-with-receipts']).toEqual(expect.objectContaining({
      status: 'passed',
      releaseAllowed: true,
    }));
    expect(scenarios['optional-packs-are-explicit']).toEqual(expect.objectContaining({
      status: 'passed',
      updatesApplied: false,
    }));
    expect(scenarios['ledger-updater-preview-only']).toEqual(expect.objectContaining({
      status: 'passed',
      updatesApplied: false,
    }));
    expect(scenarios['release-gate-allows-without-live-io']).toEqual(expect.objectContaining({
      status: 'passed',
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    }));
  });

  it('rejects unsafe closure behavior by policy instead of enabling it', async () => {
    const snapshot = await buildFixtureService().buildSnapshot();

    const unsafeClaims = snapshot.claims.filter((claim) => claim.kind === 'unsafe-closure-policy');
    expect(unsafeClaims).toHaveLength(4);
    expect(unsafeClaims.every((claim) => claim.status === 'rejected')).toBe(true);
    expect(snapshot.claims).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'unsafe-closure-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject default ledger mutation during semantic closure.',
      }),
      expect.objectContaining({
        kind: 'unsafe-closure-policy',
        status: 'rejected',
        expectedBehavior: 'The architecture must reject unreceipted functional closure items.',
      }),
    ]));
  });

  it('formats readable S9 operator and release gate summaries', async () => {
    const service = buildFixtureService();
    const snapshot = await service.buildSnapshot();
    const text = service.formatSnapshotText(snapshot);
    const gateText = service.formatReleaseGateText(snapshot);

    expect(text).toContain('Zavorth Semantic Functional Closure Certification - S9');
    expect(text).toContain('Status: passed');
    expect(text).toContain('Next: Semantic functional closure complete');
    expect(gateText).toContain('Zavorth Semantic Functional Closure Release Gate: passed');
    expect(gateText).toContain('Release allowed: true');
  });

  function buildFixtureService(): ZavorthSemanticFunctionalClosureCertificationService {
    const closureService = new ZavorthFunctionalClosureService({
      now,
      rootDir: 'C:/fixture/zavorth',
      sourceSurfaceLedgerService: {
        buildReceipt: () => snapshot('passed', {
          total: 332,
          discoveredSurfaces: 330,
          unclassifiedSurfaces: 0,
          validationErrors: 0,
        }),
      },
      pluginOsAbsorptionService: {
        buildSnapshot: () => snapshot('passed', {
          packagesFound: 4,
          declaredExports: 7,
          lifecycleReceipts: 4,
        }),
      },
      agentRuntimeBridgeService: {
        buildSnapshot: () => snapshot('passed', {
          bridgesReady: 1,
          bridgesOwnerGated: 4,
          enabledByDefault: false,
        }),
      },
      providerMeshExpansionService: {
        buildSnapshot: () => snapshot('passed', {
          adaptersReady: 6,
          adaptersOwnerGated: 2,
          liveIoPerformed: false,
        }),
      },
      channelMeshExpansionService: {
        buildSnapshot: () => snapshot('passed', {
          packs: 8,
          packsReadyOrReplaced: 8,
          ownerGatedPacks: 1,
        }),
      },
      memoryDocumentTerminalPackService: {
        buildSnapshot: async () => snapshot('passed', {
          memoryReceipts: 2,
          documentArtifacts: 2,
          dangerousCommandsBlocked: 2,
        }),
      },
      nativeCompanionDevicePackService: {
        buildSnapshot: async () => snapshot('passed', {
          targetsCovered: 4,
          targetsOwnerGated: 3,
          capabilityReceipts: 31,
        }),
      },
      qaSecurityReleaseCertificationPackService: {
        buildSnapshot: () => snapshot('passed', {
          families: 6,
          failFamilies: 0,
          receipts: 30,
        }),
      },
      skillEcosystemPackService: {
        buildSnapshot: () => snapshot('passed', {
          manifests: 13,
          connectorConcepts: 3,
          smokeTests: 26,
        }),
      },
      finalAbsorptionCertificationService: {
        buildSnapshot: () => snapshot('certified', {
          evidenceItems: 7,
          failed: 0,
          totalReceipts: 125,
        }),
      },
    });
    return new ZavorthSemanticFunctionalClosureCertificationService({
      now,
      closureService,
    });
  }
});

type Snapshot = Awaited<ReturnType<ZavorthSemanticFunctionalClosureCertificationService['buildSnapshot']>>;

function itemClaim(snapshot: Snapshot, itemId: string) {
  const claim = snapshot.claims.find((entry) =>
    entry.kind === 'closure-item-coverage' && entry.itemId === itemId,
  );
  if (!claim) {
    throw new Error(`missing item claim ${itemId}`);
  }
  return claim;
}

function snapshot(status: string, summary: Record<string, unknown>) {
  return {
    status,
    summary,
  };
}
