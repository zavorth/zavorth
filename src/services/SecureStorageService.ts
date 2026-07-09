import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike';

const ENCRYPTION_PREFIX = 'enc:v1:';

export class SecureStorageService {
  public isEnabled(): boolean {
    return this.getKeyBuffer() !== null;
  }

  public encryptString(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value);
    const key = this.getKeyBuffer();
    if (!key) {
      return normalized;
    }

    if (this.isEncrypted(normalized)) {
      return normalized;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${ENCRYPTION_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  public decryptString(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value);
    if (!this.isEncrypted(normalized)) {
      return normalized;
    }

    const key = this.getKeyBuffer();
    if (!key) {
      return normalized;
    }

    try {
      const payload = normalized.slice(ENCRYPTION_PREFIX.length);
      const [ivBase64, tagBase64, encryptedBase64] = payload.split(':');
      const iv = Buffer.from(ivBase64 || '', 'base64');
      const tag = Buffer.from(tagBase64 || '', 'base64');
      const encrypted = Buffer.from(encryptedBase64 || '', 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn(`[SecureStorage] Failed to decrypt value: ${(err as Error).message}`);
      return normalized;
    }
  }

  public encryptJson(value: Record<string, unknown> | null | undefined): string {
    return this.encryptString(JSON.stringify(value || {})) || '{}';
  }

  public decryptJson(value: string | null | undefined): Record<string, unknown> {
    const raw = this.decryptString(value) || '{}';
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn(`[SecureStorage] Failed to parse decrypted JSON: ${(err as Error).message}`);
      return {};
    }
  }

  public isEncrypted(value: string | null | undefined): boolean {
    return String(value || '').startsWith(ENCRYPTION_PREFIX);
  }

  public readSecret(name: string): string | null {
    const key = this.normalizeSecretName(name);
    if (!key) {
      return null;
    }

    const store = this.readSecretStore();
    const value = store[key];
    return typeof value === 'string' ? this.decryptString(value) : null;
  }

  public writeSecret(name: string, value: string | null | undefined): boolean {
    const key = this.normalizeSecretName(name);
    const normalizedValue = String(value || '').trim();
    if (!key || !normalizedValue) {
      return false;
    }

    const store = this.readSecretStore();
    store[key] = this.encryptString(normalizedValue) || normalizedValue;
    return this.writeSecretStore(store);
  }

  public deleteSecret(name: string): boolean {
    const key = this.normalizeSecretName(name);
    if (!key) {
      return false;
    }

    const store = this.readSecretStore();
    if (!(key in store)) {
      return true;
    }

    delete store[key];
    return this.writeSecretStore(store);
  }

  private getKeyBuffer(): Buffer | null {
    const rawKey = String(config.dbEncryptionKey || '').trim();
    if (!rawKey) {
      const fileKey = this.getOrCreateFileKey();
      if (!fileKey) {
        return null;
      }
      return crypto.createHash('sha256').update(fileKey).digest();
    }

    return crypto.createHash('sha256').update(rawKey).digest();
  }

  private getOrCreateFileKey(): string | null {
    const keyFile = String(config.dbEncryptionKeyFile || '').trim();
    if (!keyFile) {
      return null;
    }

    try {
      if (!fs.existsSync(keyFile)) {
        fs.mkdirSync(path.dirname(keyFile), { recursive: true });
        const generated = crypto.randomBytes(32).toString('base64');
        fs.writeFileSync(keyFile, generated, 'utf8');
        return generated;
      }

      return fs.readFileSync(keyFile, 'utf8').trim() || null;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn(`[SecureStorage] Failed to read or create key file: ${(err as Error).message}`);
      return null;
    }
  }

  private readSecretStore(): Record<string, string> {
    const file = this.getSecretStoreFile();
    if (!file || !fs.existsSync(file)) {
      return {};
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      const store: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === 'string') {
          store[key] = value;
        }
      }
      return store;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn(`[SecureStorage] Failed to read secret store: ${(err as Error).message}`);
      return {};
    }
  }

  private writeSecretStore(store: Record<string, string>): boolean {
    const file = this.getSecretStoreFile();
    if (!file) {
      return false;
    }

    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      return true;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error(`[SecureStorage] Failed to write secret store: ${(err as Error).message}`);
      return false;
    }
  }

  private getSecretStoreFile(): string | null {
    const configured = String((config as { secureSecretsFile?: string }).secureSecretsFile || '').trim();
    return configured || path.resolve(config.projectRoot, 'data', 'runtime', 'secure-secrets.json');
  }

  private normalizeSecretName(name: string): string {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]/g, '-')
      .slice(0, 120);
  }
}
