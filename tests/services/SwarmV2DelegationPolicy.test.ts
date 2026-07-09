import { SwarmV2Service } from '../../src/agents/SwarmV2Service';

describe('SwarmV2 Delegation Policies', () => {
  it('applies custom allowed tools and approval flags from delegationPolicy', () => {
    const service = new SwarmV2Service({
      orchestratorFactory: (objective, roles) => ({
        execute: async () => ({ status: 'completed', roles: [] }),
        getSnapshot: () => ({
          swarmId: 'test-swarm',
          status: 'running',
          objective,
          roles: [],
          startedAt: new Date().toISOString(),
          finishedAt: null,
          synthesizedOutput: null,
        }),
        on: () => {},
      } as any),
    });

    const snapshot = service.launchSwarm({
      objective: 'Run a swarm with custom delegation policies',
      roles: [
        {
          id: 'unrestricted-coder',
          label: 'Unrestricted Coder',
          systemPrompt: 'Code without approvals.',
          delegationPolicy: {
            allowedTools: ['write_file', 'run_command', 'read_file'],
            requiresApprovalTools: [], // empty list means requiresApproval should resolve to false
            sandboxInheritance: false,
          },
        },
        {
          id: 'restricted-verifier',
          label: 'Restricted Verifier',
          systemPrompt: 'Read files only, requires approvals.',
          delegationPolicy: {
            allowedTools: ['read_file'],
            requiresApprovalTools: ['read_file'],
            sandboxInheritance: true,
          },
        },
      ],
    });

    expect(snapshot.subagentReceipts).toHaveLength(2);

    const coderReceipt = snapshot.subagentReceipts!.find((r) => r.roleId === 'unrestricted-coder');
    expect(coderReceipt).toBeDefined();
    expect(coderReceipt!.scope.allowedTools).toEqual(expect.arrayContaining(['write_file', 'run_command', 'read_file']));
    expect(coderReceipt!.scope.allowedTools).toHaveLength(3);
    expect(coderReceipt!.scope.requiresApproval).toBe(false);
    expect(coderReceipt!.approvalBoundary.requiresApproval).toBe(false);

    const verifierReceipt = snapshot.subagentReceipts!.find((r) => r.roleId === 'restricted-verifier');
    expect(verifierReceipt).toBeDefined();
    expect(verifierReceipt!.scope.allowedTools).toEqual(['read_file']);
    expect(verifierReceipt!.scope.requiresApproval).toBe(true);
    expect(verifierReceipt!.approvalBoundary.requiresApproval).toBe(true);
  });
});
