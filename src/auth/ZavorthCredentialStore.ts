import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type AuthProfile = {
  id: string;
  provider: string;
  profileId: string;
  kind: string;
  createdAt: number;
  updatedAt: number;
  accessToken: string;
};

type EncryptedSecret = {
  iv: string;
  authTag: string;
  ciphertext: string;
};

type StoredProfile = Omit<AuthProfile, 'accessToken'> & {
  accessTokenEncrypted: EncryptedSecret;
};

type StoreFile = {
  version: 1;
  profiles: StoredProfile[];
};

export type ZavorthCredentialStoreOptions = {
  rootPath: string;
  encryptionKey?: string;
};

const STORE_SUBDIRECTORY = path.join('.zavorth', 'credentials');
const STORE_FILENAME = 'auth-profiles.json';

export class ZavorthCredentialStore {
  private readonly rootPath: string;
  private readonly encryptionKey: Buffer | null;

  constructor(options: ZavorthCredentialStoreOptions) {
    this.rootPath = options.rootPath;
    this.encryptionKey = options.encryptionKey ? deriveKey(options.encryptionKey) : null;
  }

  saveProfile(profile: AuthProfile): void {
    const key = this.requireEncryptionKey();
    const storedProfile: StoredProfile = {
      id: profile.id,
      provider: profile.provider,
      profileId: profile.profileId,
      kind: profile.kind,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      accessTokenEncrypted: encryptSecret(profile.accessToken, key),
    };
    const store = this.readStore();
    const nextProfiles = [...store.profiles.filter((item) => item.id !== profile.id), storedProfile];
    this.writeStore({ version: 1, profiles: nextProfiles });
  }

  getProfile(id: string): AuthProfile | null {
    const key = this.requireEncryptionKey();
    const store = this.readStore();
    const storedProfile = store.profiles.find((item) => item.id === id);
    if (!storedProfile) return null;
    return {
      id: storedProfile.id,
      provider: storedProfile.provider,
      profileId: storedProfile.profileId,
      kind: storedProfile.kind,
      createdAt: storedProfile.createdAt,
      updatedAt: storedProfile.updatedAt,
      accessToken: decryptSecret(storedProfile.accessTokenEncrypted, key),
    };
  }

  private requireEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      throw new Error('ZavorthCredentialStore requires a 256-bit encryptionKey before persisting secrets.');
    }
    return this.encryptionKey;
  }

  private get storePath(): string {
    return path.join(this.rootPath, STORE_SUBDIRECTORY, STORE_FILENAME);
  }

  private readStore(): StoreFile {
    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as StoreFile;
      return Array.isArray(parsed?.profiles) ? parsed : { version: 1, profiles: [] };
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') return { version: 1, profiles: [] };
      throw error;
    }
  }

  private writeStore(store: StoreFile): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }
}

function deriveKey(rawKey: string): Buffer {
  const hexKey = Buffer.from(rawKey, 'hex');
  if (hexKey.length === 32) return hexKey;
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
}

function encryptSecret(plaintext: string, key: Buffer): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };
}

function decryptSecret(secret: EncryptedSecret, key: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(secret.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(secret.authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}