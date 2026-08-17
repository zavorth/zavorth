/**
 * Zavorth Plugin SDK - Public API Barrel.
 * The primary public interface for building Zavorth plugins, extensions, and integrations.
 */

import type { ZavorthPlugin, PluginContext } from './types.js';
import type { PluginManifest } from './manifest.js';

export * from './manifest.js';
export * from './types.js';
export * from './sandbox.js';

/**
 * Helper function to define a typed Zavorth plugin with auto-completion and validation.
 */
export function definePlugin(config: {
  id: string;
  manifest: PluginManifest;
  initialize: (context: PluginContext) => Promise<void> | void;
  shutdown?: () => Promise<void> | void;
}): ZavorthPlugin {
  return {
    id: config.id,
    manifest: config.manifest,
    initialize: config.initialize,
    shutdown: config.shutdown,
  };
}
