import { EngineeringIntentService } from '../../src/services/EngineeringIntentService.js';

describe('EngineeringIntentService', () => {
  it('detects project bootstrap requests from natural language', () => {
    const service = new EngineeringIntentService();
    const intent = service.parse({ rawText: 'crie um servidor Express' });

    expect(intent).toEqual(expect.objectContaining({
      kind: 'create_project',
      mutating: true,
      preferredProfile: 'trusted',
    }));
  });

  it('detects build diagnosis requests from natural language', () => {
    const service = new EngineeringIntentService();
    const intent = service.parse({ rawText: 'veja por que esse build quebrou' });

    expect(intent).toEqual(expect.objectContaining({
      kind: 'diagnose_build',
      requiresSession: true,
    }));
  });

  it('detects supervised browser navigation from natural language', () => {
    const service = new EngineeringIntentService();
    const intent = service.parse({ rawText: 'open the browser at https://example.com/docs' });

    expect(intent).toEqual(expect.objectContaining({
      kind: 'system_overlord_operation',
      preferredCapability: 'browser.control',
      preferredProfile: 'dangerous',
      preferredAutonomyLevel: 5,
    }));
    expect(intent?.suggestedCommands[0]).toContain('"action":"navigate"');
    expect(intent?.suggestedCommands[0]).toContain('"url":"https://example.com/docs"');
  });

  it('detects supervised tunnel publiction from natural language', () => {
    const service = new EngineeringIntentService();
    const intent = service.parse({ rawText: 'start a tunnel to http://127.0.0.1:3004' });

    expect(intent).toEqual(expect.objectContaining({
      kind: 'system_overlord_operation',
      preferredCapability: 'network.tunnel',
      preferredProfile: 'dangerous',
      preferredAutonomyLevel: 4,
    }));
    expect(intent?.suggestedCommands[0]).toContain('"action":"start"');
    expect(intent?.suggestedCommands[0]).toContain('"targetUrl":"http://127.0.0.1:3004"');
  });

  it('detects supervised WSL execution from natural language', () => {
    const service = new EngineeringIntentService();
    const intent = service.parse({ rawText: 'rode no WSL: npm test' });

    expect(intent).toEqual(expect.objectContaining({
      kind: 'system_overlord_operation',
      preferredCapability: 'wsl.exec',
      preferredProfile: 'trusted',
      preferredAutonomyLevel: 4,
    }));
    expect(intent?.suggestedCommands[0]).toContain('"command":"bash"');
    expect(intent?.suggestedCommands[0]).toContain('"npm test"');
  });

  it('does not steal clearly non-engineering channel requests', () => {
    const service = new EngineeringIntentService();
    const intent = service.parse({ rawText: 'quero colocar you no discord' });

    expect(intent).toBeNull();
  });
});
