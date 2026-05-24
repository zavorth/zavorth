import fs from 'fs';
import os from 'os';
import path from 'path';
import { ToolHookPipelineService } from '../../src/services/ToolHookPipelineService.js';

describe('ToolHookPipelineService automation hooks', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('runs governed automation hooks after workspace hooks for the same event', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tool-hook-pipeline-'));
    tempDirs.push(root);
    fs.mkdirSync(path.join(root, '.zavorth', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(root, '.zavorth', 'hooks', 'receipt.json'), `${JSON.stringify({
      contractVersion: 'zavorth-automation-hook/1',
      id: 'receipt',
      title: 'Receipt',
      enabled: true,
      event: 'runtime.after_execute',
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [
        {
          type: 'receipt.create',
          title: 'Tool completed',
          summary: '{{toolName}} completed.',
        },
      ],
    }, null, 2)}\n`, 'utf8');

    const service = new ToolHookPipelineService({
      now: () => new Date('2026-05-23T12:00:00.000Z'),
    });
    const result = await service.run({
      event: 'runtime.after_execute',
      workspace: root,
      context: { toolName: 'read_file' },
    });

    expect(result.ok).toBe(true);
    expect(result.automationHookCount).toBe(1);
    expect(result.automationActionCount).toBe(1);
    expect(result.automationBlockedActionCount).toBe(0);
    expect(fs.readdirSync(path.join(root, '.zavorth', 'automation', 'receipts'))).toHaveLength(1);
  });
});
