import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTransactionApprovalLedgerService } from '../../src/services/ZavorthTransactionApprovalLedgerService.js';
import { ZavorthTransactionPreviewService } from '../../src/services/ZavorthTransactionPreviewService.js';

const signingKey = 'phase3-test-signing-key-000000000000000000000000000000';

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
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
      channel: 'web',
    });

    const previewEntry = service.recordPreview(preview, 'system');
    const approvalEntry = service.decide({
      preview,
      decision: 'approved',
      actor: 'owner',
      reason: 'approved for phase 3 test',
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
      text: 'Pague a fatura do cartao se ficar abaixo de R$900.',
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
      text: 'Compre isso para mim depois.',
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
      text: 'Compre ETH ate R$300 se cair 5%, mas peca confirmacao antes.',
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
      text: 'Compre ETH ate R$100 usando api_key=sk-super-secret-value-123456.',
    });

    service.recordPreview(preview, 'system');
    const blocked = service.decide({ preview, decision: 'approved', actor: 'owner' });

    expect(blocked.kind).toBe('approval-blocked');
    expect(JSON.stringify(blocked)).not.toContain('sk-super-secret-value-123456');
    expect(fs.readFileSync(ledgerFile, 'utf8')).not.toContain('sk-super-secret-value-123456');
  });
});
