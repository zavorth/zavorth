import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  inspectToolApprovalSigningKeyState,
  resetApprovalSigningKeyCacheForTests,
  resolveToolApprovalSigningKeyDetails,
  resolveToolApprovalSigningKeyFilePath,
} from '../../src/security/ApprovalSigningKeyService';

describe('ApprovalSigningKeyService', () => {
  const originalPrimaryKey = process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY;
  const originalFallbackKey = process.env.ZAVORTH_SECURITY_APPROVAL_SIGNING_KEY;
  const originalKeyFile = process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY_FILE;
  let tempDir: string;

  beforeEach(() => {
    delete process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY;
    delete process.env.ZAVORTH_SECURITY_APPROVAL_SIGNING_KEY;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-approval-key-'));
    process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY_FILE = path.join(tempDir, 'approval-signing-key');
    resetApprovalSigningKeyCacheForTests();
  });

  afterEach(() => {
    resetApprovalSigningKeyCacheForTests();
    restoreEnvValue('ZAVORTH_TOOL_APPROVAL_SIGNING_KEY', originalPrimaryKey);
    restoreEnvValue('ZAVORTH_SECURITY_APPROVAL_SIGNING_KEY', originalFallbackKey);
    restoreEnvValue('ZAVORTH_TOOL_APPROVAL_SIGNING_KEY_FILE', originalKeyFile);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('uses an explicit environment key for advanced/operator deployments', () => {
    process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = 'x'.repeat(32);

    const resolved = resolveToolApprovalSigningKeyDetails();

    expect(resolved).toEqual(expect.objectContaining({
      key: 'x'.repeat(32),
      source: 'env',
      envVar: 'ZAVORTH_TOOL_APPROVAL_SIGNING_KEY',
      created: false,
    }));
    expect(fs.existsSync(resolveToolApprovalSigningKeyFilePath())).toBe(false);
  });

  it('generates and persists a local user key when no env override exists', () => {
    const first = resolveToolApprovalSigningKeyDetails();
    resetApprovalSigningKeyCacheForTests();
    const second = resolveToolApprovalSigningKeyDetails();

    expect(first.source).toBe('local-file');
    expect(first.created).toBe(true);
    expect(first.key).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toEqual(expect.objectContaining({
      key: first.key,
      source: 'local-file',
      created: false,
    }));
    expect(fs.readFileSync(first.filePath!, 'utf8').trim()).toBe(first.key);
  });

  it('archives malformed local keys and creates a replacement', () => {
    const filePath = resolveToolApprovalSigningKeyFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'too-short', 'utf8');

    const resolved = resolveToolApprovalSigningKeyDetails();

    expect(resolved.key).toMatch(/^[a-f0-9]{64}$/);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readdirSync(path.dirname(filePath)).some((name) => name.includes('.invalid-'))).toBe(true);
  });

  it('rejects short explicit environment keys instead of silently weakening approvals', () => {
    process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = 'short';

    expect(() => resolveToolApprovalSigningKeyDetails()).toThrow('at least 32 characters');
  });

  it('inspects signing key posture without creating the local key file', () => {
    const filePath = resolveToolApprovalSigningKeyFilePath();

    const inspection = inspectToolApprovalSigningKeyState(process.env);

    expect(inspection).toEqual(expect.objectContaining({
      status: 'ready-on-demand',
      source: 'missing-local-file',
      willAutoCreateOnUse: true,
      filePath,
    }));
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('reports invalid explicit keys as blocked in read-only inspection', () => {
    process.env.ZAVORTH_TOOL_APPROVAL_SIGNING_KEY = 'short';

    expect(inspectToolApprovalSigningKeyState(process.env)).toEqual(expect.objectContaining({
      status: 'blocked',
      source: 'invalid-env',
      envVar: 'ZAVORTH_TOOL_APPROVAL_SIGNING_KEY',
    }));
  });
});

function restoreEnvValue(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
