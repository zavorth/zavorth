import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveExecutorGateContract.js';
import {
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.js';
import {
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionSandboxControlledExecutorContract.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionLiveExecutorGateService } from '../../src/services/ZavorthTransactionLiveExecutorGateService.js';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('ZavorthTransactionLiveExecutorGateService', () => {
  let tempDir: string;
  let service: ZavorthTransactionLiveExecutorGateService;
  let credentialRef: string | null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-live-executor-gate-test-'));
    const credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    credentialRef = credentialRefs.register({
      label: 'Phase 16 exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    }).record?.ref ?? null;
    service = new ZavorthTransactionLiveExecutorGateService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialStoreFile: path.join(tempDir, 'credential-refs.jsonl'),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires Phase 14-15 micro-rollout certification first', () => {
    const result = service.prepare({
      ...baseReadyBeforeMicroRolloutCertification(),
      liveOperatorConfirmed: true,
      liveOperatorIntent: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
      useSafeLiveAdapterControls: true,
    });

    expect(result.status).toBe('micro-rollout-certification-required');
    expect(result.readinessPacket).toBeUndefined();
  });

  it('requires a dedicated live operator phrase', () => {
    const result = service.prepare({
      ...microRolloutCertifiedInput(),
      useSafeLiveAdapterControls: true,
    });

    expect(result.status).toBe('live-operator-confirmation-required');
    expect(result.sourceMicroRolloutCertification.status).toBe('micro-rollout-certified');
    expect(result.readinessPacket).toBeUndefined();
  });

  it('requires a live adapter manifest after operator confirmation', () => {
    const result = service.prepare({
      ...microRolloutCertifiedInput(),
      liveOperatorConfirmed: true,
      liveOperatorIntent: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
    });

    expect(result.status).toBe('live-adapter-required');
    expect(result.readinessPacket).toBeUndefined();
  });

  it('prepares a live-ready-held packet without authorizing live execution', () => {
    const result = service.prepare({
      ...microRolloutCertifiedInput(),
      liveOperatorConfirmed: true,
      liveOperatorIntent: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
      liveRunId: 'phase16-live-run',
      useSafeLiveAdapterControls: true,
    });

    expect(result.status).toBe('live-ready-held');
    expect(result.readinessPacket).toEqual(expect.objectContaining({
      liveExecutorReady: true,
      readyForExternalAdapterBinding: true,
      executionHeld: true,
      liveExecutionAuthorized: false,
      executableNow: false,
      liveActionApplied: false,
      externalSideEffects: false,
      rawSecretPresent: false,
    }));
    expect(result.safety).toEqual(expect.objectContaining({
      liveExecutorGateReady: true,
      noBundledFinancialAdapter: true,
      noLiveExecution: true,
      liveExecutionAuthorized: false,
      liveActionApplied: false,
    }));
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it('blocks executeLive in the readiness gate', () => {
    const result = service.prepare({
      ...microRolloutCertifiedInput(),
      liveOperatorConfirmed: true,
      liveOperatorIntent: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
      useSafeLiveAdapterControls: true,
      executeLive: true,
    });

    expect(result.status).toBe('live-policy-blocked');
    expect(result.readinessPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'live-execution-held', passed: false }),
      ]),
    );
  });

  it('blocks live amount above certified micro limit', () => {
    const result = service.prepare({
      ...microRolloutCertifiedInput(),
      liveOperatorConfirmed: true,
      liveOperatorIntent: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
      useSafeLiveAdapterControls: true,
      liveAdapterManifest: {
        maximumLiveAmount: 50,
      },
    });

    expect(result.status).toBe('live-policy-blocked');
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'amount-within-micro-limit', passed: false }),
      ]),
    );
  });

  it('does not leak raw secrets from blocked input', () => {
    const result = service.prepare({
      ...microRolloutCertifiedInput(),
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      liveOperatorConfirmed: true,
      liveOperatorIntent: ZAVORTH_TRANSACTION_LIVE_EXECUTOR_GATE_OWNER_PHRASE,
      useSafeLiveAdapterControls: true,
    });

    expect(result.status).toBe('micro-rollout-certification-required');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.readinessPacket).toBeUndefined();
  });

  function baseReadyBeforeMicroRolloutCertification() {
    return {
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'api' as const,
      approve: true,
      mode: 'paper' as const,
      credentialRef,
      ownerId: 'grey',
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
      activationReviewConfirmed: true,
      activationReviewIntent: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
      useSafeDefaultControls: true,
      useSafeSandboxAdapter: true,
      killSwitch: {
        id: 'phase16-kill-switch',
        enabled: true,
        tested: true,
        command: 'zavorth transaction disable-live --scope phase16',
        ownerId: 'grey',
      },
      rollbackDrill: {
        drillId: 'phase16-rollback-drill',
        performed: true,
        successful: true,
        summary: 'Replay and rollback completed against the simulated transaction ledger.',
        replayCommand: 'npm run zavorth:transaction-live-candidate:json -- --replay phase10',
        rollbackCommand: 'npm run zavorth:transaction-live-activation-review -- --rollback phase11',
        artifacts: ['data/runtime/phase16-rollback-receipt.json'],
      },
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
      sandboxRunId: 'phase16-sandbox-run',
    };
  }

  function microRolloutCertifiedInput() {
    return {
      ...baseReadyBeforeMicroRolloutCertification(),
      microRolloutReviewConfirmed: true,
      microRolloutReviewIntent: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
      microRolloutReviewId: 'phase16-micro-rollout-review',
      useSafeMicroRolloutControls: true,
    };
  }
});
