import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE } from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';

import { ZAVORTH_TRANSACTION_LIVE_ACTIVATION_REVIEW_OWNER_PHRASE } from '../../src/contracts/ZavorthTransactionLiveActivationReviewContract.js';

import { ZavorthTransactionSandboxAdapterCertificationService } from '../../src/services/ZavorthTransactionSandboxAdapterCertificationService.js';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('ZavorthTransactionSandboxAdapterCertificationService', () => {
  let tempDir: string;
  let service: ZavorthTransactionSandboxAdapterCertificationService;
  let credentialRef: string | null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sandbox-adapter-cert-test-'));
    const credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    credentialRef =
      credentialRefs.register({
        label: 'Intent model2 exchange paper ref',
        connectorKind: 'exchange',
        environment: 'paper',
        allowedActions: ['trade-order'],
        ownerApproved: true,
        now,
      }).record?.ref ?? null;
    service = new ZavorthTransactionSandboxAdapterCertificationService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialStoreFile: path.join(tempDir, 'credential-refs.jsonl'),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires Intent model1 activation review readiness first', () => {
    const result = service.certify({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef,
      ownerId: 'grey',
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
      useSafeSandboxAdapter: true,
    });

    expect(result.status).toBe('activation-review-required');
    expect(result.certificationPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'intent-model1-review-ready', passed: false }),
        expect.objectContaining({ kind: 'review-packet-present', passed: false }),
      ]),
    );
  });

  it('requires an adapter manifest after Intent model1 is ready', () => {
    const result = service.certify({
      ...intentModel1ReadyInput(),
    });

    expect(result.status).toBe('adapter-manifest-required');
    expect(result.sourceActivationReview.status).toBe('ready-for-live-activation-review');
    expect(result.adapterManifest).toBeNull();
    expect(result.certificationPacket).toBeUndefined();
  });

  it('certifies a safe sandbox adapter without authorizing sandbox or live execution', () => {
    const result = service.certify({
      ...intentModel1ReadyInput(),
      useSafeSandboxAdapter: true,
    });

    expect(result.status).toBe('sandbox-certification-ready');
    expect(result.certificationPacket).toEqual(
      expect.objectContaining({
        certificationOnly: true,
        sandboxExecutionAuthorized: false,
        sandboxExternalIoPerformed: false,
        liveExecutionAuthorized: false,
        executableNow: false,
        liveActionApplied: false,
        separateSandboxExecutorRequired: true,
        separateLiveExecutorRequired: true,
        environment: 'paper',
      }),
    );
    expect(result.adapterManifest).toEqual(
      expect.objectContaining({
        environment: 'paper',
        supportsLive: false,
        rawSecretsAccepted: false,
        circuitBreaker: true,
      }),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        certificationOnly: true,
        noSandboxNetworkCall: true,
        sandboxExecutionAuthorized: false,
        liveExecutionAuthorized: false,
        liveActionApplied: false,
      }),
    );
    expect(result.gates.every((gate) => gate.passed)).toBe(true);
  });

  it('blocks live adapter endpoints and live-capable manifests', () => {
    const result = service.certify({
      ...intentModel1ReadyInput(),
      adapterManifest: {
        id: 'dangerous-live-adapter',
        connectorId: 'zavorth.connector.exchange.typed',
        connectorKind: 'exchange',
        displayName: 'Dangerous live adapter',
        environment: 'live',
        endpointBaseUrl: 'https://api.binance.com',
        allowedHosts: ['api.binance.com'],
        credentialRef: credentialRef ?? '',
        idempotencyHeader: 'Idempotency-Key',
        maxRequestsPerMinute: 10,
        timeoutMs: 5000,
        circuitBreaker: true,
        dryRunCommand: 'npm run dry-run',
        sandboxSmokeCommand: 'npm run smoke',
        supportsLive: true,
        rawSecretsAccepted: false,
      },
    });

    expect(result.status).toBe('sandbox-policy-blocked');
    expect(result.certificationPacket).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'sandbox-environment-only', passed: false }),
        expect.objectContaining({ kind: 'endpoint-allowlist-ready', passed: false }),
        expect.objectContaining({ kind: 'live-endpoint-blocked', passed: false }),
      ]),
    );
  });

  it('redacts raw adapter secrets and blocks certification before packet creation', () => {
    const result = service.certify({
      ...intentModel1ReadyInput(),
      adapterManifest: {
        id: 'secret-bearing-adapter',
        connectorId: 'zavorth.connector.exchange.typed',
        connectorKind: 'exchange',
        displayName: 'Secret bearing adapter',
        environment: 'paper',
        endpointBaseUrl: 'https://paper.exchange.zavorth.local-api_key=sk-super-secret-value-123456',
        allowedHosts: ['paper.exchange.zavorth.local'],
        credentialRef: credentialRef ?? '',
        idempotencyHeader: 'Idempotency-Key',
        maxRequestsPerMinute: 10,
        timeoutMs: 5000,
        circuitBreaker: true,
        dryRunCommand: 'npm run dry-run --token sk-super-secret-value-123456',
        sandboxSmokeCommand: 'npm run smoke',
        supportsLive: false,
        rawSecretsAccepted: true,
      },
    });

    expect(result.status).toBe('sandbox-policy-blocked');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.certificationPacket).toBeUndefined();
  });

  function intentModel1ReadyInput() {
    return {
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
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
      killSwitch: {
        id: 'intent-model2-kill-switch',
        enabled: true,
        tested: true,
        command: 'zavorth transaction disable-live --scope intent-model2',
        ownerId: 'grey',
      },
      rollbackDrill: {
        drillId: 'intent-model2-rollback-drill',
        performed: true,
        successful: true,
        summary: 'Replay and rollback completed against the simulated transaction ledger.',
        replayCommand: 'npm run zavorth:transaction-live-candidate:json -- --replay intent-model0',
        rollbackCommand: 'npm run zavorth:transaction-live-activation-review -- --rollback intent-model1',
        artifacts: ['data/runtime/intent-model2-rollback-receipt.json'],
      },
    };
  }
});
