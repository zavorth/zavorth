import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthAutomationHookService } from '../../src/services/ZavorthAutomationHookService.js';

describe('ZavorthAutomationHookService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function makeWorkspace(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-automation-hooks-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, '.zavorth', 'hooks'), { recursive: true });
    return root;
  }

  it('runs enabled local automation hooks and writes Mnemos summaries plus receipts', async () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, '.zavorth', 'hooks', 'after-run-summary.json'), `${JSON.stringify({
      contractVersion: 'zavorth-automation-hook/1',
      id: 'after-run-summary',
      title: 'After run summary',
      enabled: true,
      event: 'runtime.after_execute',
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [
        {
          type: 'mnemos.write_summary',
          summaryTemplate: '{{toolName}} finished with {{resultLength}} chars and {{apiKey}}.',
        },
        {
          type: 'receipt.create',
          title: 'Completed {{toolName}}',
          summary: 'Receipt for {{toolName}}.',
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const service = new ZavorthAutomationHookService({
      now: () => new Date('2026-05-23T10:00:00.000Z'),
    });
    const result = await service.runEvent({
      workspace: root,
      event: 'runtime.after_execute',
      context: {
        toolName: 'read_file',
        resultLength: 42,
        apiKey: 'sk-super-secret-value',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.matchedHooks).toBe(1);
    expect(result.executedActions).toBe(2);
    expect(result.blockedActions).toBe(0);
    const mnemos = fs.readFileSync(path.join(root, '.zavorth', 'mnemos', 'automation-summaries.jsonl'), 'utf8');
    expect(mnemos).toContain('read_file finished with 42 chars');
    expect(mnemos).not.toContain('sk-super-secret-value');
    const receipts = fs.readdirSync(path.join(root, '.zavorth', 'automation', 'receipts'));
    expect(receipts).toHaveLength(1);
  });

  it('stages external notifications instead of sending them directly', async () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, '.zavorth', 'hooks', 'approval.json'), `${JSON.stringify({
      contractVersion: 'zavorth-automation-hook/1',
      id: 'approval-notice',
      title: 'Approval notice',
      enabled: true,
      event: 'approval.pending',
      aliases: ['before-approval-request'],
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [
        {
          type: 'notification.create',
          channel: 'telegram',
          title: 'Approval pending',
          message: 'Review {{approvalId}}.',
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const service = new ZavorthAutomationHookService({
      now: () => new Date('2026-05-23T11:00:00.000Z'),
    });
    const result = await service.runEvent({
      workspace: root,
      event: 'before-approval-request',
      context: { approvalId: 'appr-1' },
    });

    expect(result.ok).toBe(true);
    expect(result.matchedHooks).toBe(1);
    expect(result.blockedActions).toBe(1);
    const outboxFiles = fs.readdirSync(path.join(root, '.zavorth', 'automation', 'outbox'));
    expect(outboxFiles).toHaveLength(1);
    const outbox = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'automation', 'outbox', outboxFiles[0]), 'utf8'));
    expect(outbox.status).toBe('blocked_requires_approval');
    expect(outbox.channel).toBe('telegram');
  });

  it('ignores disabled hooks and legacy skeleton templates', async () => {
    const root = makeWorkspace();
    fs.writeFileSync(path.join(root, '.zavorth', 'hooks', 'disabled.json'), `${JSON.stringify({
      contractVersion: 'zavorth-automation-hook/1',
      id: 'disabled',
      title: 'Disabled',
      enabled: false,
      event: 'runtime.after_execute',
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [{ type: 'receipt.create' }],
    })}\n`, 'utf8');
    fs.writeFileSync(path.join(root, '.zavorth', 'hooks', 'legacy.json'), `${JSON.stringify({
      contractVersion: 'zavorth-hook-template/1',
      enabled: true,
      actions: [{ type: 'receipt.create' }],
    })}\n`, 'utf8');

    const service = new ZavorthAutomationHookService();
    const result = await service.runEvent({
      workspace: root,
      event: 'runtime.after_execute',
      context: {},
    });

    expect(result.matchedHooks).toBe(0);
    expect(fs.existsSync(path.join(root, '.zavorth', 'automation'))).toBe(false);
  });
});
