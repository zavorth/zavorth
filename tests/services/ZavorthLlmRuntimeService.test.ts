import fs from 'fs';
import os from 'os';
import path from 'path';

import { ZavorthLlmRuntimeService } from '../../src/services/ZavorthLlmRuntimeService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-llm-runtime-test-'));
}

describe('ZavorthLlmRuntimeService', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('should create instance with default provider', () => {
    const svc = new ZavorthLlmRuntimeService();
    expect(svc).toBeDefined();
    expect(svc.getPreferredProviderName()).toBeTruthy();
  });

  it('should create instance with custom provider', () => {
    const svc = new ZavorthLlmRuntimeService('gemini');
    expect(svc.getPreferredProviderName()).toBe('gemini');
  });

  it('should report provider availability', () => {
    const svc = new ZavorthLlmRuntimeService();
    const result = svc.isProviderAvailable('nonexistent');
    expect(typeof result).toBe('boolean');
  });
});
