import { describe, it, expect } from '@jest/globals';
import { ConfigLayerEngine } from '../../../src/core/config/ConfigLayers.js';
import { ConfigLoader } from '../../../src/core/config/ConfigLoader.js';

describe('ConfigLayerEngine (7-Layer Dynamic Merge Precedence)', () => {
  it('should correctly merge layers according to priority hierarchy', () => {
    const engine = new ConfigLayerEngine();

    // Layer 1: System Defaults
    engine.addLayer({
      name: 'system_default',
      priority: 'system_default',
      data: {
        system: { environment: 'development', locale: 'en' },
        agent: { maxTurns: 50 },
        logging: { level: 'info' }
      }
    });

    // Layer 2: User Config (~/.zavorth/config.toml)
    engine.addLayer({
      name: 'user_config',
      priority: 'user_config',
      data: {
        agent: { providerOverride: 'anthropic', modelOverride: 'claude-3-5-sonnet-20241022' },
        logging: { level: 'debug' }
      }
    });

    // Layer 3: Project Config (.zavorth/config.toml)
    engine.addLayer({
      name: 'project_config',
      priority: 'project_config',
      data: {
        agent: { modelOverride: 'claude-3-7-sonnet-20250219' }
      }
    });

    // Layer 4: CLI Flags (Highest Priority)
    engine.addLayer({
      name: 'cli_flag',
      priority: 'cli_flag',
      data: {
        logging: { level: 'trace' }
      }
    });

    const config = engine.resolveConfig();

    // Verified Expectations:
    // 1. CLI Flag overrides logging level -> 'trace'
    expect(config.logging.level).toBe('trace');
    // 2. Project config overrides modelOverride -> 'claude-3-7-sonnet-20250219'
    expect(config.agent.modelOverride).toBe('claude-3-7-sonnet-20250219');
    // 3. User config sets providerOverride -> 'anthropic'
    expect(config.agent.providerOverride).toBe('anthropic');
    // 4. System default fallback remains -> maxTurns: 50, locale: 'en'
    expect(config.agent.maxTurns).toBe(50);
    expect(config.system.locale).toBe('en');
  });

  it('should load configuration cleanly using ConfigLoader', () => {
    const loader = new ConfigLoader();
    const config = loader.load({
      cliOverrides: {
        agent: { providerOverride: 'ollama' }
      }
    });

    expect(config.agent.providerOverride).toBe('ollama');
    expect(config.system.workspaceRoot).toBeDefined();
  });
});
