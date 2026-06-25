import { logger } from '../../logger.js';
import { ProviderRegistry } from '../ProviderRegistry.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const loaded = new Set<string>();

function registerPlugin(plugin: ProviderPlugin): void {
  if (loaded.has(plugin.manifest.name)) {
    return;
  }
  loaded.add(plugin.manifest.name);

  ProviderRegistry.register({
    name: plugin.manifest.name,
    aliases: plugin.manifest.aliases,
    factory: plugin.create,
  });

  logger.info(`Provider plugin "${plugin.manifest.name}" registered.`);
}

function registerBatch(plugins: ProviderPlugin[]): void {
  for (const plugin of plugins) {
    registerPlugin(plugin);
  }
}

export { registerPlugin, registerBatch };
