import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionApprovalLedgerService } from '../../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionConnectorRegistryService } from '../../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionCredentialRefService } from '../../src/services/ZavorthTransactionCredentialRefService.js';
import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';
import { ZavorthTransactionRuntimeOrchestratorService } from '../../src/services/ZavorthTransactionRuntimeOrchestratorService.js';

const now = new Date('2026-05-11T12:00:00.000Z');
const signingKey = 'runtime-gateway-test-signing-key-000000000000000000000000000000';

describe('ZavorthTransactionRuntimeOrchestratorService', () => {
  let tempDir: string;
  let service: ZavorthTransactionRuntimeOrchestratorService;
  let credentialRefs: ZavorthTransactionCredentialRefService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-test-'));
    const previewService = new ZavorthTransactionPreviewService();
    credentialRefs = new ZavorthTransactionCredentialRefService({
      storeFile: path.join(tempDir, 'credential-refs.jsonl'),
      now: () => now,
    });
    service = new ZavorthTransactionRuntimeOrchestratorService({
      now: () => now,
      previewService,
      approvalLedger: new ZavorthTransactionApprovalLedgerService({
        ledgerFile: path.join(tempDir, 'approval-ledger.jsonl'),
        signingKey,
        now: () => now,
        previewService,
      }),
      credentialRefs,
      connectorRegistry: new ZavorthTransactionConnectorRegistryService({
        now: () => now,
      }),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks a real-money trade runtime until approval is present', () => {
    const result = service.run({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      mode: 'paper',
    });

    expect(result.status).toBe('approval-required');
    expect(result.blockers).toContain('approval_required');
    expect(result.preview.status).toBe('ready-for-review');
    expect(result.connectorRun).toBeUndefined();
    expect(result.externalSideEffects).toBe(false);
    expect(result.liveActionApplied).toBe(false);
  });

  it('runs the full approved credential-backed paper simulation', () => {
    const credential = credentialRefs.register({
      label: 'Demo exchange paper ref',
      connectorKind: 'exchange',
      environment: 'paper',
      allowedActions: ['trade-order'],
      ownerApproved: true,
      now,
    });

    const result = service.run({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      approve: true,
      mode: 'paper',
      credentialRef: credential.record?.ref,
    });

    expect(result.status).toBe('simulated');
    expect(result.approvalEntry?.kind).toBe('approval-granted');
    expect(result.credentialValidation?.status).toBe('ready');
    expect(result.connectorRun?.status).toBe('simulated');
    expect(result.connectorRun?.payload?.credentialRef).toBe(credential.record?.ref);
    expect(result.stageReceipts.map((receipt) => receipt.stage)).toEqual(
      expect.arrayContaining(['intent', 'preview', 'approval-ledger', 'credential-validation', 'typed-connector']),
    );
    expect(result.externalSideEffects).toBe(false);
    expect(result.liveExecutionAuthorized).toBe(false);
    expect(result.executableNow).toBe(false);
  });

  it('blocks when a required credential ref is absent', () => {
    const result = service.run({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      approve: true,
      mode: 'paper',
      requireCredential: true,
    });

    expect(result.status).toBe('credential-required');
    expect(result.blockers).toContain('credential_ref_required');
    expect(result.connectorRun).toBeUndefined();
  });

  it('blocks when the credential ref is missing from the credential store', () => {
    const result = service.run({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      approve: true,
      mode: 'paper',
      credentialRef: 'vault://zavorth/transaction/exchange/missing-ref',
    });

    expect(result.status).toBe('credential-required');
    expect(result.credentialValidation?.status).toBe('missing');
    expect(result.blockers).toContain('credential_ref_missing');
  });

  it('simulates monitoring without approval or credential', () => {
    const result = service.run({
      text: 'Monitor notebook below R$3500 and notify me.',
      kind: 'monitor-price',
      actionKind: 'price-monitor',
      mode: 'sandbox',
    });

    expect(result.status).toBe('simulated');
    expect(result.preview.approval.required).toBe(false);
    expect(result.connectorRun?.connector?.kind).toBe('market-data');
    expect(result.connectorRun?.payload?.method).toBe('SIMULATE_PRICE_MONITOR');
  });

  it('redacts and blocks raw secret-bearing natural text', () => {
    const result = service.run({
      text: 'Buy ETH up to R$100 using api_key=sk-super-secret-value-123456.',
      approve: true,
      mode: 'paper',
    });

    expect(result.status).toBe('blocked');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
    expect(result.blockers).toContain('preview_blocked');
  });
});
