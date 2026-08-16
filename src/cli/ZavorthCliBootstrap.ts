/**
 * Zavorth CLI Bootstrap & Composition Root.
 * Inverts dependencies by loading 7-layer TOML configuration and injecting
 * decoupled runtime services into ZavorthCli (Grok-Build pattern).
 */

import { ZavorthCli } from './ZavorthCli.js';
import type { ZavorthCliDeps, CliRuntimeProfile } from './ZavorthCliContract.js';
import { loadConfig, type ZavorthRootConfig, type ConfigLoaderOptions } from '../core/config/index.js';

export interface ZavorthCliBootstrapOptions {
  profile?: CliRuntimeProfile;
  configOptions?: ConfigLoaderOptions;
  cliOverrides?: Record<string, unknown>;
  deps?: ZavorthCliDeps;
}

/**
 * Factory composition root to construct a fully configured ZavorthCli instance.
 */
export function createZavorthCli(options: ZavorthCliBootstrapOptions = {}): ZavorthCli {
  // 1. Load 7-Layer Hierarchical Configuration
  const config: ZavorthRootConfig = loadConfig({
    ...options.configOptions,
    cliOverrides: options.cliOverrides,
  });

  // 2. Compose CLI Dependencies with Inversion of Control
  const composedDeps: ZavorthCliDeps = {
    ...options.deps,
    config,
    profile: options.profile || 'surface',
  };

  // 3. Instantiate and return decoupled ZavorthCli
  return new ZavorthCli(composedDeps);
}
