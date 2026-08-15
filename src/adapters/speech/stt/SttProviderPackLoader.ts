import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../../logger.js';
import {
  sttProviderConfigSchema,
  type SttProviderConfig,
} from './SttProviderConfigSchema.js';

export const STT_PROVIDER_CONFIG_FILENAME = 'provider.json';

/**
 * Auto-discovers STT provider packs from a directory.
 *
 * Layout:
 *   <sttProvidersDir>/<providerId>/provider.json
 *
 * Invalid packs are skipped with a warning — one broken provider never blocks
 * the rest. Config validation happens here at load time (Zod boundary).
 */
export class SttProviderPackLoader {
  private readonly providersDir: string;

  constructor(providersDir: string) {
    this.providersDir = providersDir;
  }

  public loadAll(): SttProviderConfig[] {
    if (!fs.existsSync(this.providersDir)) {
      return [];
    }
    const entries = fs.readdirSync(this.providersDir, { withFileTypes: true });
    const configs: SttProviderConfig[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const providerId = entry.name;
      const configFile = path.join(this.providersDir, providerId, STT_PROVIDER_CONFIG_FILENAME);
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

  private loadPack(providerId: string, configFile: string): SttProviderConfig | null {
    try {
      const raw = fs.readFileSync(configFile, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      const config = sttProviderConfigSchema.parse(parsed);
      if (config.providerId !== providerId) {
        logger.warn(`[STT] Pack "${providerId}" declares providerId "${config.providerId}"; using directory name "${providerId}".`);
        return { ...config, providerId };
      }
      logger.info(`[STT] Loaded provider pack: ${providerId} (${config.transport}).`);
      return config;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`[STT] Skipped invalid provider pack "${providerId}": ${message}`);
      return null;
    }
  }
}
