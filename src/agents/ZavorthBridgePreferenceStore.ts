import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
  normalizeZavorthUserId,
  ZAVORTH_DEFAULT_USER_ID,
} from '../services/ZavorthDefaultUserId.js';

type ZavorthBridgePreferences = {
  preferredModel: string | null;
  echoMode: boolean;
  updatedAt: string | null;
  userId?: string;
};

const DEFAULT_PREFERENCES: ZavorthBridgePreferences = {
  preferredModel: null,
  echoMode: false,
  updatedAt: null,
};

export type ZavorthBridgePreferenceStoreDeps = {
  userId?: string | null;
  projectRoot?: string | null;
  preferencesFile?: string | null;
};

export class ZavorthBridgePreferenceStore {
  private readonly projectRoot: string;
  private readonly defaultUserId: string;
  private readonly explicitPreferencesFile: string | null;
  private readonly legacyHostFile: string;

  constructor(deps: ZavorthBridgePreferenceStoreDeps = {}) {
    this.projectRoot = path.resolve(String(deps.projectRoot || process.cwd()));
    this.defaultUserId = normalizeZavorthUserId(deps.userId);
    this.explicitPreferencesFile = deps.preferencesFile
      ? path.resolve(deps.preferencesFile)
      : null;
    this.legacyHostFile = path.resolve(
      String(config.zavorthBridgePreferencesFile || path.join(this.projectRoot, 'data', 'runtime', 'zavorth-bridge-preferences.json')),
    );
    fs.mkdirSync(path.dirname(this.resolvePreferencesFile(this.defaultUserId)), { recursive: true });
  }

  public get scopedUserId(): string {
    return this.defaultUserId;
  }

  public forUser(userId?: string | null): ZavorthBridgePreferenceStore {
    return new ZavorthBridgePreferenceStore({
      userId: userId || this.defaultUserId,
      projectRoot: this.projectRoot,
      preferencesFile: this.explicitPreferencesFile,
    });
  }

  public resolvePreferencesFile(userId?: string | null): string {
    if (this.explicitPreferencesFile) return this.explicitPreferencesFile;
    const scoped = normalizeZavorthUserId(userId || this.defaultUserId);
    return path.join(
      this.projectRoot,
      'data',
      'runtime',
      'bridge',
      'users',
      scoped,
      'preferences.json',
    );
  }

  public async getPreferences(userId?: string | null): Promise<ZavorthBridgePreferences> {
    const scoped = normalizeZavorthUserId(userId || this.defaultUserId);
    const file = this.resolvePreferencesFile(scoped);
    try {
      if (fs.existsSync(file)) {
        return this.parsePreferences(await fs.promises.readFile(file, 'utf8'), scoped);
      }
      // Migrate host-global bridge prefs into local-user (or explicit default) once.
      if (
        (scoped === ZAVORTH_DEFAULT_USER_ID || scoped === this.defaultUserId)
        && fs.existsSync(this.legacyHostFile)
        && this.legacyHostFile !== file
      ) {
        const legacy = this.parsePreferences(await fs.promises.readFile(this.legacyHostFile, 'utf8'), scoped);
        await this.writePreferences(file, legacy);
        return legacy;
      }
    } catch (error: unknown) {
      logger.warn('[Zavorth Bridge Preference Store] parsing failed', error);
    }
    return {
      preferredModel: config.zavorthBridgePreferredModelDefault || DEFAULT_PREFERENCES.preferredModel,
      echoMode: DEFAULT_PREFERENCES.echoMode,
      updatedAt: DEFAULT_PREFERENCES.updatedAt,
      userId: scoped,
    };
  }

  public async getPreferredModel(userId?: string | null): Promise<string | null> {
    const preferences = await this.getPreferences(userId);
    return preferences.preferredModel;
  }

  public async isEchoModeActive(userId?: string | null): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    return preferences.echoMode;
  }

  public async setEchoMode(active: boolean, userId?: string | null): Promise<ZavorthBridgePreferences> {
    const scoped = normalizeZavorthUserId(userId || this.defaultUserId);
    const current = await this.getPreferences(scoped);
    const nextPreferences: ZavorthBridgePreferences = {
      ...current,
      userId: scoped,
      echoMode: active,
      updatedAt: new Date().toISOString(),
    };
    await this.writePreferences(this.resolvePreferencesFile(scoped), nextPreferences);
    return nextPreferences;
  }

  public async setPreferredModel(
    model: string | null | undefined,
    userId?: string | null,
  ): Promise<ZavorthBridgePreferences> {
    const scoped = normalizeZavorthUserId(userId || this.defaultUserId);
    const normalized = typeof model === 'string' && model.trim() ? model.trim() : null;
    const current = await this.getPreferences(scoped);
    const nextPreferences: ZavorthBridgePreferences = {
      ...current,
      userId: scoped,
      preferredModel: normalized,
      updatedAt: new Date().toISOString(),
    };
    await this.writePreferences(this.resolvePreferencesFile(scoped), nextPreferences);
    return nextPreferences;
  }

  private parsePreferences(raw: string, userId: string): ZavorthBridgePreferences {
    const parsed = JSON.parse(raw) as Partial<ZavorthBridgePreferences>;
    return {
      preferredModel: typeof parsed.preferredModel === 'string' && parsed.preferredModel.trim()
        ? parsed.preferredModel.trim()
        : null,
      echoMode: typeof parsed.echoMode === 'boolean' ? parsed.echoMode : false,
      updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
        ? parsed.updatedAt
        : null,
      userId,
    };
  }

  private async writePreferences(filePath: string, preferences: ZavorthBridgePreferences): Promise<void> {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(preferences, null, 2), 'utf8');
  }
}
