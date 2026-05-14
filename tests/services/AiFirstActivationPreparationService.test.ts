import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AiFirstActivationPreparationService } from '../../src/services/AiFirstActivationPreparationService.js';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ai-first-prepare-'));
}

function createService(outputDir: string): AiFirstActivationPreparationService {
  let counter = 0;
  return new AiFirstActivationPreparationService({
    outputDir,
    runtime: {
      now: () => new Date('2026-05-06T23:59:00.000Z'),
      idFactory: (prefix) => `${prefix}-${++counter}`,
    },
  });
}

describe('AiFirstActivationPreparationService', () => {
  it('writes a Phase 10 snapshot and returns ready-to-run activation commands', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.prepare({
        ownerApprovalId: 'owner-approved-prepare',
      });

      expect(result.status).toBe('ready');
      expect(result.written).toBe(true);
      expect(fs.existsSync(result.snapshotPath)).toBe(true);
      expect(result.snapshot.recommendation.readiness).toBe('ready-for-owner-controlled-default');
      expect(result.commands.plan).toContain('zavorth ai-first plan');
      expect(result.commands.plan).toContain(result.snapshotPath);
      expect(result.commands.plan).toContain('owner-approved-prepare');
      expect(result.commands.activate).toContain('--confirm-owner-controlled-default');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('supports preview mode without writing the snapshot', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.prepare({
        write: false,
        outputPath: path.join(dir, 'preview.json'),
      });

      expect(result.status).toBe('ready');
      expect(result.written).toBe(false);
      expect(fs.existsSync(result.snapshotPath)).toBe(false);
      expect(result.commands.plan).toContain('--owner-approval-id <id>');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('renders a concise operator handoff', () => {
    const dir = tempDir();
    try {
      const service = createService(dir);
      const result = service.prepare({
        ownerApprovalId: 'owner-approved-prepare',
      });
      const text = service.renderText(result);

      expect(text).toContain('Zavorth AI-first activation preparation');
      expect(text).toContain('Status: ready');
      expect(text).toContain('Next commands:');
      expect(text).toContain('zavorth ai-first activate');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
