import fs from 'fs';
import os from 'os';
import path from 'path';
import { EnvFileService } from '../../src/services/EnvFileService';

describe('EnvFileService', () => {
  let tempDir: string;
  let envFilePath: string;
  let service: EnvFileService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-envfile-'));
    envFilePath = path.join(tempDir, '.env');
    service = new EnvFileService();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('removes matching keys and leaves other lines intact', () => {
    service.upsertEntries(envFilePath, [
      { key: 'LLM_PROVIDER', value: 'acme-ai', overwrite: true },
      { key: 'ACME_AI_BASE_URL', value: 'https://acme.example/v1', overwrite: true },
      { key: 'ACME_AI_API_KEY', value: '', overwrite: true },
      { key: 'KEEP_ME', value: 'preserved', overwrite: true },
    ]);

    const report = service.removeEntries(envFilePath, ['ACME_AI_BASE_URL', 'ACME_AI_API_KEY', 'LLM_PROVIDER']);

    expect(report.removedKeys).toEqual(expect.arrayContaining(['ACME_AI_BASE_URL', 'ACME_AI_API_KEY', 'LLM_PROVIDER']));
    const content = fs.readFileSync(envFilePath, 'utf8');
    expect(content).not.toContain('ACME_AI_BASE_URL');
    expect(content).not.toContain('ACME_AI_API_KEY');
    expect(content).not.toContain('LLM_PROVIDER');
    expect(content).toContain('KEEP_ME=preserved');
  });

  it('reports missing keys and does not rewrite the file when nothing is removed', () => {
    service.upsertEntries(envFilePath, [{ key: 'KEEP_ME', value: 'x', overwrite: true }]);
    const originalContent = fs.readFileSync(envFilePath, 'utf8');

    const report = service.removeEntries(envFilePath, ['MISSING_KEY']);

    expect(report.removedKeys).toEqual([]);
    expect(report.missingKeys).toEqual(['MISSING_KEY']);
    expect(fs.readFileSync(envFilePath, 'utf8')).toBe(originalContent);
  });

  it('returns all keys as missing when the env file does not exist', () => {
    const report = service.removeEntries(path.join(tempDir, 'absent.env'), ['A', 'B']);

    expect(report.removedKeys).toEqual([]);
    expect(report.missingKeys).toEqual(['A', 'B']);
  });
});
