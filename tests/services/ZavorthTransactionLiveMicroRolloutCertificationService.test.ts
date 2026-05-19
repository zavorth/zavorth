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
  ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveMicroRolloutCertificationContract.js';
import {
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionSandboxControlledExecutorContract.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionLiveMicroRolloutCertificationService } from '../../src/services/ZavorthTransactionLiveMicroRolloutCertificationService.js';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('ZavorthTransactionLiveMicroRolloutCertificationService', () => {
  let tempDir: string;
  let service: ZavorthTransactionLiveMicroRolloutCertificationService;
  let credentialRef: string | null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-live-micro-rollout-cert-test-'));
    const credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    credentialRef = credentialRefs.register({
      label: 'Intent model4-15 exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    }).record?.ref ?? null;
    service = new ZavorthTransactionLiveMicroRolloutCertificationService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialStoreFile: path.join(tempDir, 'credential-refs.jsonl'),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires Intent model3 sandbox execution first', () => {
    const result = service.certify({
      ...baseReadyBeforeSandboxExecution(),
      microRolloutReviewConfirmed: true,
      microRolloutReviewIntent: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
      useSafeMicroRolloutControls: true,
    });

    expect(result.status).toBe('sandbox-execution-required');
    expect(result.certificationPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'intent-model3-sandbox-executed', passed: false }),
        expect.objectContaining({ kind: 'sandbox-execution-receipt-present', passed: false }),
      ]),
    );
  });

  it('requires a dedicated micro-rollout owner review phrase', () => {
    const result = service.certify({
      ...intent-model3ExecutedInput(),
      useSafeMicroRolloutControls: true,
    });

    expect(result.status).toBe('micro-rollout-owner-review-required');
    expect(result.sourceSandboxExecution.status).toBe('sandbox-executed');
    expect(result.certificationPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'owner-micro-rollout-review', passed: false }),
      ]),
    );
  });

  it('certifies final micro-rollout readiness without authorizing live execution', () => {
    const result = service.certify({
      ...intent-model3ExecutedInput(),
      microRolloutReviewConfirmed: true,
      microRolloutReviewIntent: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
      useSafeMicroRolloutControls: true,
    });

    expect(result.status).toBe('micro-rollout-certified');
    expect(result.certificationPacket).toEqual(expect.objectContaining({
      certifiedForFutureLiveMicroRollout: true,
      certificationOnly: true,
      liveMicroRolloutAuthorized: false,
      liveExecutionAuthorized: false,
      executableNow: false,
      liveActionApplied: false,
      externalSideEffects: false,
      rawSecretPresent: false,
    }));
    expect(result.rolloutStages).toHaveLength(8);
    expect(result.scenarios.every((scenario) => scenario.passed)).toBe(true);
    expect(result.safety).toEqual(expect.objectContaining({
      futureMicroRolloutOnly: true,
      noLiveExecution: true,
      liveMicroRolloutAuthorized: false,
      liveExecutionAuthorized: false,
      liveActionApplied: false,
    }));
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it('blocks oversized micro rollout limits', () => {
    const result = service.certify({
      ...intent-model3ExecutedInput(),
      microRolloutReviewConfirmed: true,
      microRolloutReviewIntent: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
      rolloutLimits: {
        maxMicroAmount: 50,
        maxDailyAmount: 100,
        maxExecutionsPerDay: 10,
        requiredObservationHours: 1,
      },
    });

    expect(result.status).toBe('micro-rollout-policy-blocked');
    expect(result.certificationPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'micro-amount-limit-ready', passed: false }),
        expect.objectContaining({ kind: 'daily-limit-ready', passed: false }),
        expect.objectContaining({ kind: 'execution-count-limit-ready', passed: false }),
      ]),
    );
  });

  it('fails final certification when an aggressive scenario fails', () => {
    const result = service.certify({
      ...intent-model3ExecutedInput(),
      microRolloutReviewConfirmed: true,
      microRolloutReviewIntent: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
      useSafeMicroRolloutControls: true,
      failCertificationScenario: 'price-drift',
    });

    expect(result.status).toBe('certification-failed');
    expect(result.certificationPacket).toBeUndefined();
    expect(result.scenarios).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'price-drift', passed: false }),
      ]),
    );
  });

  it('does not leak raw secrets from blocked final certification input', () => {
    const result = service.certify({
      ...intent-model3ExecutedInput(),
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      microRolloutReviewConfirmed: true,
      microRolloutReviewIntent: ZAVORTH_TRANSACTION_LIVE_MICRO_ROLLOUT_CERTIFICATION_OWNER_PHRASE,
      useSafeMicroRolloutControls: true,
    });

    expect(result.status).toBe('sandbox-execution-required');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.certificationPacket).toBeUndefined();
  });

  function baseReadyBeforeSandboxExecution() {
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
        id: 'intent-model4-15-kill-switch',
        enabled: true,
        tested: true,
        command: 'zavorth transaction disable-live --scope intent-model4-15',
        ownerId: 'grey',
      },
      rollbackDrill: {
        drillId: 'intent-model4-15-rollback-drill',
        performed: true,
        successful: true,
        summary: 'Replay and rollback completed against the simulated transaction ledger.',
        replayCommand: 'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
        rollbackCommand: 'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
        artifacts: ['data/runtime/intent-model4-15-rollback-receipt.json'],
      },
    };
  }

  function intent-model3ExecutedInput() {
    return {
      ...baseReadyBeforeSandboxExecution(),
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
      sandboxRunId: 'intent-model4-15-sandbox-run',
    };
  }
});
