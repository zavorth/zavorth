import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthCredentialStore, type AuthProfile } from '../../src/auth/ZavorthCredentialStore';

describe('ZavorthCredentialStore', () => {
  const profile: AuthProfile = {
    id: 'profile-1',
    provider: 'generic-provider',
    profileId: 'profile-1',
    kind: 'api_key',
    createdAt: 1,
    updatedAt: 1,
    accessToken: 'secret-access-token',
  };

  it('refuses to persist secrets without a 256-bit encryption key', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-credentials-'));
    const store = new ZavorthCredentialStore({ rootPath });
    expect(() => store.saveProfile({ ...profile })).toThrow(/requires .*encryptionKey/i);
    fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('encrypts persisted secrets and decrypts them only with the configured key', () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-credentials-'));
    const encryptionKey = 'ab'.repeat(32);
    const store = new ZavorthCredentialStore({ rootPath, encryptionKey });
    store.saveProfile({ ...profile });

    const storePath = path.join(rootPath, '.zavorth', 'credentials', 'auth-profiles.json');
    const persisted = fs.readFileSync(storePath, 'utf8');
    expect(persisted).not.toContain('secret-access-token');
    expect(new ZavorthCredentialStore({ rootPath, encryptionKey }).getProfile(profile.id)?.accessToken).toBe(
      'secret-access-token',
    );
    fs.rmSync(rootPath, { recursive: true, force: true });
  });
});
