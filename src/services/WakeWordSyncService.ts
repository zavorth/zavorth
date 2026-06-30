/**
 * WakeWordSyncService — Synchronizes agent name with wake word configuration.
 *
 * When a user sets an agent name during onboarding, this service ensures
 * the name is added to the wake word list for voice activation.
 *
 * Usage:
 *   const sync = new WakeWordSyncService();
 *   await sync.syncAgentNameToWakeWords('Zavorth');
 */

import fs from 'fs';
import path from 'path';

export interface WakeWordConfig {
  wakeWords: string[];
  agentName: string;
  updatedAt: string;
}

export class WakeWordSyncService {
  private readonly configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? path.join(process.cwd(), '.zavorth', 'wake-words.json');
  }

  /**
   * Syncs agent name to wake word list.
   * If the agent name is not already in the list, it's added.
   */
  async syncAgentNameToWakeWords(agentName: string): Promise<WakeWordConfig> {
    const config = await this.loadConfig();

    // Normalize agent name (lowercase, trim)
    const normalizedName = agentName.toLowerCase().trim();

    // Check if already present
    if (!config.wakeWords.includes(normalizedName)) {
      config.wakeWords.unshift(normalizedName);
    }

    // Ensure "zavorth" is always present as fallback
    if (!config.wakeWords.includes('zavorth')) {
      config.wakeWords.push('zavorth');
    }

    config.agentName = normalizedName;
    config.updatedAt = new Date().toISOString();

    await this.saveConfig(config);
    return config;
  }

  /**
   * Gets current wake word configuration.
   */
  async getConfig(): Promise<WakeWordConfig> {
    return this.loadConfig();
  }

  /**
   * Adds a custom wake word.
   */
  async addWakeWord(word: string): Promise<WakeWordConfig> {
    const config = await this.loadConfig();
    const normalized = word.toLowerCase().trim();

    if (!config.wakeWords.includes(normalized)) {
      config.wakeWords.push(normalized);
      config.updatedAt = new Date().toISOString();
      await this.saveConfig(config);
    }

    return config;
  }

  /**
   * Removes a wake word.
   */
  async removeWakeWord(word: string): Promise<WakeWordConfig> {
    const config = await this.loadConfig();
    const normalized = word.toLowerCase().trim();

    config.wakeWords = config.wakeWords.filter((w) => w !== normalized);
    config.updatedAt = new Date().toISOString();

    await this.saveConfig(config);
    return config;
  }

  /**
   * Gets wake words as comma-separated string for mobile apps.
   */
  async getWakeWordsString(): Promise<string> {
    const config = await this.loadConfig();
    return config.wakeWords.join(',');
  }

  private async loadConfig(): Promise<WakeWordConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        return {
          wakeWords: data.wakeWords ?? ['zavorth'],
          agentName: data.agentName ?? 'zavorth',
          updatedAt: data.updatedAt ?? new Date().toISOString(),
        };
      }
    } catch {
      // Ignore errors, return defaults
    }

    return {
      wakeWords: ['zavorth'],
      agentName: 'zavorth',
      updatedAt: new Date().toISOString(),
    };
  }

  private async saveConfig(config: WakeWordConfig): Promise<void> {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
