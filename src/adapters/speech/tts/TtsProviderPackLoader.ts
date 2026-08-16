import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger.js';
import {
  ttsProviderConfigSchema,
  type TtsProviderConfig,
} from './TtsProviderConfigSchema.js';

export const TTS_PROVIDER_CONFIG_FILENAME = 'provider.json';

/**
 * Auto-discovers TTS provider packs from a directory.
 *
 * Layout:
 *   <ttsProvidersDir>/<providerId>/provider.json
 *
 * Invalid packs are skipped with a warning — one broken provider never blocks
 * the rest. Config validation happens here at load time (Zod boundary).
 */
export class TtsProviderPackLoader {
  private readonly providersDir: string;

  constructor(providersDir: string) {
    this.providersDir = providersDir;
  }

  public loadAll(): TtsProviderConfig[] {
    if (!fs.existsSync(this.providersDir)) {
      return [];
    }
    const entries = fs.readdirSync(this.providersDir, { withFileTypes: true });
    const configs: TtsProviderConfig[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const providerId = entry.name;
      const configFile = path.join(this.providersDir, providerId, TTS_PROVIDER_CONFIG_FILENAME);
      if (!fs.existsSync(configFile)) {
        continue;
      }
      const config = this.loadPack(providerId, configFile);
      if (config) {
        configs.push(config);
      }
    }
    return configs;
  }

  private loadPack(providerId: string, configFile: string): TtsProviderConfig | null {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const config = ttsProviderConfigSchema.parse(parsed);
      if (config.providerId !== providerId) {
        logger.warn(`[TTS] Pack "${providerId}" declares providerId "${config.providerId}"; using directory name "${providerId}".`);
        return { ...config, providerId };
      }
      logger.info(`[TTS] Loaded provider pack: ${providerId} (${config.transport}).`);
      return config;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[TTS] Skipped invalid provider pack "${providerId}": ${message}`);
      return null;
    }
  }
}
