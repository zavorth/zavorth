/**
 * Zavorth Configuration Loader.
 * Discovers and parses TOML files, environment variables, and CLI overrides.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { logger } from '../../logger.js';
import { ConfigLayerEngine } from './ConfigLayers.js';
import { ZavorthRootConfig } from './ConfigSchema.js';

export interface ConfigLoaderOptions {
  cwd?: string;
  userConfigPath?: string;
  projectConfigPath?: string;
  cliOverrides?: Record<string, unknown>;
  envOverrides?: Record<string, unknown>;
}

export class ConfigLoader {
  private readonly cwd: string;
  private readonly userConfigPath: string;
  private readonly projectConfigPath: string;

  constructor(options: ConfigLoaderOptions = {}) {
    this.cwd = options.cwd || process.cwd();
    this.userConfigPath = options.userConfigPath || path.join(os.homedir(), '.zavorth', 'config.toml');
    this.projectConfigPath = options.projectConfigPath || path.join(this.cwd, '.zavorth', 'config.toml');
  }

  private readTomlFile(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = parseToml(content);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[ConfigLoader] Failed to parse TOML at ${filePath}: ${message}`);
      return {};
    }
  }

  private extractEnvLayer(): Record<string, unknown> {
    const envData: Record<string, unknown> = {};

    // Map ZAVORTH_AGENT_DEFAULT_PROVIDER, ZAVORTH_LOG_LEVEL, etc.
    if (process.env.ZAVORTH_LOG_LEVEL) {
      envData.logging = { level: process.env.ZAVORTH_LOG_LEVEL };
    }

    if (process.env.ZAVORTH_PROVIDER || process.env.ZAVORTH_MODEL) {
      envData.agent = {
        providerOverride: process.env.ZAVORTH_PROVIDER,
        modelOverride: process.env.ZAVORTH_MODEL,
      };
    }

    return envData;
  }

  public load(options: { cliOverrides?: Record<string, unknown>; requestOverrides?: Record<string, unknown> } = {}): ZavorthRootConfig {
    const engine = new ConfigLayerEngine();

    // 1. System Defaults (Dynamic routing by default, no hardcoded model)
    engine.addLayer({
      name: 'System Defaults',
      priority: 'system_default',
      data: {
        system: { workspaceRoot: this.cwd },
        agent: { maxTurns: 50, timeoutMs: 120_000, reasoningEffort: 'medium' },
        logging: { level: 'info', format: 'pretty' },
      },
    });

    // 2. User TOML (~/.zavorth/config.toml)
    const userToml = this.readTomlFile(this.userConfigPath);
    if (Object.keys(userToml).length > 0) {
      engine.addLayer({
        name: 'User Config TOML',
        priority: 'user_config',
        data: userToml,
      });
    }

    // 3. Project TOML (.zavorth/config.toml)
    const projectToml = this.readTomlFile(this.projectConfigPath);
    if (Object.keys(projectToml).length > 0) {
      engine.addLayer({
        name: 'Project Config TOML',
        priority: 'project_config',
        data: projectToml,
      });
    }

    // 4. Request Overrides
    if (options.requestOverrides && Object.keys(options.requestOverrides).length > 0) {
      engine.addLayer({
        name: 'Request Overrides',
        priority: 'request_override',
        data: options.requestOverrides,
      });
    }

    // 5. Environment Variables
    const envData = this.extractEnvLayer();
    if (Object.keys(envData).length > 0) {
      engine.addLayer({
        name: 'Environment Variables',
        priority: 'environment',
        data: envData,
      });
    }

    // 6. CLI Overrides
    if (options.cliOverrides && Object.keys(options.cliOverrides).length > 0) {
      engine.addLayer({
        name: 'CLI Flags',
        priority: 'cli_flag',
        data: options.cliOverrides,
      });
    }

    return engine.resolveConfig();
  }
}

let globalLoadedConfig: ZavorthRootConfig | null = null;

export function loadConfig(options?: ConfigLoaderOptions): ZavorthRootConfig {
  const loader = new ConfigLoader(options);
  globalLoadedConfig = loader.load();
  return globalLoadedConfig;
}

export function getConfig(): ZavorthRootConfig {
  if (!globalLoadedConfig) {
    return loadConfig();
  }
  return globalLoadedConfig;
}
