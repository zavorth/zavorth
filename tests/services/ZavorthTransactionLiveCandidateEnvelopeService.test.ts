import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';

import { ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE } from '../../src/contracts/ZavorthTransactionLiveCandidateContract.js';

import { ZavorthTransactionLiveCandidateEnvelopeService } from '../../src/services/ZavorthTransactionLiveCandidateEnvelopeService.js';

const now = new Date('2026-05-12T12:00:00.000Z');

describe('ZavorthTransactionLiveCandidateEnvelopeService', () => {
  let tempDir: string;
  let service: ZavorthTransactionLiveCandidateEnvelopeService;
  let credentialRefs: ZavorthTransactionCredentialRefService;
  let credentialRef: string | null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-live-candidate-test-'));
    credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    credentialRef =
      credentialRefs.register({
        label: 'Intent model0 exchange paper ref',
        connectorKind: 'exchange',
        environment: 'paper',
        allowedActions: ['trade-order'],
        ownerApproved: true,
        now,
      }).record?.ref ?? null;
    service = new ZavorthTransactionLiveCandidateEnvelopeService({
      now: () => now,
      ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
      credentialRefs,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires owner confirmation even after approval, credential and simulation are ready', () => {
    const result = service.propose({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef,
      ownerId: 'grey',
    });

    expect(result.status).toBe('owner-confirmation-required');
    expect(result.envelope).toBeUndefined();
    expect(result.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'certification-matrix-certification', passed: true }),
        expect.objectContaining({ kind: 'dashboard-simulated', passed: true }),
        expect.objectContaining({ kind: 'approval-ledger-approved', passed: true }),
        expect.objectContaining({ kind: 'credential-ref-ready', passed: true }),
        expect.objectContaining({ kind: 'owner-confirmation', passed: false }),
        expect.objectContaining({ kind: 'live-switch-disabled', passed: true }),
      ]),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        liveCandidateOnly: true,
        liveExecutionAuthorized: false,
        executableNow: false,
        liveActionApplied: false,
      }),
    );
  });

  it('creates a candidate-ready envelope with explicit owner phrase but still no live execution', () => {
    const result = service.propose({
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
    });

    expect(result.status).toBe('candidate-ready');
    expect(result.ownerGate).toEqual(
      expect.objectContaining({
        ownerId: 'grey',
        confirmed: true,
        phraseAccepted: true,
      }),
    );
    expect(result.envelope).toEqual(
      expect.objectContaining({
        candidateOnly: true,
        actionKind: 'trade-order',
        connectorKind: 'exchange',
        credentialRef,
        approvalEntryId: expect.stringMatching(/^ztx-approval-/),
        rawSecretPresent: false,
      }),
    );
    expect(result.envelope?.payloadPreview).toEqual(
      expect.objectContaining({
        method: 'SIMULATE_TRADE_ORDER',
        credentialRef,
        rawSecretPresent: false,
        redacted: true,
      }),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        candidateDoesNotAuthorizeLiveExecution: true,
        externalSideEffects: false,
        liveExecutionAuthorized: false,
        executableNow: false,
        liveActionApplied: false,
      }),
    );
  });

  it('blocks candidate envelope when credential ref is missing', () => {
    const result = service.propose({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      surface: 'api',
      approve: true,
      mode: 'paper',
      requireCredential: true,
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
    });

    expect(result.status).toBe('runtime-blocked');
    expect(result.blockers).toEqual(
      expect.arrayContaining(['dashboard-simulated', 'credential-ref-ready', 'typed-connector-simulated']),
    );
    expect(result.envelope).toBeUndefined();
  });

  it('blocks and redacts raw secret-bearing candidate requests', () => {
    const result = service.propose({
      text: 'Buy ETH up to R$100 using api_key=sk-super-secret-value-123456.',
      surface: 'api',
      approve: true,
      mode: 'paper',
      credentialRef,
      ownerConfirmed: true,
      ownerIntent: ZAVORTH_TRANSACTION_LIVE_CANDIDATE_OWNER_PHRASE,
    });

    expect(result.status).toBe('runtime-blocked');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.gates).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'raw-secret-redaction', passed: true })]),
    );
  });
});
