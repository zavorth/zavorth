import fs from 'fs';
import os from 'os';
import path from 'path';
import { CapabilityRegistry } from '../../src/capabilities/CapabilityRegistry';

describe('CapabilityRegistry', () => {
  it('never activates capabilities from free-text matchImplicit (model-owned routing)', () => {
    const registry = new CapabilityRegistry();

    const capability = registry.matchImplicit(
      '/task',
      'search the web whether leaving a laptop lid almost closed is harmful',
    );

    expect(capability).toBeNull();
  });

  it('loads plugin manifests from disk and resolves explicit slash commands', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-plugin-'));
    const pluginFile = path.join(tempDir, 'shipfix.json');
    fs.writeFileSync(
      pluginFile,
      JSON.stringify({
        id: 'plugin-shipfix',
        label: 'Ship Fix',
        type: 'workflow',
        description: 'Runs the ship workflow for quick fixes.',
        intent: 'workflow_execution',
        executor_preference: 'workflow:ship',
        dispatch_mode: 'execution',
        routing_reason: 'Ship workflow plugged via manifest.',
        routing_confidence: 1,
        command: {
          command: 'shipfix',
          aliases: ['sf'],
          explicit_executor: 'workflow:ship',
          description: 'Runs the ship workflow for a task.',
          usage: '<goal>',
          section: 'execution',
        },
      }),
      'utf8',
    );

    try {
      const registry = new CapabilityRegistry({ pluginDir: tempDir });
      const capability = registry.findByCommand('/shipfix');

      expect(capability?.source).toBe('plugin');
      expect(capability?.executor_preference).toBe('workflow:ship');
      expect(registry.getAliasMap()).toEqual(
        expect.objectContaining({
          '/sf': '/shipfix',
        }),
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
