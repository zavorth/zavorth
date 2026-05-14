import fs from 'fs';
import os from 'os';
import path from 'path';
import { ComputerUseWatchModePolicyFileService } from '../../src/services/ComputerUseWatchModePolicyFileService.js';

describe('ComputerUseWatchModePolicyFileService', () => {
  it('normalizes and persists watch mode policy documents', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-watch-policy-'));
    try {
      const policyFile = path.join(tempDir, 'watch-mode-policy.json');
      const service = new ComputerUseWatchModePolicyFileService({
        now: () => new Date('2026-04-12T12:45:00.000Z'),
        policyFile,
      });

      const saved = service.savePolicy({
        strictApprovalDefault: false,
        allowedApps: ['Chrome', ' chrome ', 'Discord'],
        allowedSites: ['https://docs.example.com/path', 'docs.example.com', 'discord.com'],
        screenshotTtlMs: 10_000,
        maxScreenshotBytes: 4096,
        screenshotRedactionMode: 'metadata-only',
        sensitiveScreenPolicy: 'redact',
        defaultBudget: {
          maxIterations: 3,
          maxDurationMs: 20_000,
          maxScreenshots: 2,
          maxMemoryMb: 256,
          idleTtlMs: 5000,
          delayBetweenActionsMs: 900,
          screenshotTtlMs: 10_000,
          maxScreenshotBytes: 4096,
          screenshotRedactionMode: 'metadata-only',
          sensitiveScreenPolicy: 'redact',
        },
      });

      expect(saved.updatedAt).toBe('2026-04-12T12:45:00.000Z');
      expect(saved.strictApprovalDefault).toBe(false);
      expect(saved.allowedApps).toEqual(['chrome', 'discord']);
      expect(saved.allowedSites).toEqual(['docs.example.com', 'discord.com']);
      expect(saved.screenshotTtlMs).toBe(10_000);
      expect(saved.maxScreenshotBytes).toBe(4096);
      expect(saved.screenshotRedactionMode).toBe('metadata-only');
      expect(saved.sensitiveScreenPolicy).toBe('redact');
      expect(saved.defaultBudget).toEqual(expect.objectContaining({
        maxIterations: 3,
        maxScreenshots: 2,
        screenshotRedactionMode: 'metadata-only',
      }));
      expect(service.readPolicy()).toEqual(saved);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
