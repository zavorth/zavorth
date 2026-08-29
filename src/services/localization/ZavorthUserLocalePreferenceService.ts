/**
 * Canonical user locale preference service.
 * Resolves the effective locale for a user across all surfaces and channels,
 * backed by local-first per-user persistence.
 *
 * Precedence: stored preference > surface signal (learned) > system locale > en.
 *
 * Strict Clean Code: English-first, zero `any`, no regex, no silent catches.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ZavorthLocalizationService } from './ZavorthLocalizationService.js';
import { logger } from '../../logger.js';

export interface UserLocalePreferenceServiceOptions {
  storageDir?: string;
  localizationService?: ZavorthLocalizationService;
}

export class ZavorthUserLocalePreferenceService {
  private readonly storageDir: string;
  private readonly localizationService: ZavorthLocalizationService;
  private readonly storePath: string;
  private readonly cache = new Map<string, string>();
  private loaded = false;

  public constructor(options: UserLocalePreferenceServiceOptions = {}) {
    this.storageDir = options.storageDir || path.join(os.homedir(), '.zavorth', 'locales');
    this.localizationService = options.localizationService || new ZavorthLocalizationService();
    this.storePath = path.join(this.storageDir, 'user-locales.json');
  }

  /**
   * Resolves the effective locale for a user.
   * Precedence: persisted preference, surface signal (learned on first sight),
   * system locale detection, English fallback.
   */
  public async resolveUserLocale(userId: string, surfaceSignal?: string | null): Promise<string> {
    const stored = await this.getStoredLocale(userId);
    if (stored) {
      return stored;
    }

    const signal = this.localizationService.normalizeLocaleTag(String(surfaceSignal || '').trim());
    if (signal) {
      await this.recordUserLocale(userId, signal);
      return signal;
    }

    const system = this.localizationService.detectSystemLocale();
    return system;
  }

  /**
   * Persists a validated locale for a user.
   * Only valid locale tags (recognized by the localization system) are stored.
   */
  public async recordUserLocale(userId: string, locale: string): Promise<void> {
    const normalized = this.localizationService.normalizeLocaleTag(String(locale || '').trim());
    if (!normalized) {
      return;
    }

    this.cache.set(userId, normalized);
    await this.persistStore();
  }

  /**
   * Retrieves a previously stored locale for a user, or null if none exists.
   */
  public async getStoredLocale(userId: string): Promise<string | null> {
    if (!this.loaded) {
      await this.loadStore();
    }
    return this.cache.get(userId) || null;
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[UserLocalePreference] Could not create storage dir: ${msg}`);
    }
  }

  private async loadStore(): Promise<Record<string, string>> {
    if (this.loaded) {
      return Object.fromEntries(this.cache);
    }

    this.loaded = true;
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [userId, locale] of Object.entries(parsed)) {
          this.cache.set(userId, locale);
        }
        return parsed;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[UserLocalePreference] Could not load persisted preferences: ${msg}`);
    }

    return {};
  }

  private async persistStore(): Promise<void> {
    await this.ensureStorageDir();

    try {
      const store = Object.fromEntries(this.cache);
      fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[UserLocalePreference] Could not persist preferences: ${msg}`);
    }
  }
}