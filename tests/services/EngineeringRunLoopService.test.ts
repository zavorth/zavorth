import { EngineeringRunLoopService } from '../../src/services/EngineeringRunLoopService.js';
import type { EngineeringRunSnapshot } from '../../src/contracts/EngineeringCoreContract.js';
import type { SystemOverlordActionRecord } from '../../src/contracts/SystemOverlordContract.js';

describe('EngineeringRunLoopService', () => {
  function buildRun(overrides: Partial<EngineeringRunSnapshot> = {}): EngineeringRunSnapshot {
    return {
      runId: 'eng-1',
      scopeKey: 'web:web:engineering:web-user',
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
      status: 'ready',
      request: {
        rawText: 'veja por que esse build quebrou',
        scope: { platform: 'web', chatId: 'web:engineering', userId: 'web-user' },
      },
      intent: {
        kind: 'diagnose_build',
        objective: 'veja por que esse build quebrou',
        mutating: false,
        requiresSession: true,
        preferredProfile: 'safe',
        workspaceHint: null,
        suggestedCommands: ['npm run build', 'npm test'],
      },
      context: {
        workspace: 'C:/workspace/demo',
        workspaceName: 'demo',
        packageJsonExists: true,
        packageManager: 'npm',
        scripts: { build: 'tsc', test: 'jest' },
        lockfiles: [],
        tsconfigExists: true,
        detectedStacks: ['node'],
        frameworks: [],
        languages: ['typescript'],
        importantPaths: [],
        shallowTree: [],
        instructionFile: null,
        instructionSummary: '',
        instructionNotes: [],
        workspaceCommands: [],
        workspaceHooks: [],
        autorepairSummary: null,
      },
      plan: {
        summary: 'Engineering Core preparado para diagnose_build.',
        profile: 'safe',
        actions: [{ kind: 'run_command', label: 'Executar build' }],
        patchProposal: null,
        repairProposal: null,
      },
      requirementGaps: [],
      linkedTaskId: null,
      session: null,
      hostActions: [],
      loop: null,
      replySummary: 'Run pronto.',
      ...overrides,
    };
  }

  function buildAction(status: SystemOverlordActionRecord['status'], command: string): SystemOverlordActionRecord {
    return {
      actionId: `action-${command}`,
      runId: 'eng-1',
      requestedBy: 'web-user',
      surface: 'web',
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:01.000Z',
      status,
      request: { capability: 'host.shell', command },
      decision: {
        allowed: status !== 'pending_approval',
        requiresApproval: status === 'pending_approval',
        reason: status === 'pending_approval' ? 'approval required' : 'ok',
        capability: 'host.shell',
        profile: 'trusted',
        requiredProfile: 'trusted',
        autonomyLevel: 3,
        requiredAutonomyLevel: 3,
        runtimeTarget: 'container',
        mutating: true,
        blockedReason: status === 'pending_approval' ? 'approval_required' : null,
      },
      command,
      workspace: 'C:/workspace/demo',
      stdout: status === 'completed' ? 'ok' : null,
      stderr: status === 'failed' ? 'error TS1005: expected ;' : null,
      exitCode: status === 'completed' ? 0 : null,
      errorCode: status === 'failed' ? 'EXECUTION_FAILED' : null,
      errorMessage: status === 'failed' ? 'error TS1005: expected ;' : null,
      rollbackAvailable: false,
      metadata: {},
    };
  }

  it('stops at approval when the gateway requires confirmation', async () => {
    const gateway = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      execute: jest.fn(async ({ command }) => buildAction('pending_approval', command)),
    };
    const service = new EngineeringRunLoopService({ executionGatewayService: gateway as any });

    const result = await service.execute({ run: buildRun(), approved: false });

    expect(result.status).toBe('waiting_user');
    expect(result.loop.status).toBe('waiting_approval');
    expect(result.hostActions).toHaveLength(1);
    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      command: 'npm run build',
      profile: 'safe',
      approved: false,
    }));
  });

  it('executes planned build and test commands when approved', async () => {
    const gateway = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      execute: jest.fn(async ({ command }) => buildAction('completed', command)),
    };
    const service = new EngineeringRunLoopService({ executionGatewayService: gateway as any });

    const result = await service.execute({ run: buildRun(), approved: true });

    expect(result.status).toBe('completed');
    expect(result.loop.commandsExecuted).toEqual(['npm run build', 'npm test']);
    expect(gateway.execute).toHaveBeenNthCalledWith(1, expect.objectContaining({
      command: 'npm run build',
      profile: 'trusted',
      approved: true,
    }));
  });

  it('creates a repair proposal when a command fails', async () => {
    const gateway = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      execute: jest.fn(async ({ command }) => buildAction('failed', command)),
    };
    const service = new EngineeringRunLoopService({ executionGatewayService: gateway as any });

    const result = await service.execute({ run: buildRun(), approved: true });

    expect(result.status).toBe('failed');
    expect(result.loop.status).toBe('failed');
    expect(result.repairProposal).toEqual(expect.objectContaining({
      kind: 'propose_patch',
    }));
  });

  it('executes preferred supervised capabilities without inferring them from the payload', async () => {
    const gateway = {
      inferCapabilityFromCommand: jest.fn(() => 'host.shell'),
      execute: jest.fn(async ({ command, capability }) => buildAction('completed', `${capability}:${command}`)),
    };
    const service = new EngineeringRunLoopService({ executionGatewayService: gateway as any });

    const result = await service.execute({
      run: buildRun({
        request: {
          rawText: 'suba um tunel',
          scope: { platform: 'telegram', chatId: 'telegram:1', userId: 'alice' },
        },
        intent: {
          kind: 'system_overlord_operation',
          objective: 'suba um tunel',
          mutating: true,
          requiresSession: false,
          preferredProfile: 'dangerous',
          preferredCapability: 'network.tunnel',
          preferredAutonomyLevel: 4,
          workspaceHint: null,
          suggestedCommands: ['{"action":"start"}'],
        },
        plan: {
          summary: 'Engineering Core preparou uma acao supervisionada de network.tunnel.',
          profile: 'dangerous',
          actions: [{ kind: 'run_command', label: 'Executar acao supervisionada' }],
          patchProposal: null,
          repairProposal: null,
        },
      }),
      approved: true,
    });

    expect(result.status).toBe('completed');
    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'network.tunnel',
      autonomyLevel: 4,
      profile: 'dangerous',
      command: '{"action":"start"}',
    }));
  });
});
