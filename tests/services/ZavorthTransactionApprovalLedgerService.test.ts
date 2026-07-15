import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionApprovalLedgerService } from '../../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';

const signingKey = 'approval-gate-test-signing-key-000000000000000000000000000000';

describe('ZavorthTransactionApprovalLedgerService', () => {
  let tempDir: string;
  let ledgerFile: string;
  let service: ZavorthTransactionApprovalLedgerService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-transaction-approval-test-'));
    ledgerFile = path.join(tempDir, 'approval-ledger.jsonl');
    service = new ZavorthTransactionApprovalLedgerService({
      ledgerFile,
      signingKey,
      now: () => new Date('2026-05-11T12:00:00.000Z'),
      previewService: new ZavorthTransactionPreviewService(),
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records a preview and grants approval without authorizing live execution', () => {
    const preview = service.buildPreviewFromText({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
      channel: 'web',
    });

    const previewEntry = service.recordPreview(preview, 'system');
    const approvalEntry = service.decide({
      preview,
      decision: 'approved',
      actor: 'owner',
      reason: 'approved for ledger test',
    });

    expect(previewEntry.kind).toBe('preview-recorded');
    expect(approvalEntry.kind).toBe('approval-granted');
    expect(approvalEntry.approvalStatus).toBe('approved');
    expect(approvalEntry.liveExecutionAuthorized).toBe(false);
    expect(approvalEntry.executableNow).toBe(false);
    expect(approvalEntry.liveActionApplied).toBe(false);
    expect(approvalEntry.payloadDigest).toHaveLength(64);
    expect(approvalEntry.signature).toHaveLength(64);
    expect(approvalEntry.previousEntryDigest).toBe(previewEntry.payloadDigest);

    const summary = service.buildSummary();
    expect(summary.entries).toBe(2);
    expect(summary.previewsRecorded).toBe(1);
    expect(summary.approvalsGranted).toBe(1);
    expect(summary.liveActionsApplied).toBe(0);
    expect(summary.executableEntries).toBe(0);
  });

  it('records a rejection as an auditable decision', () => {
    const preview = service.buildPreviewFromText({
      text: 'Pay the card bill if it stays below R$900.',
      kind: 'pay-bill',
      actionKind: 'payment-submit',
      channel: 'api',
    });

    service.recordPreview(preview, 'system');
    const rejection = service.decide({
      preview,
      decision: 'rejected',
      actor: 'owner',
      reason: 'not today',
    });

    expect(rejection.kind).toBe('approval-rejected');
    expect(rejection.approvalStatus).toBe('rejected');
    expect(rejection.reason).toBe('not today');
    expect(service.buildSummary().approvalsRejected).toBe(1);
  });

  it('blocks approval for clarification-needed previews', () => {
    const preview = service.buildPreviewFromText({
      text: 'Buy this for me later.',
      kind: 'purchase-product',
    });

    service.recordPreview(preview, 'system');
    const blocked = service.decide({
      preview,
      decision: 'approved',
      actor: 'owner',
    });

    expect(preview.status).toBe('needs-clarification');
    expect(blocked.kind).toBe('approval-blocked');
    expect(blocked.approvalStatus).toBe('rejected');
    expect(blocked.reason).toContain('needs-clarification');
    expect(service.buildSummary().approvalsBlocked).toBe(1);
  });

  it('does not allow duplicate approval decisions for the same preview', () => {
    const preview = service.buildPreviewFromText({
      text: 'Buy ETH up to R$300 if it drops 5%, but ask for confirmation first.',
      kind: 'execute-trade',
      actionKind: 'trade-order',
    });

    service.recordPreview(preview, 'system');
    const first = service.decide({ preview, decision: 'approved', actor: 'owner' });
    const duplicate = service.decide({ preview, decision: 'approved', actor: 'owner' });

    expect(first.kind).toBe('approval-granted');
    expect(duplicate.kind).toBe('approval-blocked');
    expect(duplicate.reason).toContain(first.id);
  });

  it('redacts secrets from approval ledger entries and file content', () => {
    const preview = service.buildPreviewFromText({
      text: 'Buy ETH up to R$100 using api_key=sk-super-secret-value-123456.',
    });

    service.recordPreview(preview, 'system');
    const blocked = service.decide({ preview, decision: 'approved', actor: 'owner' });

    expect(blocked.kind).toBe('approval-blocked');
    expect(JSON.stringify(blocked)).not.toContain('sk-super-secret-value-123456');
    expect(fs.readFileSync(ledgerFile, 'utf8')).not.toContain('sk-super-secret-value-123456');
  });
});
