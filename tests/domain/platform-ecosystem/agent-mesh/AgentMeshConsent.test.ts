import { AgentMeshOrchestrationService } from '../../../../src/services/AgentMeshOrchestrationService';
import { AgentMeshExecutionService } from '../../../../src/services/AgentMeshExecutionService';
import { AgentMeshLedgerService } from '../../../../src/services/AgentMeshLedgerService';
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

function safeRequest(targetBridgeId: string) {
  return {
    id: 'req-safe',
    requestedAt: new Date().toISOString(),
    traceId: 'trace-agent-mesh',
    sessionId: 'session-agent-mesh',
    requestedBy: 'operator',
    surface: 'test',
    targetBridgeId,
    intent: { goal: 'Run safe preview', context: '' },
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
    isDryRunPreview: true,
    secretRefs: {},
  };
}

describe('AgentMesh consent hardening', () => {
  it('blocks execution if consent is missing and records an audit receipt', async () => {
    const paths = getTempPaths('agent-mesh-consent-block');
    const orchestration = new AgentMeshOrchestrationService(paths);
    const ledger = new AgentMeshLedgerService({ ledgerPath: paths.ledgerPath });
    const executor = new AgentMeshExecutionService({ orchestrationService: orchestration, ledgerService: ledger });

    const bridge = await orchestration.registerBridge({
      agentName: 'Generic Worker',
      agentDescription: 'Generic local worker',
      connectionRef: 'secret-ref:agent-mesh/generic-worker',
      primaryProtocol: 'mcp',
    });

    const receipt = await executor.execute(safeRequest(bridge.id));

    expect(receipt.status).toBe('blocked_missing_consent');
    expect(receipt.policyDecision.decision).toBe('blocked');
    expect(ledger.buildSnapshot().blockedExecutions).toBe(1);
  });

  it('allows execution after consent and blocks again after revocation', async () => {
    const paths = getTempPaths('agent-mesh-consent-allow');
    const orchestration = new AgentMeshOrchestrationService(paths);
    const ledger = new AgentMeshLedgerService({ ledgerPath: paths.ledgerPath });
    const executor = new AgentMeshExecutionService({ orchestrationService: orchestration, ledgerService: ledger });

    const bridge = await orchestration.registerBridge({
      agentName: 'Generic Worker',
      agentDescription: 'Generic local worker',
      connectionRef: 'secret-ref:agent-mesh/generic-worker',
      primaryProtocol: 'mcp',
    });

    await orchestration.authorize({
      id: 'consent-safe',
      signedAt: new Date().toISOString(),
      userFingerprint: 'operator',
      authorizedAgentId: bridge.id,
      grantedPermissions: [],
      risksAcknowledged: [],
      workspaceScope: null,
      sessionScope: null,
      expirationDate: null,
      revocable: true,
    });

    expect((await executor.execute(safeRequest(bridge.id))).status).toBe('completed_successfully');

    orchestration.revoke(bridge.id);
    expect((await executor.execute(safeRequest(bridge.id))).status).toBe('blocked_missing_consent');
  });

  it('blocks critical permissions unless the risk is explicitly acknowledged', async () => {
    const paths = getTempPaths('agent-mesh-critical-consent');
    const orchestration = new AgentMeshOrchestrationService(paths);
    const bridge = await orchestration.registerBridge({
      agentName: 'Generic Worker',
      agentDescription: 'Generic local worker',
      connectionRef: 'secret-ref:agent-mesh/generic-worker',
      primaryProtocol: 'cli-wrapper',
    });

    await expect(orchestration.authorize({
      id: 'consent-critical',
      signedAt: new Date().toISOString(),
      userFingerprint: 'operator',
      authorizedAgentId: bridge.id,
      grantedPermissions: ['process_execution'],
      risksAcknowledged: [],
      workspaceScope: null,
      sessionScope: null,
      expirationDate: null,
      revocable: true,
    })).rejects.toThrow('blocked by policy');
  });
});
