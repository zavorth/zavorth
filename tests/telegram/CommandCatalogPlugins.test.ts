import fs from 'fs';
import os from 'os';
import path from 'path';

type CommandCatalogModule = typeof import('../../src/telegram/commandCatalog');

describe('commandCatalog plugin integration', () => {
  const originalPluginDir = process.env.ZAVORTH_CAPABILITY_PLUGINS_DIR;

  afterEach(() => {
    if (originalPluginDir === undefined) {
      delete process.env.ZAVORTH_CAPABILITY_PLUGINS_DIR;
    } else {
      process.env.ZAVORTH_CAPABILITY_PLUGINS_DIR = originalPluginDir;
    }
    jest.resetModules();
  });

  it('exposes plugin commands, aliases and executors through the command catalog', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-command-catalog-plugin-'));
    const pluginFile = path.join(tempDir, 'shipfix.json');
    fs.writeFileSync(
      pluginFile,
      JSON.stringify({
        id: 'plugin-shipfix',
        label: 'Ship Fix',
        type: 'workflow',
        description: 'Workflow ship via plugin.',
        intent: 'workflow_execution',
        executor_preference: 'workflow:ship',
        dispatch_mode: 'execution',
        routing_reason: 'Workflow ship plugado via manifest.',
        routing_confidence: 1,
        command: {
          command: 'shipfix',
          aliases: ['sf'],
          explicit_executor: 'workflow:ship',
          description: 'Executa o workflow ship.',
          usage: '<objetivo>',
          section: 'execution',
        },
      }),
      'utf8',
    );

    process.env.ZAVORTH_CAPABILITY_PLUGINS_DIR = tempDir;
    jest.resetModules();

    // Re-require after resetModules so the catalog rebuilds from the temp plugin dir (CJS-safe fresh instance).
    const catalogModule = require('../../src/telegram/commandCatalog') as CommandCatalogModule & {
      default?: CommandCatalogModule;
    };
    const catalog = catalogModule.default ?? catalogModule;

    try {
      expect(catalog.resolveCommandAlias('/sf')).toBe('/shipfix');
      expect(catalog.getExplicitExecutorForCommand('/shipfix')).toBe('workflow:ship');
      expect(catalog.isKnownCommand('/shipfix')).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
