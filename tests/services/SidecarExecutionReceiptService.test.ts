import fs from 'fs';
import os from 'os';
import path from 'path';
import { SidecarExecutionReceiptService } from '../../src/services/SidecarExecutionReceiptService';

describe('SidecarExecutionReceiptService', () => {
  it('persists append-only sidecar receipts and builds a compact snapshot', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sidecar-receipts-'));
    const receiptFile = path.join(dir, 'receipts.jsonl');
    const service = new SidecarExecutionReceiptService({
      receiptFile,
      now: () => new Date('2026-05-06T12:00:00.000Z'),
    });

    service.record({
      sidecarId: 'runtime-shell-sidecar',
      kind: 'shell',
      action: 'echo#safe',
      status: 'succeeded',
      auditId: 'audit-shell',
      runtime: 'DockerSandboxRuntime',
      isolationLevel: 'container',
      durationMs: 12,
      exitCode: 0,
      summary: 'Shell sidecar executou em container.',
    });
    service.record({
      sidecarId: 'browser-sidecar',
      kind: 'browser',
      action: 'browser_navigate',
      status: 'blocked',
      auditId: 'audit-browser',
      runtime: 'browser-sidecar',
      isolationLevel: 'browser-sidecar',
      durationMs: 3,
      exitCode: null,
      summary: 'Browser sidecar remoto not configurado.',
    });

    const snapshot = service.buildSnapshot(10);

    expect(snapshot.totalReceipts).toBe(2);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      shellReceipts: 1,
      browserReceipts: 1,
      succeeded: 1,
      blocked: 1,
    }));
    expect(snapshot.recentReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ sidecarId: 'runtime-shell-sidecar', auditId: 'audit-shell' }),
      expect.objectContaining({ sidecarId: 'browser-sidecar', auditId: 'audit-browser' }),
    ]));
  });
});
