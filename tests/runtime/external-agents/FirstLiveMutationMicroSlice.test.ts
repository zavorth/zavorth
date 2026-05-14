import fs from 'node:fs';
import path from 'node:path';

import {
  createFirstLiveMutationCandidateClassifications,
  createFirstLiveMutationReadOnlyDiscoveryEvidence,
  createFirstLiveMutationSafeTargetFixtureRecord,
  normalizeApprovedMutationExecutionHarnessFixture,
  normalizeFirstLiveMutationMicroSlice,
  normalizeFirstLiveMutationMicroSliceFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/181-wave-2-first-live-mutation-micro-slice.md';
const BOUNDARY = 'src/runtime/external-agents/ExternalAgentFirstLiveMutationMicroSlice.ts';
const INDEX = 'src/runtime/external-agents/index.ts';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('first live mutation micro-slice', () => {
  it('documents 181 as no-safe-live-mutation-target when no reversible target exists', () => {
    const content = read(DOC);

    expect(content).toContain('Status: no-safe-live-mutation-target');
    expect(content).toContain('gateway no-op/ping mutation');
    expect(content).toContain('temporary diagnostic marker');
    expect(content).toContain('ephemeral test setting');
    expect(content).toContain('no-safe-live-mutation-target');
    expect(content).toContain('mutationActuallyPerformed: false');
    expect(content).toContain('final cleanup listener count: 0');
    expect(content).toContain('final cleanup process count: 0');
    expect(content).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('exports the first live mutation boundary and public contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthFirstLiveMutationMicroSlice/v1');
    expect(boundary).toContain('ZavorthFirstLiveMutationExecutionReceipt/v1');
    expect(boundary).toContain('normalizeFirstLiveMutationMicroSlice');
    expect(index).toContain("from './ExternalAgentFirstLiveMutationMicroSlice.js'");
    expect(index).toContain('ZavorthFirstLiveMutationMicroSliceNormalization');
  });

  it('records read-only discovery evidence without serializing credentials', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();

    expect(normalized.discoveryEvidence).toEqual(expect.objectContaining({
      tokenStatus: 'present-redacted',
      commandArgTokenUsed: false,
      gatewayBind: 'loopback',
      gatewayPort: 18789,
      preListenerCount: 0,
      preProcessCount: 0,
      listenerObserved: true,
      statusExitCode: 0,
      finalCleanupListenerCount: 0,
      finalCleanupProcessCount: 0,
      safeTargetDecision: 'no-safe-live-mutation-target',
      rawSecretSerialized: false,
    }));
    expect(normalized.discoveryEvidence.documentedGatewayCallMethods).toEqual([
      'health',
      'status',
      'system-presence',
      'cron.*',
    ]);
  });

  it('classifies candidate targets and blocks scheduler mutation as unsafe', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();
    const byTarget = Object.fromEntries(normalized.candidateClassifications.map((candidate) => [
      candidate.targetKind,
      candidate,
    ]));

    expect(byTarget['gateway-noop-ping-mutation']).toEqual(expect.objectContaining({
      available: false,
      decision: 'no-safe-target',
    }));
    expect(byTarget['temporary-diagnostic-marker']).toEqual(expect.objectContaining({
      available: false,
      decision: 'no-safe-target',
    }));
    expect(byTarget['ephemeral-test-setting']).toEqual(expect.objectContaining({
      available: false,
      decision: 'no-safe-target',
    }));
    expect(byTarget['scheduler-cron-mutation']).toEqual(expect.objectContaining({
      available: true,
      safe: false,
      reversible: false,
      decision: 'blocked',
      risk: 'dangerous',
    }));
  });

  it('blocks live mutation without a valid approval grant', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();
    const row = normalized.rows.find((candidate) => candidate.fixtureCase === 'no-approval-live-mutation-blocked');
    const receipt = normalized.receipts.find((candidate) => candidate.id === row?.receiptId);

    expect(row?.receiptStatus).toBe('blocked-no-approval');
    expect(receipt).toEqual(expect.objectContaining({
      status: 'blocked-no-approval',
      liveMutationActuallyPerformed: false,
      mutationActuallyPerformed: false,
    }));
  });

  it('blocks live mutation when policy is invalidated', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();
    const row = normalized.rows.find((candidate) => candidate.fixtureCase === 'policy-invalidated-live-mutation-blocked');
    const preflight = normalized.preflights.find((candidate) => candidate.id === row?.preflightId);
    const receipt = normalized.receipts.find((candidate) => candidate.id === row?.receiptId);

    expect(preflight).toEqual(expect.objectContaining({
      policyRevalidated: true,
      policyRecheckPasses: false,
    }));
    expect(receipt?.status).toBe('policy-invalidated');
    expect(receipt?.mutationActuallyPerformed).toBe(false);
  });

  it('blocks nonreversible, unknown, and dangerous command/tool targets', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();
    const statusByCase = Object.fromEntries(normalized.rows.map((row) => [row.fixtureCase, row.receiptStatus]));

    expect(statusByCase['nonreversible-target-blocked']).toBe('blocked-nonreversible-target');
    expect(statusByCase['unknown-target-no-safe-live-mutation-target']).toBe('no-safe-live-mutation-target');
    expect(statusByCase['dangerous-command-tool-blocked']).toBe('blocked-dangerous-action');
  });

  it('can model a future safe target passing through the governed harness path', () => {
    const normalized = normalizeFirstLiveMutationMicroSlice({
      generatedAt: '2026-04-29T00:00:00.000Z',
      runtimeId: 'test-safe-live-mutation-target',
      idPrefix: 'test-safe-live-mutation-target',
      sourceHarness: normalizeApprovedMutationExecutionHarnessFixture(),
      discoveryEvidence: {
        ...createFirstLiveMutationReadOnlyDiscoveryEvidence(),
        safeTargetDecision: 'safe-live-mutation-target-found',
        noSafeTargetReason: 'fixture safe target available',
      },
      candidateClassifications: [
        ...createFirstLiveMutationCandidateClassifications(),
        {
          nativeContract: 'ZavorthFirstLiveMutationCandidateClassification/v1',
          targetKind: 'gateway-noop-ping-mutation',
          preferenceRank: 1,
          available: true,
          safe: true,
          reversible: true,
          ephemeral: true,
          sideEffectZero: true,
          risk: 'safe',
          decision: 'eligible',
          reason: 'fixture-only safe no-op target',
          sourceEvidenceOnly: true,
          sourceAuthorityGranted: false,
          rawSecretSerialized: false,
        },
      ],
      records: [createFirstLiveMutationSafeTargetFixtureRecord()],
    });
    const receipt = normalized.receipts[0];

    expect(normalized.decision).toBe('first-live-mutation-micro-slice-ready');
    expect(receipt).toEqual(expect.objectContaining({
      status: 'live-mutation-minimal-success',
      governedHarnessPathUsed: true,
      rollbackOrCleanupConfirmed: true,
      liveMutationActuallyPerformed: true,
      gatewayMutationActuallyCalled: true,
    }));
    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
    expect(receipt.dangerousToolOrCommandExecuted).toBe(false);
  });

  it('generates redacted receipts and confirms zero dangerous side effects for the actual gate', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();
    const serialized = JSON.stringify(normalized);

    expect(normalized.decision).toBe('no-safe-live-mutation-target');
    expect(serialized).not.toMatch(/EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`"]+/);
    expect(serialized).not.toMatch(/bearer\s+[A-Za-z0-9._-]{8,}/i);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    normalized.receipts.forEach((receipt) => {
      expect(receipt.redacted).toBe(true);
      expect(receipt.rawSecretSerialized).toBe(false);
      expect(receipt.messageActuallySent).toBe(false);
      expect(receipt.providerActuallyExecuted).toBe(false);
      expect(receipt.commandActuallyExecuted).toBe(false);
      expect(receipt.toolActuallyExecuted).toBe(false);
      expect(receipt.dangerousToolOrCommandExecuted).toBe(false);
      expect(receipt.sessionMutationActuallyPerformed).toBe(false);
      expect(receipt.sourceAuthorityGranted).toBe(false);
      expect(receipt.sourceModuleCopied).toBe(false);
      expect(receipt.nativeReplacementAuthorized).toBe(false);
    });
  });

  it('keeps the actual live mutation gate closed when no safe target exists', () => {
    const normalized = normalizeFirstLiveMutationMicroSliceFixture();

    expect(normalized.executionGate).toEqual({
      firstLiveMutationMicroSliceCreated: true,
      safeLiveMutationTargetFound: false,
      approvalGrantRequired: true,
      policyRecheckRequired: true,
      idempotencyKeyRequired: true,
      rollbackOrCompensationPlanRequired: true,
      redactionRequired: true,
      cleanupRequired: true,
      liveMutationActuallyPerformed: false,
      mutationActuallyPerformed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      dangerousToolOrCommandExecuted: false,
      gatewayMutationActuallyCalled: false,
      sessionMutationActuallyPerformed: false,
      externalAdapterInvokedForMutation: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    });
    expect(normalized.nextGateRecommended).toBe('future-live-mutation-target-selection');
  });
});
