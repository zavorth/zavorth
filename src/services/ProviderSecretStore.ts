import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../storage/Database.js';

export interface SecretSaveResult {
  secretRef: string;
  keyFingerprint: string;
  keySuffix: string;
  storeType: string;
}

export abstract class ProviderSecretStore {
  abstract saveSecret(providerId: string, rawKey: string): Promise<SecretSaveResult>;
  abstract getSecret(secretRef: string): Promise<string | null>;
  abstract deleteSecret(secretRef: string): Promise<boolean>;
  abstract isAvailable(): boolean;
}

export class LocalEncryptedProviderSecretStore extends ProviderSecretStore {
  private static instance: LocalEncryptedProviderSecretStore;

  private constructor() {
    super();
  }

  public static getInstance(): LocalEncryptedProviderSecretStore {
    if (!LocalEncryptedProviderSecretStore.instance) {
      LocalEncryptedProviderSecretStore.instance = new LocalEncryptedProviderSecretStore();
    }
    return LocalEncryptedProviderSecretStore.instance;
  }

  public isAvailable(): boolean {
    return true; // Fallback is always available
  }

  private getMasterSeed(): string {
    const keyPath = path.join(os.homedir(), '.zavorth', 'provider_master_key');
    try {
      if (!fs.existsSync(path.dirname(keyPath))) {
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      }
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8').trim();
      }
      const newSeed = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, newSeed, { mode: 0o600 });
      return newSeed;
    } catch (err: any) {
      throw new Error(`Critical Error: Could not read or create master key for ProviderSecretStore. Encrypted fallback requires a secure persistent seed. ${err.message}`);
    }
  }

  private deriveKey(salt: Buffer): Buffer {
    const seed = this.getMasterSeed();
    // PBKDF2 with 100,000 iterations for AES-256 (32 bytes)
    return crypto.pbkdf2Sync(seed, salt, 100000, 32, 'sha256');
  }

  public async saveSecret(providerId: string, rawKey: string): Promise<SecretSaveResult> {
    if (!rawKey || typeof rawKey !== 'string') {
      throw new Error('Invalid raw key provided to secret store');
    }

    const db = await Database.getInstance();
    const secretRef = crypto.randomUUID();
    const keySuffix = rawKey.length > 4 ? rawKey.substring(rawKey.length - 4) : '***';
    const keyFingerprint = crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 16);
    
    // Encrypt
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = this.deriveKey(salt);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(rawKey, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const storeType = 'encrypted_local_fallback';

    db.run(
      `INSERT INTO provider_secret_refs (secret_ref, provider_id, key_fingerprint, key_suffix, secret_store_type, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [secretRef, providerId, keyFingerprint, keySuffix, storeType]
    );

    db.run(
      `INSERT INTO provider_secret_ciphertexts (secret_ref, ciphertext, iv, auth_tag, salt) 
       VALUES (?, ?, ?, ?, ?)`,
      [secretRef, ciphertext, iv.toString('hex'), authTag, salt.toString('hex')]
    );

    return {
      secretRef,
      keyFingerprint,
      keySuffix,
      storeType
    };
  }

  public async getSecret(secretRef: string): Promise<string | null> {
    const db = await Database.getInstance();
    const row = db.get<{ ciphertext: string, iv: string, auth_tag: string, salt: string }>(
      `SELECT ciphertext, iv, auth_tag, salt FROM provider_secret_ciphertexts WHERE secret_ref = ?`,
      [secretRef]
    );

    if (!row) {
      return null;
    }

    try {
      const salt = Buffer.from(row.salt, 'hex');
      const iv = Buffer.from(row.iv, 'hex');
      const authTag = Buffer.from(row.auth_tag, 'hex');
      const ciphertext = row.ciphertext;

      const key = this.deriveKey(salt);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      try {
        const LogRepository = (await import('../storage/LogRepository.js')).LogRepository;
        new LogRepository().log('security', 'security_audit', 'provider_secret_store_fallback_used', {
          status: 'success',
          userId: 'system',
          context: { secretRef, operation: 'get' }
        });
      } catch (e) {}

      return decrypted;
    } catch (err) {
      console.warn('[SECURITY] Failed to decrypt provider secret. Database might be corrupted or moved to a different machine.');
      return null;
    }
  }

  public async deleteSecret(secretRef: string): Promise<boolean> {
    const db = await Database.getInstance();
    await db.run(`DELETE FROM provider_secret_refs WHERE secret_ref = ?`, [secretRef]);
    await db.run(`DELETE FROM provider_secret_ciphertexts WHERE secret_ref = ?`, [secretRef]);
    return true;
  }
}
