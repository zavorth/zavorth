import { ZavorthTerminalBackendsService } from '../../src/services/ZavorthTerminalBackendsService.js';

describe('ZavorthTerminalBackendsService', () => {
  it('exposes governed local, Docker, SSH, WSL and Vercel Sandbox backends without live-by-default execution', () => {
    const service = new ZavorthTerminalBackendsService({
      env: {},
      cwd: 'C:/workspace',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = service.execute();

    expect(snapshot.contractVersion).toBe('2026-05-24.terminal-backends-phase-6');
    expect(snapshot.status).toBe('preview');
    expect(snapshot.backends.map((entry) => entry.id)).toEqual([
      'local',
      'docker',
      'ssh',
      'wsl',
      'vercel-sandbox',
      'modal',
      'daytona',
    ]);
    expect(snapshot.backends.find((entry) => entry.id === 'local')?.status).toBe('ready');
    expect(snapshot.backends.find((entry) => entry.id === 'docker')?.liveReady).toBe(false);
    expect(snapshot.backends.find((entry) => entry.id === 'modal')?.status).toBe('planned');
    expect(snapshot.safety.noBackendLiveByDefault).toBe(true);
    expect(snapshot.safety.plannedBackendsDoNotClaimLive).toBe(true);
  });

  it('requires approval for dangerous terminal commands before any backend can execute', () => {
    const runner = jest.fn();
    const service = new ZavorthTerminalBackendsService({
      env: { ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE: 'true' },
      cwd: 'C:/workspace',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      runner,
    });

    const snapshot = service.execute({
      action: 'terminal.execute',
      backend: 'local',
      command: 'rm -rf dist',
      live: true,
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.command.risk).toBe('dangerous');
    expect(snapshot.command.approvalRequired).toBe(true);
    expect(snapshot.execution.performed).toBe(false);
    expect(runner).not.toHaveBeenCalled();
  });

  it('keeps live execution disabled until both approval and explicit live env are present', () => {
    const runner = jest.fn();
    const service = new ZavorthTerminalBackendsService({
      env: {},
      cwd: 'C:/workspace',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      runner,
    });

    const snapshot = service.execute({
      action: 'terminal.execute',
      backend: 'local',
      command: 'echo safe',
      live: true,
      approvalId: 'approval-1',
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.plan.mode).toBe('live-disabled');
    expect(snapshot.execution.attempted).toBe(true);
    expect(snapshot.execution.performed).toBe(false);
    expect(runner).not.toHaveBeenCalled();
  });

  it('executes a configured local command only after explicit live enablement and approval', () => {
    const runner = jest.fn(() => ({
      status: 0,
      stdout: 'hello sk-testtoken12345678901234567890',
      stderr: '',
      error: null,
    }));
    const service = new ZavorthTerminalBackendsService({
      env: { ZAVORTH_TERMINAL_BACKENDS_ALLOW_LIVE: 'true' },
      cwd: 'C:/workspace',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      runner,
    });

    const snapshot = service.execute({
      action: 'terminal.execute',
      backend: 'local',
      command: 'echo hello',
      live: true,
      approvalId: 'approval-1',
    });

    expect(snapshot.status).toBe('executed');
    expect(snapshot.execution.performed).toBe(true);
    expect(snapshot.execution.stdoutPreview).toContain('[redacted-secret]');
    expect(runner).toHaveBeenCalledWith(expect.objectContaining({
      cwd: expect.stringMatching(/C:[/\\]workspace/),
      timeoutMs: 30000,
    }));
  });

  it('does not claim Modal or Daytona as live backends', () => {
    const service = new ZavorthTerminalBackendsService({
      cwd: 'C:/workspace',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = service.execute({
      backend: 'daytona',
      command: 'npm test',
    });

    expect(snapshot.status).toBe('planned');
    expect(snapshot.selectedBackend).toBe('daytona');
    expect(snapshot.plan.willExecute).toBe(false);
    expect(snapshot.backends.find((entry) => entry.id === 'daytona')?.liveCapable).toBe(false);
  });
});
