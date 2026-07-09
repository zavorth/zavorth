import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

type ZavorthBridgePreferences = {
  preferredModel: string | null;
  echoMode: boolean;
  updatedAt: string | null;
};

const DEFAULT_PREFERENCES: ZavorthBridgePreferences = {
  preferredModel: null,
  echoMode: false,
  updatedAt: null,
};

export class ZavorthBridgePreferenceStore {
  private preferencesFile = config.zavorthBridgePreferencesFile;

  constructor() {
    fs.mkdirSync(path.dirname(this.preferencesFile), { recursive: true });
  }

  public async getPreferences(): Promise<ZavorthBridgePreferences> {
    try {
      const raw = await fs.promises.readFile(this.preferencesFile, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ZavorthBridgePreferences>;
      return {
        preferredModel: typeof parsed.preferredModel === 'string' && parsed.preferredModel.trim()
          ? parsed.preferredModel.trim()
          : null,
        echoMode: typeof parsed.echoMode === 'boolean' ? parsed.echoMode : false,
        updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
          ? parsed.updatedAt
          : null,
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Zavorth Bridge Preference Store] parsing failed', error);
    return {
        preferredModel: config.zavorthBridgePreferredModelDefault || DEFAULT_PREFERENCES.preferredModel,
        echoMode: DEFAULT_PREFERENCES.echoMode,
        updatedAt: DEFAULT_PREFERENCES.updatedAt,
      };
  }
  }

  public async getPreferredModel(): Promise<string | null> {
    const preferences = await this.getPreferences();
    return preferences.preferredModel;
  }

  public async isEchoModeActive(): Promise<boolean> {
    const preferences = await this.getPreferences();
    return preferences.echoMode;
  }

  public async setEchoMode(active: boolean): Promise<ZavorthBridgePreferences> {
    const current = await this.getPreferences();
    const nextPreferences: ZavorthBridgePreferences = {
      ...current,
      echoMode: active,
      updatedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(this.preferencesFile, JSON.stringify(nextPreferences, null, 2), 'utf8');
    return nextPreferences;
  }

  public async setPreferredModel(model: string | null | undefined): Promise<ZavorthBridgePreferences> {
    const normalized = typeof model === 'string' && model.trim() ? model.trim() : null;
    const current = await this.getPreferences();
    const nextPreferences: ZavorthBridgePreferences = {
      ...current,
      preferredModel: normalized,
      updatedAt: new Date().toISOString(),
    };

    await fs.promises.writeFile(this.preferencesFile, JSON.stringify(nextPreferences, null, 2), 'utf8');
    return nextPreferences;
  }
}
