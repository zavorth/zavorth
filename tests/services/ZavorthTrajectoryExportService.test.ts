import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ZavorthTrajectoryExportService } from '../../src/services/ZavorthTrajectoryExportService.js';

describe('ZavorthTrajectoryExportService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trajectory-export-'));
    fs.mkdirSync(path.join(root, '.zavorth', 'receipts'), { recursive: true });
    fs.mkdirSync(path.join(root, '.zavorth', 'mnemos'), { recursive: true });
    fs.writeFileSync(path.join(root, '.zavorth', 'receipts', 'run.json'), JSON.stringify({
      id: 'receipt-1',
      prompt: 'Summarize workspace with api_key=secret-value',
      response: 'Workspace summarized.',
      toolCalls: [{ name: 'read_file' }],
      approvalId: 'approval-1',
    }, null, 2));
    fs.writeFileSync(path.join(root, '.zavorth', 'mnemos', 'events.jsonl'), `${JSON.stringify({
      id: 'memory-1',
      content: 'Remember this workflow',
      output: 'Procedure captured',
    })}\n`);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('previews redacted trajectory records without writing files', () => {
    const service = new ZavorthTrajectoryExportService({
      projectRoot: root,
      now: () => new Date('2026-06-02T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({ format: 'jsonl' });

    expect(snapshot.status).toBe('preview');
    expect(snapshot.summary.records).toBe(2);
    expect(snapshot.summary.approvals).toBeGreaterThanOrEqual(1);
    expect(snapshot.records[0]?.instruction).not.toContain('secret-value');
    expect(snapshot.safety.noRawSecretsSerialized).toBe(true);
    expect(snapshot.exportPath).toBeNull();
  });

  it('requires approval before writing trajectory exports', () => {
    const service = new ZavorthTrajectoryExportService({ projectRoot: root });
    const exportPath = path.join('.zavorth', 'exports', 'training.jsonl');

    const snapshot = service.buildSnapshot({ exportPath });

    expect(snapshot.status).toBe('approval-required');
    expect(fs.existsSync(path.join(root, exportPath))).toBe(false);
  });

  it('writes approved exports inside the project root only', () => {
    const service = new ZavorthTrajectoryExportService({ projectRoot: root });
    const exportPath = path.join('.zavorth', 'exports', 'training.jsonl');

    const snapshot = service.buildSnapshot({ exportPath, approvalId: 'approval-1', format: 'jsonl' });

    expect(snapshot.status).toBe('exported');
    const written = fs.readFileSync(path.join(root, exportPath), 'utf8');
    expect(written).toContain('Workspace summarized');
    expect(written).not.toContain('secret-value');
  });

  it('blocks export paths outside the project root', () => {
    const service = new ZavorthTrajectoryExportService({ projectRoot: root });

    expect(() => service.buildSnapshot({
      exportPath: '..\\outside.jsonl',
      approvalId: 'approval-1',
    })).toThrow(/project root/i);
  });
});
