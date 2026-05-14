import { AgentMeshOrchestrationService } from '../../../../src/services/AgentMeshOrchestrationService';
import { AgentMeshExecutionService } from '../../../../src/services/AgentMeshExecutionService';
import { AgentMeshLedgerService } from '../../../../src/services/AgentMeshLedgerService';
import { AgentMeshDriverRegistryService } from '../../../../src/services/AgentMeshDriverRegistryService';
import type { AgentMeshProtocolDriver } from '../../../../src/services/AgentMeshDriverRegistryService';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

function getTempPaths(prefix: string) {
  const tmp = os.tmpdir();
  const id = randomUUID();
  return {
    storagePath: path.join(tmp, `${prefix}-${id}-consents.json`),
    registryPath: path.join(tmp, `${prefix}-${id}-registry.json`),
    ledgerPath: path.join(tmp, `${prefix}-${id}-ledger.jsonl`),
  };
}

async function createAuthorizedHarness() {
  const paths = getTempPaths('agent-mesh-execution');
  const fakeDriver: AgentMeshProtocolDriver = {
    protocol: 'mcp',
    async handshake() {
      return {
        capabilities: {
          reportedToolCount: 1,
          reportedChannelCount: 0,
          primaryDomain: 'test-driver',
          discoveredTools: ['search'],
          supportedProtocols: ['mcp'],
          supportsDryRun: true,
          supportsCancellation: false,
          discoverySource: 'driver-handshake',
          driverStatus: 'available',
        },
      };
    },
    async execute(_context, executionRequest) {
      if (executionRequest.budget.maxExecutionTimeMs < 150) {
        throw new Error('Agent Mesh test driver timed out.');
      }
      return {
        summary: 'Driver completed with token=super-secret-token and test@example.com',
        toolCallsMade: 1,
      };
    },
  };
  const driverRegistry = new AgentMeshDriverRegistryService([fakeDriver]);
  const orchestration = new AgentMeshOrchestrationService({
    ...paths,
    driverRegistry,
    connectionResolver: () => 'test-driver',
  });
  const ledger = new AgentMeshLedgerService({ ledgerPath: paths.ledgerPath });
  const executor = new AgentMeshExecutionService({ orchestrationService: orchestration, ledgerService: ledger, driverRegistry });
  const bridge = await orchestration.registerBridge({
    agentName: 'Generic Worker',
    agentDescription: 'Generic local worker',
    connectionRef: 'secret-ref:agent-mesh/generic-worker',
    primaryProtocol: 'mcp',
  });
  await orchestration.authorize({
    id: 'consent-execution',
    signedAt: new Date().toISOString(),
    userFingerprint: 'operator',
    authorizedAgentId: bridge.id,
    grantedPermissions: ['share_context', 'delegate_tools'],
    risksAcknowledged: [],
    workspaceScope: null,
    sessionScope: null,
    expirationDate: null,
    revocable: true,
  });
  return { bridge, executor, ledger };
}

function request(targetBridgeId: string) {
  return {
    id: `req-${randomUUID()}`,
    requestedAt: new Date().toISOString(),
    traceId: 'trace-agent-mesh',
    sessionId: 'session-agent-mesh',
    requestedBy: 'operator',
    surface: 'test',
    targetBridgeId,
    intent: {
      goal: 'Research without leaking token=super-secret-token',
      context: 'Contact test@example.com and use secret-ref:agent/value',
      requestedTools: ['search'],
    },
    budget: { maxExecutionTimeMs: 1000, maxToolCalls: 1 },
    sandbox: {
      allowNetworkAccess: false,
      allowedNetworkDomains: [],
      allowFileSystemWrites: false,
      allowedWritePaths: [],
      allowProcessExecution: false,
      noSecretSerialization: true as const,
      enforceDryRunFirstIfSupported: false,
    },
    isDryRunPreview: false,
    secretRefs: {},
  };
}

describe('AgentMesh execution hardening', () => {
  it('enforces sandbox, timeout and tool-call budgets', async () => {
    const { bridge, executor } = await createAuthorizedHarness();

    const sandboxViolation = request(bridge.id);
    sandboxViolation.sandbox.noSecretSerialization = false as true;
    expect((await executor.execute(sandboxViolation)).status).toBe('blocked_by_sandbox');

    const timeout = request(bridge.id);
    timeout.budget.maxExecutionTimeMs = 10;
    expect((await executor.execute(timeout)).status).toBe('interrupted_timeout');

    const toolBudget = request(bridge.id);
    toolBudget.sandbox.enforceDryRunFirstIfSupported = true;
    toolBudget.budget.maxToolCalls = 1;
    expect((await executor.execute(toolBudget)).status).toBe('interrupted_budget_exceeded');
  });

  it('redacts execution summaries and ledger receipts', async () => {
    const { bridge, executor, ledger } = await createAuthorizedHarness();

    const receipt = await executor.execute(request(bridge.id));
    const snapshot = ledger.buildSnapshot();
    const serialized = JSON.stringify({ receipt, snapshot });

    expect(receipt.status).toBe('completed_successfully');
    expect(receipt.redactionApplied).toBe(true);
    expect(serialized).not.toContain('super-secret-token');
    expect(serialized).not.toContain('test@example.com');
    expect(serialized).not.toContain('secret-ref:agent/value');
    expect(snapshot.policy.noPlaintextSecretsInLedger).toBe(true);
  });
});
