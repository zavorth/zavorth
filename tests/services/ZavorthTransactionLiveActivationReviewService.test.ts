import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';

import {
  ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
} from '../../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';


import { ZavorthTransactionLiveActivationReviewService } from '../../src/services/ZavorthTransactionLiveActivationReviewService.js';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('ZavorthTransactionLiveActivationReviewService', () => {
  let tempDir: string;
  let service: ZavorthTransactionLiveActivationReviewService;
  let credentialRef: string | null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-live-activation-review-test-'));
    const credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    credentialRef = credentialRefs.register({
      label: 'Intent model1 exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    }).record?.ref ?? null;
    service = new ZavorthTransactionLiveActivationReviewService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialStoreFile: path.join(tempDir, 'credential-refs.jsonl'),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires a Intent model0 candidate-ready envelope first', () => {
    const result = service.review({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef,
      ownerId: 'grey',
    });

    expect(result.status).toBe('candidate-required');
    expect(result.reviewPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'intent-model0-candidate-ready', passed: false }),
        expect.objectContaining({ kind: 'candidate-envelope-present', passed: false }),
      ]),
    );
  });

  it('requires a second owner activation review phrase after Intent model0 candidate readiness', () => {
    const result = service.review({
      ...baseReadyCandidateInput(),
      useSafeDefaultControls: true,
      killSwitch: readyKillSwitch(),
      rollbackDrill: readyRollbackDrill(),
    });

    expect(result.status).toBe('owner-review-required');
    expect(result.sourceCandidate.status).toBe('candidate-ready');
    expect(result.reviewPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'intent-model0-candidate-ready', passed: true }),
        expect.objectContaining({ kind: 'owner-activation-review', passed: false }),
      ]),
    );
  });

  it('requires a rollback drill after owner review and bounded policy are ready', () => {
    const result = service.review({
      ...baseReadyCandidateInput(),
      activationReviewConfirmed: true,
      activationReviewIntent: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
      useSafeDefaultControls: true,
      killSwitch: readyKillSwitch(),
    });

    expect(result.status).toBe('rollback-drill-required');
    expect(result.reviewPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'bounded-limits', passed: true }),
        expect.objectContaining({ kind: 'kill-switch-ready', passed: true }),
        expect.objectContaining({ kind: 'rollback-drill-ready', passed: false }),
      ]),
    );
  });

  it('creates a review-only packet with kill switch, limits and rollback but still no live execution', () => {
    const result = service.review({
      ...baseReadyCandidateInput(),
      activationReviewConfirmed: true,
      activationReviewIntent: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
      useSafeDefaultControls: true,
      killSwitch: readyKillSwitch(),
      rollbackDrill: readyRollbackDrill(),
    });

    expect(result.status).toBe('ready-for-live-activation-review');
    expect(result.reviewPacket).toEqual(expect.objectContaining({
      reviewOnly: true,
      activationAuthorized: false,
      liveExecutionAuthorized: false,
      executableNow: false,
      liveActionApplied: false,
      separateLiveExecutorRequired: true,
      rollbackDrillId: 'intent-model1-rollback-drill',
      killSwitchId: 'intent-model1-kill-switch',
    }));
    expect(result.safety).toEqual(expect.objectContaining({
      activationReviewOnly: true,
      doesNotAuthorizeLiveExecution: true,
      externalSideEffects: false,
      liveExecutionAuthorized: false,
      executableNow: false,
      liveActionApplied: false,
    }));
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it('blocks oversized activation limits before review packet creation', () => {
    const result = service.review({
      ...baseReadyCandidateInput(),
      activationReviewConfirmed: true,
      activationReviewIntent: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
      limits: {
        maxSingleAmount: 1000,
        maxDailyAmount: 2000,
        maxExecutionsPerDay: 5,
        allowedConnectorIds: ['zavorth.connector.exchange.typed'],
        allowedTargetLabels: ['ETH'],
      },
      killSwitch: readyKillSwitch(),
      rollbackDrill: readyRollbackDrill(),
    });

    expect(result.status).toBe('activation-policy-blocked');
    expect(result.reviewPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'canary-limit-ready', passed: false }),
      ]),
    );
  });

  it('does not leak raw secrets from rejected activation review input', () => {
    const result = service.review({
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef,
      ownerId: 'grey',
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
      activationReviewConfirmed: true,
      activationReviewIntent: ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE,
      useSafeDefaultControls: true,
      killSwitch: readyKillSwitch(),
      rollbackDrill: readyRollbackDrill(),
    });

    expect(result.status).toBe('candidate-required');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.reviewPacket).toBeUndefined();
  });

  function baseReadyCandidateInput() {
    return {
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      surface: 'api' as const,
      approve: true,
      mode: 'paper' as const,
      credentialRef,
      ownerId: 'grey',
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
    };
  }
});

function readyKillSwitch() {
  return {
    id: 'intent-model1-kill-switch',
    enabled: true,
    tested: true,
    command: 'zavorth transaction disable-live --scope intent-model1',
    ownerId: 'grey',
  };
}

function readyRollbackDrill() {
  return {
    drillId: 'intent-model1-rollback-drill',
    performed: true,
    successful: true,
    summary: 'Replay and rollback completed against the simulated transaction ledger.',
    replayCommand: 'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
    rollbackCommand: 'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
    artifacts: ['data/runtime/intent-model1-rollback-receipt.json'],
  };
}
