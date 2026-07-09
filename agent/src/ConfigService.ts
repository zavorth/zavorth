import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { asErrorLike } from '../../src/utils/errorLike.js';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AgentConfig {
  lang: string;
  chimesEnabled: boolean;
}

export class ConfigService {
  private readonly configPath: string;
  private currentConfig: AgentConfig;
  private watchCallbacks: ((config: AgentConfig) => void)[] = [];
  private watcher: fs.FSWatcher | null = null;
  private watchDebounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.configPath = path.resolve(__dirname, '../agent-config.json');
    this.currentConfig = this.load();
    this.startWatching();
  }

  public get lang(): string {
    return this.currentConfig.lang;
  }

  public set lang(value: string) {
    if (this.currentConfig.lang === value) return;
    this.currentConfig.lang = value;
    this.save();
  }

  public get chimesEnabled(): boolean {
    return this.currentConfig.chimesEnabled;
  }

  public set chimesEnabled(value: boolean) {
    if (this.currentConfig.chimesEnabled === value) return;
    this.currentConfig.chimesEnabled = value;
    this.save();
  }

  public getConfig(): AgentConfig {
    return { ...this.currentConfig };
  }

  public onChange(callback: (config: AgentConfig) => void): () => void {
    this.watchCallbacks.push(callback);
    return () => {
      this.watchCallbacks = this.watchCallbacks.filter(cb => cb !== callback);
    };
  }

  private load(): AgentConfig {
    const defaultConfig: AgentConfig = {
      lang: 'auto',
      chimesEnabled: true,
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(data);
        return {
          lang: typeof parsed.lang === 'string' ? parsed.lang : defaultConfig.lang,
          chimesEnabled: typeof parsed.chimesEnabled === 'boolean' ? parsed.chimesEnabled : defaultConfig.chimesEnabled,
        };
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.warn(`[Config] Failed to load config, using defaults: ${err.message}`);
    }

    return defaultConfig;
  }

  private save(): void {
    try {
      this.stopWatching();
      fs.writeFileSync(this.configPath, JSON.stringify(this.currentConfig, null, 2), 'utf8');
      this.startWatching();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error(`[Config] Failed to save config: ${err.message}`);
    }
  }

  private startWatching(): void {
    if (this.watcher) return;
    try {
      const parentDir = path.dirname(this.configPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      this.watcher = fs.watch(parentDir, (eventType, filename) => {
        if (filename === 'agent-config.json') {
          this.handleFileChange();
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.warn(`[Config] Failed to start fs.watch on agent config directory: ${err.message}`);
    }
  }

  private stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
      this.watchDebounceTimer = null;
    }
  }

  private handleFileChange(): void {
    if (this.watchDebounceTimer) {
      clearTimeout(this.watchDebounceTimer);
    }
    this.watchDebounceTimer = setTimeout(() => {
      const newConfig = this.load();
      if (
        newConfig.lang !== this.currentConfig.lang ||
        newConfig.chimesEnabled !== this.currentConfig.chimesEnabled
      ) {
        this.currentConfig = newConfig;
        console.log(`[Config] Reloaded configuration from disk. Lang: ${newConfig.lang}, Chimes: ${newConfig.chimesEnabled}`);
        for (const callback of this.watchCallbacks) {
          try {
            callback(newConfig);
          } catch (error: unknown) {
            const err = asErrorLike(error);
            console.error(`[Config] Error in change callback: ${err.message}`);
          }
        }
      }
    }, 100);
  }
}

export default ConfigService;
