import path from 'node:path';
import { ScaleToZeroManager, type ScaleToZeroConfig } from './ScaleToZeroManager.js';
import type { ChannelGatewayRegistry } from './ChannelGatewayRegistry.js';

let sharedManager: ScaleToZeroManager | null = null;

export function getScaleToZeroManager(options?: {
  stateFilePath?: string;
  registry?: ChannelGatewayRegistry;
}): ScaleToZeroManager {
  if (!sharedManager) {
    sharedManager = new ScaleToZeroManager({
      stateFilePath: options?.stateFilePath
        || path.join(process.cwd(), 'data', 'runtime', 'scale-to-zero-state.json'),
      registry: options?.registry,
    });
  } else if (options?.registry) {
    sharedManager.setRegistry(options.registry);
  }
  return sharedManager;
}

export function configureScaleToZeroRuntime(
  config: Partial<ScaleToZeroConfig>,
  options?: { registry?: ChannelGatewayRegistry; stateFilePath?: string },
): ScaleToZeroManager {
  const manager = getScaleToZeroManager(options);
  manager.configure(config);
  if (options?.registry) manager.setRegistry(options.registry);
  return manager;
}

export function resetScaleToZeroRuntimeForTests(): void {
  if (sharedManager) {
    sharedManager.stop();
  }
  sharedManager = null;
}
