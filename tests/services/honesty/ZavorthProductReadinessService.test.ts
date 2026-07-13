import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthProductReadinessService } from '../../../src/services/ZavorthProductReadinessService.js';
import { setLearningRuntimeMode } from '../../../src/services/ZavorthLearningRuntimePolicy.js';

describe('ZavorthProductReadinessService', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-readiness-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds honesty matrix with learning and channel tiers', () => {
    setLearningRuntimeMode('autonomous', { projectRoot: tempDir });
    const snapshot = new ZavorthProductReadinessService().buildSnapshot({
      projectRoot: tempDir,
      env: {},
    });
    expect(snapshot.contractVersion).toBe('zavorth-product-readiness/1');
    expect(snapshot.learning.mode).toBe('autonomous');
    expect(snapshot.channels.length).toBeGreaterThan(5);
    expect(snapshot.scaleToZero.notCloudHostHibernation).toBe(true);
    expect(snapshot.cells.some((cell) => cell.id === 'learning-mode')).toBe(true);
    expect(snapshot.cells.some((cell) => cell.id === 'channel-tiers')).toBe(true);
    expect(snapshot.cells.some((cell) => cell.id === 'cloud-host-idle')).toBe(true);
  });
});
