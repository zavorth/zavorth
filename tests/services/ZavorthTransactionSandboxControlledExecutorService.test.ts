import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import {
  ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionSandboxControlledExecutorContract.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';

import {
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';



import { ZavorthTransactionSandboxControlledExecutorService } from '../../src/services/ZavorthTransactionSandboxControlledExecutorService.js';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('ZavorthTransactionSandboxControlledExecutorService', () => {
  let tempDir: string;
  let service: ZavorthTransactionSandboxControlledExecutorService;
  let credentialRef: string | null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sandbox-controlled-executor-test-'));
    const credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    credentialRef = credentialRefs.register({
      label: 'Intent model3 exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    }).record?.ref ?? null;
    service = new ZavorthTransactionSandboxControlledExecutorService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialStoreFile: path.join(tempDir, 'credential-refs.jsonl'),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires Intent model2 sandbox certification readiness first', () => {
    const result = service.execute({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef,
      ownerId: 'grey',
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
      useSafeSandboxAdapter: true,
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
    });

    expect(result.status).toBe('certification-required');
    expect(result.executionReceipt).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'intent-model2-certification-ready', passed: false }),
        expect.objectContaining({ kind: 'certification-packet-present', passed: false }),
      ]),
    );
  });

  it('requires a dedicated sandbox execution phrase after Intent model2 certification', () => {
    const result = service.execute({
      ...intentModel2ReadyInput(),
    });

    expect(result.status).toBe('sandbox-operator-approval-required');
    expect(result.sourceCertification.status).toBe('sandbox-certification-ready');
    expect(result.executionReceipt).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'intent-model2-certification-ready', passed: true }),
        expect.objectContaining({ kind: 'sandbox-operator-confirmation', passed: false }),
      ]),
    );
  });

  it('emits a local sandbox execution receipt without external or live effects', () => {
    const result = service.execute({
      ...intentModel2ReadyInput(),
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
      sandboxRunId: 'intent-model3-sandbox-run',
    });

    expect(result.status).toBe('sandbox-executed');
    expect(result.executionReceipt).toEqual(expect.objectContaining({
      sandboxRunId: 'intent-model3-sandbox-run',
      localSandboxLedgerRecorded: true,
      localSandboxSimulationPerformed: true,
      sandboxExecutionAuthorized: true,
      sandboxExternalIoPerformed: false,
      liveExecutionAuthorized: false,
      executableNow: false,
      liveActionApplied: false,
      externalSideEffects: false,
      rollbackAvailable: true,
      redacted: true,
      rawSecretPresent: false,
    }));
    expect(result.safety).toEqual(expect.objectContaining({
      controlledSandboxOnly: true,
      localSandboxSimulationOnly: true,
      noExternalNetworkCall: true,
      sandboxExternalIoPerformed: false,
      liveExecutionAuthorized: false,
      liveActionApplied: false,
    }));
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it('blocks controlled sandbox execution when kill switch is forced', () => {
    const result = service.execute({
      ...intentModel2ReadyInput(),
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
      forceKillSwitch: true,
    });

    expect(result.status).toBe('sandbox-execution-blocked');
    expect(result.executionReceipt).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'sandbox-not-aborted', passed: false }),
      ]),
    );
  });

  it('blocks controlled sandbox execution when local simulation fails', () => {
    const result = service.execute({
      ...intentModel2ReadyInput(),
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
      simulateSandboxFailure: true,
    });

    expect(result.status).toBe('sandbox-execution-blocked');
    expect(result.executionReceipt).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'sandbox-simulation-succeeds', passed: false }),
      ]),
    );
  });

  it('does not leak raw secrets from blocked sandbox execution input', () => {
    const result = service.execute({
      ...intentModel2ReadyInput(),
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      sandboxExecutionConfirmed: true,
      sandboxExecutionIntent: ZAVORTH_TRANSACTION_SANDBOX_CONTROLLED_EXECUTOR_OWNER_PHRASE,
    });

    expect(result.status).toBe('certification-required');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.executionReceipt).toBeUndefined();
  });

  function intentModel2ReadyInput() {
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
        id: 'intent-model3-kill-switch',
        enabled: true,
        tested: true,
        command: 'zavorth transaction disable-live --scope intent-model3',
        ownerId: 'grey',
      },
      rollbackDrill: {
        drillId: 'intent-model3-rollback-drill',
        performed: true,
        successful: true,
        summary: 'Replay and rollback completed against the simulated transaction ledger.',
        replayCommand: 'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
        rollbackCommand: 'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
        artifacts: ['data/runtime/intent-model3-rollback-receipt.json'],
      },
    };
  }
});
