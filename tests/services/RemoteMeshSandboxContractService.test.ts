import { RemoteMeshSandboxContractService } from '../../src/services/RemoteMeshSandboxContractService.js';

describe('RemoteMeshSandboxContractService R1', () => {
  it('builds the canonical R1 contract snapshot without remote execution authority', () => {
    const snapshot = new RemoteMeshSandboxContractService({
      now: () => new Date('2026-05-05T13:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r1');
    expect(snapshot.phase).toBe('R1');
    expect(snapshot.status).toBe('contract-ready');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        nodes: 3,
        tools: 6,
        sampleActions: 3,
        policyDecisions: 3,
        sandboxSessions: 1,
        receipts: 4,
        remoteExecutionPerformed: false,
        freeformShellAllowed: false,
        unauthenticatedMcpAllowed: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.tools.every((tool) => tool.freeformShellAllowed === false)).toBe(true);
    expect(snapshot.tools.every((tool) => tool.rawCommandAllowed === false)).toBe(true);
    expect(snapshot.tools.every((tool) => tool.sudoAllowed === false)).toBe(true);
    expect(snapshot.receipts.every((receipt) => receipt.rawCommandSerialized === false)).toBe(true);
  });

  it('allows scoped reversible notebook actions through policy without raw shell', () => {
    const service = new RemoteMeshSandboxContractService();
    const action = service.buildAction({
      id: 'remote-action:start-zavorth',
      naturalLanguageIntent: 'Start the Zavorth project container.',
      targetNodeId: 'remote-node:notebook:primary',
      toolId: 'notebook.docker.start_project',
      params: {
        project: 'zavorth',
        returnLogs: true,
        lines: 100,
      },
    });
    const decision = service.decideAction(action);

    expect(action.preview.rawCommand).toBeNull();
    expect(action.preview.commandTemplateId).toBe('notebook.docker.start_project.v1');
    expect(decision.status).toBe('allowed');
    expect(decision.policy).toEqual(
      expect.objectContaining({
        promptCannotExecuteShell: true,
        freeformShellDenied: true,
        unauthenticatedMcpDenied: true,
        sudoDenied: true,
        receiptRequired: true,
      }),
    );
  });

  it('requires approval for persistent notebook changes', () => {
    const service = new RemoteMeshSandboxContractService();
    const action = service.buildAction({
      id: 'remote-action:git-pull',
      naturalLanguageIntent: 'Pull the Zavorth repo on the notebook.',
      targetNodeId: 'remote-node:notebook:primary',
      toolId: 'notebook.git.pull',
      params: {
        project: 'zavorth',
        branch: 'main',
      },
    });
    const decision = service.decideAction(action);

    expect(action.risk).toBe('level-2-persistent');
    expect(decision.status).toBe('requires-approval');
    expect(decision.approval).toBe('explicit-approval');
    expect(decision.safeNextAction).toContain('Show preview');
  });

  it('denies dangerous shell-like parameters even when embedded in a known tool', () => {
    const service = new RemoteMeshSandboxContractService();
    const action = service.buildAction({
      id: 'remote-action:dangerous',
      naturalLanguageIntent: 'Run a dangerous cleanup.',
      targetNodeId: 'remote-node:notebook:primary',
      toolId: 'notebook.docker.logs',
      params: {
        project: 'zavorth',
        filter: 'rm -rf ~/.ssh',
      },
    });
    const decision = service.decideAction(action);

    expect(decision.status).toBe('denied');
    expect(decision.approval).toBe('blocked');
    expect(decision.blockedPatterns.length).toBeGreaterThan(0);
    expect(decision.reasons).toContain('Action parameters contain dangerous shell-like patterns.');
  });

  it('models PRoot sessions as ephemeral operational isolation, not a strong security boundary', () => {
    const service = new RemoteMeshSandboxContractService();
    const session = service.buildEphemeralSandboxSession({
      id: 'sandbox-session:test',
      nodeId: 'remote-node:mobile:sandbox',
      ttlMs: 99999999,
      guiAllowed: true,
      wakeLockAllowed: true,
    });

    expect(session.runtime).toBe('termux-proot');
    expect(session.ttlMs).toBe(3600000);
    expect(session.cleanup).toEqual(
      expect.objectContaining({
        destroyOnCompletion: true,
        removeProcesses: true,
        removeTempFiles: true,
        releaseWakeLock: true,
        receiptRequired: true,
      }),
    );
    expect(session.workspaceMount.allowPersonalStorageAccess).toBe(false);
    expect(session.securityNotes).toEqual(
      expect.objectContaining({
        prootIsSecurityBoundary: false,
        isolationStrength: 'operational-lightweight',
        untrustedInternetCodeAllowed: false,
      }),
    );
  });

  it('redacts secret-looking params in actions and receipts', () => {
    const service = new RemoteMeshSandboxContractService();
    const action = service.buildAction({
      id: 'remote-action:secret',
      naturalLanguageIntent: 'Read logs with a token filter.',
      targetNodeId: 'remote-node:notebook:primary',
      toolId: 'notebook.docker.logs',
      params: {
        project: 'zavorth',
        token: 'sk-1234567890abcdef',
        nested: {
      webhook: 'https://example.test/hook-auth=abc123',
        },
      },
    });
    const decision = service.decideAction(action);
    const receipt = service.buildReceipt({ action, decision, session: null });

    expect(JSON.stringify(action)).not.toContain('sk-1234567890abcdef');
    expect(JSON.stringify(receipt)).not.toContain('abc123');
    expect(receipt.noSecretsSerialized).toBe(true);
    expect(receipt.rawCommandSerialized).toBe(false);
  });
});
