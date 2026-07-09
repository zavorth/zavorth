import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { AgentMeshOrchestrationService } from '../../../../src/services/AgentMeshOrchestrationService';
import { AgentMeshExecutionService } from '../../../../src/services/AgentMeshExecutionService';
import { AgentMeshLedgerService } from '../../../../src/services/AgentMeshLedgerService';

function getTempPaths(prefix: string) {
  const tmp = os.tmpdir();
  const id = randomUUID();
  return {
    storagePath: path.join(tmp, `${prefix}-${id}-consents.json`),
    registryPath: path.join(tmp, `${prefix}-${id}-registry.json`),
    ledgerPath: path.join(tmp, `${prefix}-${id}-ledger.jsonl`),
  };
}

function readJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error: unknown) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function createWebhookAgent() {
  const received: any[] = [];
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const body = await readJson(req);
    received.push(body);
    res.setHeader('content-type', 'application/json');
    if (body.type === 'agent_mesh.handshake') {
      res.end(JSON.stringify({
        capabilities: {
          reportedToolCount: 2,
          reportedChannelCount: 1,
          primaryDomain: 'commerce-support',
          discoveredTools: ['lookup_order', 'draft_reply'],
          supportedProtocols: ['webhook'],
          supportsDryRun: true,
          supportsCancellation: true,
        },
      }));
      return;
    }
    res.end(JSON.stringify({
      summary: 'Pedido localizado sem expor token=provider-secret nem customer@example.com',
      toolCallsMade: 1,
    }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test webhook did not bind to a TCP port.');
  }
  return {
    url: `http://127.0.0.1:${address.port}/mesh`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function request(targetBridgeId: string) {
  return {
    id: `req-${randomUUID()}`,
    requestedAt: new Date().toISOString(),
    traceId: 'trace-driver',
    sessionId: 'session-driver',
    requestedBy: 'operator',
    surface: 'test',
    targetBridgeId,
    intent: {
      goal: 'Check order status token=operator-secret',
      context: 'Customer email customer@example.com asked about order.',
      requestedTools: ['lookup_order'],
    },
    budget: { maxExecutionTimeMs: 5000, maxToolCalls: 1 },
    sandbox: {
      allowNetworkAccess: true,
      allowedNetworkDomains: ['127.0.0.1'],
      allowFileSystemWrites: false,
      allowedWritePaths: [],
      allowProcessExecution: false,
      noSecretSerialization: true as const,
      enforceDryRunFirstIfSupported: false,
    },
    isDryRunPreview: false,
    secretRefs: {
      apiToken: 'secret-ref:agent-provider-token',
    },
  };
}

describe('AgentMesh protocol drivers', () => {
  it('performs webhook handshake and execution through the driver registry', async () => {
    const webhook = await createWebhookAgent();
    try {
      const paths = getTempPaths('agent-mesh-drivers');
      const orchestration = new AgentMeshOrchestrationService(paths);
      const ledger = new AgentMeshLedgerService({ ledgerPath: paths.ledgerPath });
      const executor = new AgentMeshExecutionService({ orchestrationService: orchestration, ledgerService: ledger });

      const bridge = await orchestration.registerBridge({
        agentName: 'Commerce Worker',
        agentDescription: 'Local test bridge',
        connectionUri: webhook.url,
        primaryProtocol: 'webhook',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      const snapshot = orchestration.buildSnapshot();
      const registered = snapshot.bridges.find((entry) => entry.id === bridge.id);

      expect(registered?.capabilities).toEqual(expect.objectContaining({
        reportedToolCount: 2,
        primaryDomain: 'commerce-support',
        discoverySource: 'driver-handshake',
        driverStatus: 'available',
      }));

      await orchestration.authorize({
        id: 'consent-driver',
        signedAt: new Date().toISOString(),
        userFingerprint: 'operator',
        authorizedAgentId: bridge.id,
        grantedPermissions: ['share_context', 'delegate_tools', 'network_access'],
        risksAcknowledged: [],
        workspaceScope: null,
        sessionScope: null,
        expirationDate: null,
        revocable: true,
      });

      const receipt = await executor.execute(request(bridge.id));
      const serialized = JSON.stringify({ receipt, received: webhook.received, ledger: ledger.buildSnapshot() });

      expect(receipt.status).toBe('completed_successfully');
      expect(receipt.driverProtocol).toBe('webhook');
      expect(webhook.received.map((entry) => entry.type)).toEqual([
        'agent_mesh.handshake',
        'agent_mesh.execute',
      ]);
      expect(serialized).not.toContain('operator-secret');
      expect(serialized).not.toContain('provider-secret');
      expect(serialized).not.toContain('customer@example.com');
      expect(serialized).not.toContain('secret-ref:agent-provider-token');
    } finally {
      await webhook.close();
    }
  });
});
