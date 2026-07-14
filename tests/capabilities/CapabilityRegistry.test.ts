import fs from 'fs';
import os from 'os';
import path from 'path';
import { CapabilityRegistry } from '../../src/capabilities/CapabilityRegistry';

describe('CapabilityRegistry', () => {
  it('loads builtin capabilities and matches implicit web research', () => {
    const registry = new CapabilityRegistry();

    const capability = registry.matchImplicit(
      '/task',
      'search the web whether leaving a laptop lid almost closed is harmful',
    );

    expect(capability?.id).toBe('route-web-research');
    expect(capability?.executor_preference).toBe('web_research');
  });

  it('loads plugin manifests from disk', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-capability-plugin-'));
    const pluginFile = path.join(tempDir, 'shipfix.json');
    fs.writeFileSync(
      pluginFile,
      JSON.stringify({
        id: 'plugin-shipfix',
        label: 'Ship Fix',
        type: 'workflow',
        description: 'Roda o workflow ship para ajustes rapidos.',
        intent: 'workflow_execution',
        executor_preference: 'workflow:ship',
        dispatch_mode: 'execution',
        routing_reason: 'Workflow ship plugado via manifest.',
        routing_confidence: 1,
        command: {
          command: 'shipfix',
          aliases: ['sf'],
          explicit_executor: 'workflow:ship',
          description: 'Executa o workflow ship para uma tarefa.',
          usage: '<objetivo>',
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
