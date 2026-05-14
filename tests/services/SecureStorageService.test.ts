import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index';
import { SecureStorageService } from '../../src/services/SecureStorageService';

describe('SecureStorageService secret store', () => {
  const originalKeyFile = config.dbEncryptionKeyFile;
  const originalSecretsFile = (config as any).secureSecretsFile;
  const originalKey = config.dbEncryptionKey;
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-secure-storage-'));
    (config as any).dbEncryptionKey = '';
    (config as any).dbEncryptionKeyFile = path.join(tempDir, 'field.key');
    (config as any).secureSecretsFile = path.join(tempDir, 'secure-secrets.json');
  });

  afterEach(() => {
    (config as any).dbEncryptionKey = originalKey;
    (config as any).dbEncryptionKeyFile = originalKeyFile;
    (config as any).secureSecretsFile = originalSecretsFile;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores named secrets encrypted at rest and reads them back without exposing plaintext in the file', () => {
    const storage = new SecureStorageService();

    expect(storage.writeSecret('High Risk Approval TOTP', 'totp-secret-value')).toBe(true);
    expect(storage.readSecret('high-risk-approval-totp')).toBe('totp-secret-value');

    const rawStore = fs.readFileSync((config as any).secureSecretsFile, 'utf8');
    expect(rawStore).not.toContain('totp-secret-value');
    expect(rawStore).toContain('enc:v1:');
  });
});
