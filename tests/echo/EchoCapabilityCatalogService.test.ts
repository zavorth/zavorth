import { CapabilityRegistry } from '../../src/capabilities/CapabilityRegistry';
import { EchoCapabilityCatalogService } from '../../src/domain/platform-ecosystem/infrastructure/EchoCapabilityCatalogService';

describe('EchoCapabilityCatalogService', () => {
  it('registers Echo tools with explicit executor, policy, lifecycle, artifacts, and network scope', () => {
    const registry = new CapabilityRegistry({ builtins: [], pluginDir: '' });
    const service = new EchoCapabilityCatalogService();

    const registered = service.registerTools([
      {
        name: 'os_screenshot',
        description: 'Captura tela para vision.',
        category: 'OS',
        dangerLevel: 'moderate',
        requiresPermission: true,
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'playwright_browser',
        description: 'Browser agent com screenshot.',
        category: 'WEB',
        dangerLevel: 'moderate',
        requiresPermission: false,
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'os_screen_vision',
        description: 'Analise multimodal da tela.',
        category: 'OS',
        dangerLevel: 'moderate',
        requiresPermission: true,
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'home_assistant',
        description: 'Controle IoT local.',
        category: 'IOT',
        dangerLevel: 'high',
        requiresPermission: true,
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'iot_mqtt_publish',
        description: 'Publicacao MQTT local.',
        category: 'IOT',
        dangerLevel: 'moderate',
        requiresPermission: false,
        parameters: { type: 'object', properties: {} },
      },
    ] as any, registry);

    expect(registered).toHaveLength(5);
    const screenshot = registry.getAll().find((capability) => capability.id === 'echo-capability-os_screenshot');
    const screenVision = registry.getAll().find((capability) => capability.id === 'echo-capability-os_screen_vision');
    const browser = registry.getAll().find((capability) => capability.id === 'echo-capability-playwright_browser');
    const homeAssistant = registry.getAll().find((capability) => capability.id === 'echo-capability-home_assistant');
    const mqtt = registry.getAll().find((capability) => capability.id === 'echo-capability-iot_mqtt_publish');

    expect(screenshot).toEqual(expect.objectContaining({
      executor_preference: 'echo',
      policy: expect.objectContaining({
        executor: 'echo',
        requiresApproval: true,
        networkScope: 'none',
        lifecycle: 'stateless',
        artifactKinds: ['screenshot'],
      }),
    }));
    expect(screenshot?.tags).toEqual(expect.arrayContaining([
      'policy:approval-required',
      'artifact:screenshot',
      'domain:observability',
    ]));
    expect(screenVision?.policy).toEqual(expect.objectContaining({
      executor: 'echo',
      requiresApproval: true,
      networkScope: 'external-policy',
      lifecycle: 'stateless',
      artifactKinds: ['screenshot'],
    }));
    expect(screenVision?.tags).toEqual(expect.arrayContaining([
      'tool:os_screen_vision',
      'policy:approval-required',
      'artifact:screenshot',
      'network:external-policy',
    ]));

    expect(browser?.policy).toEqual(expect.objectContaining({
      executor: 'echo',
      requiresApproval: false,
      networkScope: 'external-policy',
      lifecycle: 'session',
      artifactKinds: ['screenshot'],
      allowedHosts: ['localhost', '127.0.0.1', '::1', 'private-network', 'local-file', 'policy-allowlist'],
    }));
    expect(browser?.tags).toEqual(expect.arrayContaining([
      'policy:auto-approved',
      'network:external-policy',
      'lifecycle:session',
      'domain:trust-governance',
    ]));

    expect(homeAssistant?.policy).toEqual(expect.objectContaining({
      executor: 'echo',
      requiresApproval: true,
      networkScope: 'private-network',
      lifecycle: 'event-bridge',
      artifactKinds: ['iot-command'],
      allowedHosts: ['localhost', '127.0.0.1', '::1', 'private-network'],
    }));
    expect(homeAssistant?.tags).toEqual(expect.arrayContaining([
      'artifact:iot-command',
      'policy:approval-required',
      'network:private-network',
      'lifecycle:event-bridge',
      'domain:platform-ecosystem',
    ]));

    expect(mqtt?.policy).toEqual(expect.objectContaining({
      executor: 'echo',
      requiresApproval: false,
      networkScope: 'private-network',
      lifecycle: 'event-bridge',
      artifactKinds: ['iot-command'],
      allowedHosts: ['localhost', '127.0.0.1', '::1', 'private-network'],
    }));
    expect(mqtt?.tags).toEqual(expect.arrayContaining([
      'artifact:iot-command',
      'policy:auto-approved',
      'network:private-network',
      'lifecycle:event-bridge',
    ]));
  });
});
