import { AgentMeshOrchestrationService } from '../../../../src/services/AgentMeshOrchestrationService';
import { AgentMeshDriverRegistryService } from '../../../../src/services/AgentMeshDriverRegistryService';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

function getTempPaths(prefix: string) {
  const tmp = os.tmpdir();
  const id = randomUUID();
  return {
    storagePath: path.join(tmp, `${prefix}-${id}-consents.json`),
    registryPath: path.join(tmp, `${prefix}-${id}-registry.json`),
  };
}

describe('AgentMesh handshake and registry hardening', () => {
  it('registers a generic bridge without persisting raw connection material', async () => {
    const paths = getTempPaths('agent-mesh-handshake');
    const orchestration = new AgentMeshOrchestrationService({
      ...paths,
      driverRegistry: new AgentMeshDriverRegistryService([]),
    });

    const bridge = await orchestration.registerBridge({
      agentName: 'Research Worker',
      agentDescription: 'Generic local research bridge',
      connectionUri: 'http://user:pass@localhost:9000/agent?auth=super-secret-value',
      primaryProtocol: 'webhook',
    });

    expect(bridge.status).toBe('discovered_unverified');
    expect(bridge.connection.redacted).toBe('http://localhost:9000/agent');
    expect(JSON.stringify(bridge)).not.toContain('super-secret-token');
    expect(JSON.stringify(bridge)).not.toContain('user:pass');

    await new Promise((resolve) => setTimeout(resolve, 50));
    const snapshot = orchestration.buildSnapshot();
    const registeredBridge = snapshot.bridges.find((entry) => entry.id === bridge.id);

    expect(snapshot.meshId).toBe('zavorth-agent-mesh');
    expect(snapshot.policy).toMatchObject({
      rawConnectionMaterialPersisted: false,
      criticalPermissionsBlockedByDefault: true,
    });
    expect(registeredBridge?.status).toBe('verified_not_authorized');
    expect(registeredBridge?.capabilities).toEqual(expect.objectContaining({
      supportedProtocols: ['webhook'],
      supportsDryRun: true,
    }));
    expect(JSON.stringify(snapshot)).not.toContain('super-secret-token');
  });
});
