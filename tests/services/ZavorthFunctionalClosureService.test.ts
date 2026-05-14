import type { ZavorthFunctionalClosureItem } from '../../src/contracts/ZavorthFunctionalClosureContract.js';
import { ZavorthFunctionalClosureDashboardService } from '../../src/services/ZavorthFunctionalClosureDashboardService.js';
import { ZavorthFunctionalClosureService } from '../../src/services/ZavorthFunctionalClosureService.js';
import { ZavorthFunctionalReleaseGateService } from '../../src/services/ZavorthFunctionalReleaseGateService.js';
import { ZavorthLedgerDecisionUpdaterService } from '../../src/services/ZavorthLedgerDecisionUpdaterService.js';

describe('ZavorthFunctionalClosureService Phase 9', () => {
  const now = () => new Date('2026-05-05T21:00:00.000Z');

  it('builds dashboard rows with category status, risk and receipts', () => {
    const items = [
      item({
        id: 'p0-ok',
        priority: 'P0',
        status: 'pass',
        risk: 'none',
        receiptCount: 1,
      }),
      item({
        id: 'p1-attention',
        priority: 'P1',
        status: 'warn',
        risk: 'attention',
        receiptCount: 1,
      }),
    ];

    const dashboard = new ZavorthFunctionalClosureDashboardService({
      now,
    }).buildSnapshot(items);

    expect(dashboard.status).toBe('warn');
    expect(dashboard.categoryRows).toHaveLength(2);
    expect(dashboard.riskRows).toEqual([
      expect.objectContaining({
        itemId: 'p1-attention',
        risk: 'attention',
      }),
    ]);
    expect(dashboard.report).toContain('Zavorth Functional Closure Dashboard');
    expect(dashboard.report).toContain('phase 1');
  });

  it('previews ledger decision updates only when receipts exist', () => {
    const updater = new ZavorthLedgerDecisionUpdaterService({
      now,
    }).buildSnapshot([
      item({
        id: 'receipt-backed',
        receiptCount: 1,
      }),
      item({
        id: 'missing-receipt',
        receiptCount: 0,
      }),
    ]);

    expect(updater.status).toBe('warn');
    expect(updater.previewOnly).toBe(true);
    expect(updater.updatesApplied).toBe(false);
    expect(updater.blockedUpdates).toBe(1);
    expect(updater.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemId: 'receipt-backed',
        canUpdate: true,
        receiptBacked: true,
      }),
      expect.objectContaining({
        itemId: 'missing-receipt',
        canUpdate: false,
        receiptBacked: false,
      }),
    ]));
  });

  it('blocks release when a P0 item regresses', () => {
    const gate = new ZavorthFunctionalReleaseGateService({
      now,
    }).buildSnapshot([
      item({
        id: 'p0-ok',
        priority: 'P0',
        status: 'pass',
        receiptCount: 1,
      }),
      item({
        id: 'p0-failed',
        priority: 'P0',
        status: 'fail',
        risk: 'blocking',
        receiptCount: 1,
      }),
    ]);

    expect(gate.status).toBe('failed');
    expect(gate.releaseAllowed).toBe(false);
    expect(gate.p0.blocking).toBe(1);
    expect(gate.blockers).toEqual(expect.arrayContaining([
      'p0-failed failed its functional proof.',
    ]));
  });

  it('emits a passing machine-readable full functional closure receipt', async () => {
    const service = new ZavorthFunctionalClosureService({
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

    const closure = await service.buildSnapshot();
    const text = service.formatSnapshotText(closure);

    expect(closure.status).toBe('passed');
    expect(closure.phase).toBe(9);
    expect(closure.summary).toEqual(expect.objectContaining({
      items: 10,
      p0Items: 6,
      p1Items: 3,
      p2Items: 1,
      failed: 0,
      receipts: 10,
      receiptBackedItems: 10,
      releaseAllowed: true,
      machineReadableReceipt: true,
      liveExternalIoPerformed: false,
      secretValuesSerialized: false,
    }));
    expect(closure.releaseGate).toEqual(expect.objectContaining({
      status: 'passed',
      releaseAllowed: true,
      blockers: [],
    }));
    expect(closure.ledgerDecisionUpdater.blockedUpdates).toBe(0);
    expect(closure.dashboard.report).toContain('phase 8 skill-ecosystem');
    expect(closure.commands.nextStep).toBe('Functional absorption closure complete');
    expect(text).toContain('Zavorth Functional Closure - Phase 9');
    expect(text).toContain('Next: Functional absorption closure complete');
  });
});

function snapshot(status: string, summary: Record<string, unknown>) {
  return {
    status,
    summary,
  };
}

function item(input: Partial<ZavorthFunctionalClosureItem>): ZavorthFunctionalClosureItem {
  const receiptCount = input.receiptCount ?? 1;
  return {
    id: input.id || 'item',
    phase: input.phase || 1,
    label: input.label || input.id || 'item',
    category: input.category || 'category',
    priority: input.priority || 'P1',
    decision: input.decision || 'implemented',
    status: input.status || 'pass',
    command: input.command || 'npm run example --silent',
    receiptIds: receiptCount > 0 ? ['receipt-1'] : [],
    receiptCount,
    risk: input.risk || 'none',
    observed: input.observed || 'observed',
    required: input.required || 'required',
    notes: input.notes || ['note'],
    sourceSummary: input.sourceSummary || {},
  };
}
