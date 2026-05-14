import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionApprovalLedgerService } from '../../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionConnectorRegistryService } from '../../src/services/ZavorthTransactionConnectorRegistryService.js';
import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';

const signingKey = 'phase4-test-signing-key-000000000000000000000000000000';
const now = new Date('2026-05-11T12:00:00.000Z');

describe('ZavorthTransactionConnectorRegistryService', () => {
  let tempDir: string;
  let ledger: ZavorthTransactionApprovalLedgerService;
  let previewService: ZavorthTransactionPreviewService;
  let registry: ZavorthTransactionConnectorRegistryService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-connector-test-'));
    previewService = new ZavorthTransactionPreviewService();
    ledger = new ZavorthTransactionApprovalLedgerService({
      ledgerFile: path.join(tempDir, 'ledger.jsonl'),
      signingKey,
      now: () => now,
      previewService,
    });
    registry = new ZavorthTransactionConnectorRegistryService({
      now: () => now,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks real-money connector dry-run until Phase 3 approval is granted', () => {
    const preview = previewService.buildPreview({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      now,
    });

    const result = registry.run({
      preview,
      mode: 'paper',
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('approval_grant_required');
    expect(result.externalSideEffects).toBe(false);
    expect(result.liveActionApplied).toBe(false);
    expect(result.executableNow).toBe(false);
  });

  it('simulates an approved exchange payload without external side effects', () => {
    const preview = previewService.buildPreview({
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      now,
    });
    ledger.recordPreview(preview, 'system');
    const approval = ledger.decide({
      preview,
      decision: 'approved',
      actor: 'owner',
    });

    const result = registry.run({
      preview,
      approvalEntry: approval,
      mode: 'paper',
    });

    expect(result.status).toBe('simulated');
    expect(result.connector).toEqual(expect.objectContaining({
      id: 'zavorth.connector.exchange.typed',
      supportsLive: false,
      rawSecretsAccepted: false,
    }));
    expect(result.payload).toEqual(expect.objectContaining({
      method: 'SIMULATE_TRADE_ORDER',
      operation: 'trade-order',
      amount: 300,
      currency: 'BRL',
      redacted: true,
      rawSecretPresent: false,
    }));
    expect(result.policy.approvalStatus).toBe('approved');
    expect(result.externalSideEffects).toBe(false);
    expect(result.liveExecutionAuthorized).toBe(false);
    expect(result.liveActionApplied).toBe(false);
  });

  it('allows read-only monitoring dry-run without approval', () => {
    const preview = previewService.buildPreview({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
      now,
    });

    const result = registry.run({
      preview,
      mode: 'sandbox',
    });

    expect(result.status).toBe('simulated');
    expect(result.connector?.kind).toBe('market-data');
    expect(result.policy.approvalRequired).toBe(false);
    expect(result.payload?.method).toBe('SIMULATE_PRICE_MONITOR');
  });

  it('blocks disabled owner-gated wallet connector', () => {
    const preview = previewService.buildPreview({
      text: 'Saque BTC para minha wallet ate R$100.',
      now,
    });
    ledger.recordPreview(preview, 'system');
    const approval = ledger.decide({
      preview,
      decision: 'approved',
      actor: 'owner',
    });

    const result = registry.run({
      preview,
      approvalEntry: approval,
      mode: 'dry-run',
    });

    expect(result.status).toBe('blocked');
    expect(result.connector?.kind).toBe('wallet');
    expect(result.blockers).toContain('typed_connector_disabled');
    expect(result.liveActionApplied).toBe(false);
  });

  it('blocks and redacts raw credential references', () => {
    const preview = previewService.buildPreview({
      text: 'Monitore notebook abaixo de R$3500 e me avise.',
      now,
    });

    const result = registry.run({
      preview,
      mode: 'dry-run',
      credentialRef: 'api_key=sk-super-secret-value-123456',
    });

    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('raw_credential_ref_blocked');
    expect(JSON.stringify(result)).not.toContain('sk-super-secret-value-123456');
  });
});
