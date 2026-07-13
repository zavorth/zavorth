import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  configureScaleToZeroRuntime,
  getScaleToZeroManager,
  resetScaleToZeroRuntimeForTests,
} from '../../src/gateways/ScaleToZeroRuntime.js';

describe('ScaleToZeroRuntime', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scale-runtime-'));
    resetScaleToZeroRuntimeForTests();
  });

  afterEach(() => {
    resetScaleToZeroRuntimeForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('shares a singleton manager and accepts configuration', () => {
    const stateFilePath = path.join(tempDir, 'scale.json');
    const a = getScaleToZeroManager({ stateFilePath });
    const b = configureScaleToZeroRuntime({ enabled: true, defaultIdleTimeoutMs: 1200 }, { stateFilePath });
    expect(a).toBe(b);
    expect(b.getConfig().enabled).toBe(true);
    expect(b.getConfig().defaultIdleTimeoutMs).toBe(1200);
    b.recordActivity('telegram');
    expect(b.getState('telegram')?.isIdle).toBe(false);
  });
});
