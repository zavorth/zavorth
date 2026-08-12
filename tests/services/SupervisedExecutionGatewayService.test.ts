import { SupervisedExecutionGatewayService } from '../../src/services/SupervisedExecutionGatewayService.js';
import { HostActionLedgerService } from '../../src/services/HostActionLedgerService.js';
import type { ExecutionRequest, ExecutionResult } from '../../src/contracts/ExecutionContract.js';

describe('SupervisedExecutionGatewayService', () => {
  function createLedger() {
    const entries: any[] = [];
    return {
      entries,
      ledger: {
        record: jest.fn((entry) => {
          entries.push(entry);
          return entry;
        }),
        list: jest.fn((limit = 50) => entries.slice(-Math.max(1, limit)).reverse()),
        find: jest.fn((actionId) => [...entries].reverse().find((entry) => entry.actionId === actionId) || null),
      },
    };
  }

  function buildExecutionResult(request: ExecutionRequest): ExecutionResult {
    return {
      execution_id: request.execution_id,
      task_id: request.task_id,
      executor: request.executor,
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: ['ran'],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: request.instructions,
      stdout: 'ok',
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    };
  }

  it('blocks install actions until the profile is upgraded', async () => {
    const { ledger } = createLedger();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: ledger as any,
      runner: jest.fn(),
    });

    const result = await service.execute({
      capability: 'host.install',
      profile: 'safe',
      autonomyLevel: 3,
      command: 'npm install left-pad',
      workspace: process.cwd(),
    });

    expect(result.status).toBe('pending_approval');
    expect(result.errorCode).toBe('profile_upgrade_required');
    expect(result.metadata.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'approval',
        id: expect.stringContaining('host-action-'),
        status: 'approval_required',
      }),
    ]));
    expect(ledger.record).toHaveBeenCalledTimes(1);
  });

  it('records dry-run decisions without invoking the runner', async () => {
    const runner = jest.fn();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: { record: jest.fn((entry) => entry), list: jest.fn(), find: jest.fn() } as any,
      runner,
    });

    const result = await service.execute({
      capability: 'host.shell',
      profile: 'safe',
      autonomyLevel: 1,
      command: 'git status',
      dryRun: true,
    });

    expect(result.status).toBe('dry_run');
    expect(runner).not.toHaveBeenCalled();
    expect(result.metadata.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution',
        status: 'planned',
      }),
    ]));
  });

  it('executes approved host commands through the supervised runner', async () => {
    const runner = jest.fn(async (request: ExecutionRequest) => buildExecutionResult(request));
    const { ledger } = createLedger();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: ledger as any,
      runner,
    });

    const result = await service.execute({
      capability: 'host.shell',
      profile: 'trusted',
      autonomyLevel: 3,
      command: 'npm run build',
      approved: true,
      workspace: process.cwd(),
    });

    expect(result.status).toBe('completed');
    expect(result.decision.runtimeTarget).toBe('container');
    expect(runner).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        sandboxRequired: true,
      }),
      instructions: ['npm run build'],
    }));
    expect(result.metadata.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution',
        status: 'running',
      }),
      expect.objectContaining({
        kind: 'execution',
        status: 'completed',
      }),
    ]));
  });

  it('redacts secret-looking values before recording supervised execution receipts', async () => {
    const secret = 'sk-super-secret-value-1234567890';
    const runner = jest.fn(async (request: ExecutionRequest) => ({
      ...buildExecutionResult(request),
      stdout: `token=${secret}`,
      stderr: `Bearer ${secret}`,
      metadata: {
        apiKey: secret,
      },
    }));
    const { ledger, entries } = createLedger();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: ledger as any,
      runner,
    });

    const result = await service.execute({
      capability: 'host.shell',
      profile: 'trusted',
      autonomyLevel: 3,
      command: 'npm run build',
      approved: true,
      workspace: process.cwd(),
      metadata: {
        token: secret,
      },
    });

    const serialized = JSON.stringify({ result, entries });
    expect(serialized).not.toContain(secret);
    expect(serialized).toContain('[redacted-secret]');
  });

  it('routes docker exec to a specialized adapter before generic execution', async () => {
    const adapter = {
      id: 'docker-test-adapter',
      label: 'Docker test adapter',
      canHandle: jest.fn(() => true),
      execute: jest.fn(async () => ({
        ok: true,
        stdout: 'docker ok',
        metadata: { action: 'exec' },
      })),
    };
    const runner = jest.fn();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: { record: jest.fn((entry) => entry), list: jest.fn(), find: jest.fn() } as any,
      runner,
      adapterRegistry: {
        findAdapter: jest.fn(() => adapter),
        listAdapters: jest.fn(() => []),
      } as any,
    });

    const result = await service.execute({
      capability: 'docker.exec',
      profile: 'trusted',
      autonomyLevel: 3,
      command: JSON.stringify({
        container: 'web',
        command: 'node',
        args: ['-v'],
      }),
      approved: true,
    });

    expect(result.status).toBe('completed');
    expect(result.stdout).toBe('docker ok');
    expect(result.metadata.adapterId).toBe('docker-test-adapter');
    expect(runner).not.toHaveBeenCalled();
  });

  it('routes network tunnel actions to a specialized adapter before generic execution', async () => {
    const adapter = {
      id: 'network-tunnel-test-adapter',
      label: 'Network tunnel test adapter',
      canHandle: jest.fn(() => true),
      execute: jest.fn(async () => ({
        ok: true,
        stdout: 'tunnel ok',
        metadata: { action: 'inspect', publicUrl: 'https://zavorth.example.com' },
      })),
    };
    const runner = jest.fn();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: { record: jest.fn((entry) => entry), list: jest.fn(), find: jest.fn() } as any,
      runner,
      adapterRegistry: {
        findAdapter: jest.fn(() => adapter),
        listAdapters: jest.fn(() => []),
      } as any,
    });

    const result = await service.execute({
      capability: 'network.tunnel',
      profile: 'dangerous',
      autonomyLevel: 4,
      command: JSON.stringify({ action: 'inspect' }),
      approved: true,
    });

    expect(result.status).toBe('completed');
    expect(result.stdout).toBe('tunnel ok');
    expect(result.metadata.adapterId).toBe('network-tunnel-test-adapter');
    expect(runner).not.toHaveBeenCalled();
  });

  it('routes browser control to the supervised adapter registry', async () => {
    const adapter = {
      id: 'browser-test-adapter',
      label: 'Browser test adapter',
      canHandle: jest.fn(() => true),
      execute: jest.fn(async () => ({
        ok: true,
        stdout: 'browser ok',
        metadata: { action: 'navigate' },
      })),
    };
    const service = new SupervisedExecutionGatewayService({
      ledgerService: { record: jest.fn((entry) => entry), list: jest.fn(), find: jest.fn() } as any,
      runner: jest.fn(),
      adapterRegistry: {
        findAdapter: jest.fn(() => adapter),
        listAdapters: jest.fn(() => []),
      } as any,
    });

    const result = await service.execute({
      capability: 'browser.control',
      profile: 'dangerous',
      autonomyLevel: 5,
      command: JSON.stringify({ action: 'navigate', url: 'https://example.com' }),
      approved: true,
    });

    expect(result.status).toBe('completed');
    expect(result.stdout).toBe('browser ok');
    expect(result.metadata.adapterId).toBe('browser-test-adapter');
    expect(adapter.execute).toHaveBeenCalledTimes(1);
  });

  it('exposes ledger listing through the gateway facade', () => {
    const ledger = new HostActionLedgerService({ ledgerFile: 'unused.jsonl' });
    jest.spyOn(ledger, 'list').mockReturnValue([{ actionId: 'a-1' } as any]);
    const service = new SupervisedExecutionGatewayService({ ledgerService: ledger });

    expect(service.listActions()).toEqual([{ actionId: 'a-1' }]);
  });

  it('records approval rejections as auditable ledger events', () => {
    const record = jest.fn((entry) => entry);
    const service = new SupervisedExecutionGatewayService({
      ledgerService: { record, list: jest.fn(), find: jest.fn() } as any,
    });
    const rejected = service.recordApprovalDecision({
      action: {
        actionId: 'approval-1',
        runId: null,
        requestedBy: 'operator',
        surface: 'web-overlord',
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:01.000Z',
        status: 'pending_approval',
        request: {
          capability: 'host.install',
          profile: 'safe',
          autonomyLevel: 1,
        },
        decision: {
          allowed: false,
          requiresApproval: true,
          reason: 'Precisa de approval.',
          capability: 'host.install',
          profile: 'safe',
          requiredProfile: 'trusted',
          autonomyLevel: 1,
          requiredAutonomyLevel: 3,
          runtimeTarget: 'container',
          mutating: true,
          blockedReason: 'profile_upgrade_required',
        },
        command: 'npm install left-pad',
        workspace: process.cwd(),
        stdout: null,
        stderr: null,
        exitCode: null,
        errorCode: 'profile_upgrade_required',
        errorMessage: 'Precisa de approval.',
        rollbackAvailable: false,
        metadata: {},
      },
      decision: 'reject',
      requestedBy: 'alice',
      reason: 'nao agora',
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.errorCode).toBe('approval_rejected');
    expect(rejected.metadata.approvalDecision).toEqual(expect.objectContaining({
      decision: 'reject',
      decidedBy: 'alice',
      reason: 'nao agora',
      previousStatus: 'pending_approval',
    }));
    expect(rejected.metadata.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'approval',
        status: 'blocked',
        id: 'approval-1',
      }),
    ]));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('blocks new actions while the kill switch is active', async () => {
    const runner = jest.fn();
    const service = new SupervisedExecutionGatewayService({
      ledgerService: { record: jest.fn((entry) => entry), list: jest.fn(() => []), find: jest.fn(() => null) } as any,
      runner,
    });

    await service.setKillSwitch({
      active: true,
      requestedBy: 'alice',
      reason: 'maintenance',
    });
    const result = await service.execute({
      capability: 'host.shell',
      profile: 'trusted',
      autonomyLevel: 3,
      command: 'git status',
      approved: true,
    });

    expect(service.getKillSwitchState().active).toBe(true);
    expect(result.status).toBe('blocked');
    expect(result.errorCode).toBe('kill_switch_active');
    expect(runner).not.toHaveBeenCalled();
  });

  it('cancels a running supervised adapter action without overwriting the ledger afterwards', async () => {
    const { ledger } = createLedger();
    let resolveAdapter: ((value: any) => void) | null = null;
    const adapter = {
      id: 'docker-test-adapter',
      label: 'Docker test adapter',
      canHandle: jest.fn(() => true),
      execute: jest.fn(() => new Promise((resolve) => {
        resolveAdapter = resolve;
      })),
      cancel: jest.fn(async () => ({
        ok: true,
        stdout: 'cancelled',
        stderr: null,
        errorCode: null,
        errorMessage: null,
        metadata: { action: 'cancel' },
      })),
    };
    const service = new SupervisedExecutionGatewayService({
      ledgerService: ledger as any,
      runner: jest.fn(),
      adapterRegistry: {
        findAdapter: jest.fn(() => adapter),
        listAdapters: jest.fn(() => []),
      } as any,
    });

    const executionPromise = service.execute({
      actionId: 'running-1',
      capability: 'docker.exec',
      profile: 'trusted',
      autonomyLevel: 3,
      command: JSON.stringify({
        container: 'web',
        command: 'node',
        args: ['-v'],
      }),
      approved: true,
    });
    await Promise.resolve();

    const cancelled = await service.cancelAction({
      actionId: 'running-1',
      requestedBy: 'alice',
      reason: 'pare agora',
    });

    resolveAdapter?.({
      ok: false,
      stdout: '',
      stderr: 'killed',
      errorCode: 'cancelled',
      errorMessage: 'killed',
      metadata: { action: 'exec' },
    });
    const final = await executionPromise;

    expect(adapter.cancel).toHaveBeenCalledWith('running-1', 'pare agora');
    expect(cancelled.status).toBe('cancelled');
    expect(final.status).toBe('cancelled');
    expect(ledger.find('running-1')?.status).toBe('cancelled');
  });

  it('marks long supervised adapter actions as timed_out and attempts adapter cancelation', async () => {
    const { ledger } = createLedger();
    const adapter = {
      id: 'long-running-test-adapter',
      label: 'Long running test adapter',
      canHandle: jest.fn(() => true),
      execute: jest.fn(() => new Promise(() => undefined)),
      cancel: jest.fn(async () => ({
        ok: true,
        stdout: 'cancelled by timeout',
        stderr: null,
        errorCode: null,
        errorMessage: null,
        metadata: { reason: 'timeout' },
      })),
    };
    const service = new SupervisedExecutionGatewayService({
      ledgerService: ledger as any,
      runner: jest.fn(),
      adapterRegistry: {
        findAdapter: jest.fn(() => adapter),
        listAdapters: jest.fn(() => []),
      } as any,
    });

    const result = await service.execute({
      actionId: 'long-running-1',
      capability: 'docker.exec',
      profile: 'trusted',
      autonomyLevel: 3,
      command: JSON.stringify({
        container: 'web',
        command: 'node',
        args: ['-v'],
      }),
      approved: true,
      timeoutMs: 1,
    });

    expect(result.status).toBe('timed_out');
    expect(result.errorCode).toBe('action_timed_out');
    expect(result.metadata).toEqual(expect.objectContaining({
      adapterId: 'long-running-test-adapter',
      cancelAttempted: true,
    }));
    expect(adapter.cancel).toHaveBeenCalledWith('long-running-1', expect.stringContaining('Timeout supervisionado'));
    expect(ledger.find('long-running-1')?.status).toBe('timed_out');
  });

  it('rolls back completed actions through a supervised adapter when rollback is available', async () => {
    const { ledger } = createLedger();
    ledger.record({
      actionId: 'tunnel-start-1',
      runId: null,
      requestedBy: 'operator',
      surface: 'web-overlord',
      createdAt: '2026-04-11T12:00:00.000Z',
      updatedAt: '2026-04-11T12:00:02.000Z',
      status: 'completed',
      request: {
        actionId: 'tunnel-start-1',
        capability: 'network.tunnel',
        profile: 'dangerous',
        autonomyLevel: 4,
        approved: true,
      },
      decision: {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'network.tunnel',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 4,
        requiredAutonomyLevel: 4,
        runtimeTarget: 'host',
        mutating: true,
        blockedReason: null,
      },
      command: '{"action":"start"}',
      workspace: process.cwd(),
      stdout: 'started',
      stderr: null,
      exitCode: 0,
      errorCode: null,
      errorMessage: null,
      rollbackAvailable: true,
      metadata: {
        action: 'start',
      },
    });
    const adapter = {
      id: 'network-tunnel-test-adapter',
      label: 'Network tunnel test adapter',
      canHandle: jest.fn(() => true),
      rollback: jest.fn(async () => ({
        ok: true,
        stdout: 'rolled back',
        stderr: null,
        errorCode: null,
        errorMessage: null,
        metadata: {
          action: 'rollback-stop',
        },
      })),
    };
    const service = new SupervisedExecutionGatewayService({
      ledgerService: ledger as any,
      adapterRegistry: {
        findAdapter: jest.fn(() => adapter),
        listAdapters: jest.fn(() => []),
      } as any,
    });

    const rollback = await service.rollbackAction({
      actionId: 'tunnel-start-1',
      requestedBy: 'alice',
      reason: 'desfazer tunnel',
    });

    expect(adapter.rollback).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'tunnel-start-1',
    }), 'desfazer tunnel');
    expect(rollback.status).toBe('completed');
    expect(rollback.actionId).toMatch(/^rollback-/);
  });
});
