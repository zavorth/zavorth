import { RemoteMeshSandboxAdapterDryRunService } from '../../src/services/RemoteMeshSandboxAdapterDryRunService.js';
import { RemoteMeshSandboxContractService } from '../../src/services/RemoteMeshSandboxContractService.js';
import { RemoteMeshSandboxPolicyService } from '../../src/services/RemoteMeshSandboxPolicyService.js';

describe('RemoteMeshSandboxAdapterDryRunService R3', () => {
  it('builds dry-run bindings for MCP, SSH wrapper, Termux/PRoot, and policy blocks', () => {
    const snapshot = new RemoteMeshSandboxAdapterDryRunService({
      now: () => new Date('2026-05-05T15:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-05.remote-mesh-sandbox-r3-adapters');
    expect(snapshot.phase).toBe('R3');
    expect(snapshot.status).toBe('adapter-dry-run-ready');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        policyEvaluations: 5,
        bindings: 8,
        ready: 4,
        approvalRequired: 3,
        blocked: 1,
        mcpDryRuns: 3,
        sshWrapperDryRuns: 3,
        termuxProotDryRuns: 1,
        policyBlocks: 1,
        receipts: 8,
        remoteExecutionPerformed: false,
        liveNetworkCallPerformed: false,
        remoteProcessSpawned: false,
        filesystemMutationPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.bindings.every((binding) => binding.preview.rawCommand === null)).toBe(true);
    expect(snapshot.bindings.every((binding) => binding.preview.adapterCall.rawCommand === null)).toBe(true);
    expect(snapshot.bindings.every((binding) => binding.receipt.rawCommandSerialized === false)).toBe(true);
  });

  it('maps allowed notebook actions to scoped MCP dry-run calls', () => {
    const snapshot = new RemoteMeshSandboxAdapterDryRunService().buildSnapshot();
    const binding = snapshot.bindings.find(
      (candidate) => candidate.actionId === 'remote-policy:logs:allowed'
        && candidate.adapter === 'mcp-dry-run',
    );

    expect(binding).toEqual(
      expect.objectContaining({
        status: 'ready',
        transport: 'mcp-http',
        commandTemplateId: 'notebook.docker.logs.v1',
        mcpToolName: 'notebook.docker.logs',
      }),
    );
    expect(binding?.preview.adapterCall).toEqual(
      expect.objectContaining({
        kind: 'mcp-tool-call',
        name: 'notebook.docker.logs',
        rawCommand: null,
      }),
    );
    expect(binding?.preview.adapterCall.payload).toEqual(
      expect.objectContaining({
        schemaLocked: true,
        requiresAuth: true,
      }),
    );
    expect(binding?.guards.mcpBindingRequired).toBe(true);
  });

  it('creates SSH wrapper dry-runs using only commandTemplateId and redacted params', () => {
    const snapshot = new RemoteMeshSandboxAdapterDryRunService().buildSnapshot();
    const binding = snapshot.bindings.find(
      (candidate) => candidate.actionId === 'remote-policy:start:allowed'
        && candidate.adapter === 'ssh-wrapper-dry-run',
    );

    expect(binding).toEqual(
      expect.objectContaining({
        status: 'ready',
        transport: 'ssh-wrapper',
        commandTemplateId: 'notebook.docker.start_project.v1',
        mcpToolName: null,
      }),
    );
    expect(binding?.preview.adapterCall).toEqual(
      expect.objectContaining({
        kind: 'ssh-wrapper-template',
        name: 'notebook.docker.start_project.v1',
        rawCommand: null,
      }),
    );
    expect(binding?.preview.adapterCall.payload).toEqual(
      expect.objectContaining({
        commandTemplateId: 'notebook.docker.start_project.v1',
        rawCommand: null,
      }),
    );
    expect(JSON.stringify(binding)).not.toContain('docker compose');
    expect(binding?.guards.commandTemplateIdRequired).toBe(true);
  });

  it('keeps persistent notebook changes in approval-required dry-run state', () => {
    const snapshot = new RemoteMeshSandboxAdapterDryRunService().buildSnapshot();
    const bindings = snapshot.bindings.filter((candidate) => candidate.actionId === 'remote-policy:pull:approval');

    expect(bindings).toHaveLength(2);
    expect(bindings.every((binding) => binding.status === 'approval-required')).toBe(true);
    expect(bindings.every((binding) => binding.approvalRequired)).toBe(true);
    expect(bindings.every((binding) => binding.receipt.status === 'approval-required')).toBe(true);
    expect(bindings.every((binding) => binding.guards.approvalMustBeResolvedBeforeExecution)).toBe(true);
  });

  it('maps mobile sandbox actions to Termux/PRoot lifecycle previews with cleanup guardrails', () => {
    const snapshot = new RemoteMeshSandboxAdapterDryRunService().buildSnapshot();
    const binding = snapshot.bindings.find(
      (candidate) => candidate.actionId === 'remote-policy:sandbox:approval'
        && candidate.adapter === 'termux-proot-dry-run',
    );

    expect(binding).toEqual(
      expect.objectContaining({
        status: 'approval-required',
        transport: 'termux-proot',
        commandTemplateId: 'mobile.sandbox.create.v1',
      }),
    );
    expect(binding?.preview.adapterCall).toEqual(
      expect.objectContaining({
        kind: 'termux-proot-lifecycle',
        name: 'mobile.sandbox.create.v1',
        rawCommand: null,
      }),
    );
    expect(binding?.preview.adapterCall.payload).toEqual(
      expect.objectContaining({
        lifecycle: 'create',
        ttlMs: 900000,
        cleanupRequired: true,
        allowPersonalStorageAccess: false,
        prootIsSecurityBoundary: false,
      }),
    );
    expect(binding?.receipt.cleanupRequired).toBe(true);
  });

  it('turns denied policy evaluations into policy-block dry-runs only', () => {
    const snapshot = new RemoteMeshSandboxAdapterDryRunService().buildSnapshot();
    const bindings = snapshot.bindings.filter((candidate) => candidate.actionId === 'remote-policy:dangerous:denied');

    expect(bindings).toHaveLength(1);
    expect(bindings[0]).toEqual(
      expect.objectContaining({
        adapter: 'policy-block-dry-run',
        status: 'blocked',
        transport: 'policy-only',
        commandTemplateId: null,
        mcpToolName: null,
      }),
    );
    expect(bindings[0]?.preview.adapterCall.kind).toBe('policy-block');
    expect(bindings[0]?.receipt.status).toBe('blocked');
  });

  it('preserves redaction and dry-run hashes for custom evaluations', () => {
    const contracts = new RemoteMeshSandboxContractService();
    const policy = new RemoteMeshSandboxPolicyService({ contractService: contracts });
    const service = new RemoteMeshSandboxAdapterDryRunService({ policyService: policy });
    const action = contracts.buildAction({
      id: 'remote-policy:test:redacted',
      naturalLanguageIntent: 'Read logs with token-like params.',
      targetNodeId: 'remote-node:notebook:primary',
      toolId: 'notebook.git.pull',
      params: {
        project: 'zavorth',
        branch: 'feature/sk-1234567890abcdef',
      },
    });
    const evaluation = policy.evaluateAction(action);
    const bindings = service.buildBindingsForEvaluation(evaluation);

    expect(bindings).toHaveLength(2);
    for (const binding of bindings) {
      expect(JSON.stringify(binding)).not.toContain('sk-1234567890abcdef');
      expect(binding.dryRunHashes.stdoutPreviewHash).toHaveLength(64);
      expect(binding.dryRunHashes.stderrPreviewHash).toHaveLength(64);
      expect(binding.dryRunHashes.receiptPreviewHash).toHaveLength(64);
      expect(binding.receipt.mutationPerformed).toBe(false);
    }
  });
});
