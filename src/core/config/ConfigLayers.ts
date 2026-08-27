/**
 * Zavorth 7-Layer Hierarchical Configuration Merging Engine.
 * Follows xAI Grok-Build layer precedence model.
 */

import { ZavorthRootConfig, ZavorthRootConfigSchema } from './ConfigSchema.js';

export type ConfigLayerPriority =
  | 'system_default'   // Base defaults
  | 'managed_default'  // Enterprise / managed defaults
  | 'user_config'      // ~/.zavorth/config.toml
  | 'project_config'   // .zavorth/config.toml
  | 'request_override' // Runtime request options
  | 'environment'      // ZAVORTH_* env variables
  | 'cli_flag';        // Explicit CLI command line flags

export interface ConfigLayer {
  readonly name: string;
  readonly priority: ConfigLayerPriority;
  readonly data: Record<string, unknown>;
}

const LAYER_ORDER: Record<ConfigLayerPriority, number> = {
  system_default: 10,
  managed_default: 20,
  user_config: 30,
  project_config: 40,
  request_override: 50,
  environment: 60,
  cli_flag: 70,
};

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      output[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else if (sourceVal !== undefined) {
      output[key] = sourceVal;
    }
  }

  return output;
}

export class ConfigLayerEngine {
  private readonly layers: ConfigLayer[] = [];

  public addLayer(layer: ConfigLayer): this {
    this.layers.push(layer);
    return this;
  }

  public getSortedLayers(): ConfigLayer[] {
    return [...this.layers].sort((a, b) => LAYER_ORDER[a.priority] - LAYER_ORDER[b.priority]);
  }

  public resolveMergedRaw(): Record<string, unknown> {
    const sorted = this.getSortedLayers();
    let result: Record<string, unknown> = {};

    for (const layer of sorted) {
      result = deepMerge(result, layer.data);
    }

    return result;
  }

  public resolveConfig(): ZavorthRootConfig {
    const raw = this.resolveMergedRaw();
    return ZavorthRootConfigSchema.parse(raw);
  }
}
