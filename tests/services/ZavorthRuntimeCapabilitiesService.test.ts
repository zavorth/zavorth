import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthRuntimeCapabilitiesService } from '../../src/services/ZavorthRuntimeCapabilitiesService.js';
import { ZavorthRuntimeStateBusService } from '../../src/services/ZavorthRuntimeStateBusService.js';

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-runtime-capabilities-'));
}

describe('ZavorthRuntimeCapabilitiesService', () => {
  it('builds a sanitized capabilities payload from runtime projections', () => {
    const root = makeRoot();
    const runtimeStateBus = new ZavorthRuntimeStateBusService({
      stateFilePath: path.join(root, 'runtime-state.json'),
      now: () => new Date('2026-06-10T11:00:00.000Z'),
    });
    runtimeStateBus.dispatch({
      type: 'set-provider-connection',
      approved: true,
      payload: {
        providerConnection: {
          providerId: 'ollama',
          label: 'Ollama local',
          targetUrl: 'http://127.0.0.1:11434/v1',
          apiKey: 'should-never-leak',
        },
      },
    });

    const snapshot = new ZavorthRuntimeCapabilitiesService({
      now: () => new Date('2026-06-10T11:00:00.000Z'),
      runtimeStateBus,
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-runtime-capabilities/1');
    expect(snapshot.capabilities.available.some((capability) => capability.id === 'chat.ask')).toBe(true);
    expect(snapshot.modelSpecs.selectedSpecId).toBe('daily');
    expect(snapshot.providers.connected.some((provider) => provider.id === 'ollama')).toBe(true);
    expect(snapshot.permissions.domains.filesystem.actions.write.requiresApproval).toBe(true);
    expect(snapshot.personalOps.connectors.every((connector) => connector.enabled === false)).toBe(true);
    expect(snapshot.safety.rawSecretsSerialized).toBe(false);
    expect(JSON.stringify(snapshot)).not.toContain('should-never-leak');
  });
});
