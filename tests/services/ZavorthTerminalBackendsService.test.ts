import { ZavorthTerminalBackendsService } from '../../src/services/ZavorthTerminalBackendsService.js';

describe('ZavorthTerminalBackendsService', () => {
  it('exposes governed local, Docker, SSH, WSL and Vercel Sandbox backends without live-by-default execution', () => {
    const service = new ZavorthTerminalBackendsService({
      env: {},
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = service.execute();

    expect(snapshot.contractVersion).toBe('2026-05-24.terminal-backends-phase-7');
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
    expect(snapshot.backends.find((entry) => entry.id === 'wsl')?.liveReady).toBe(false);
    expect(snapshot.backends.find((entry) => entry.id === 'local')?.readinessProof.kind).toBe('local-host');
    expect(snapshot.backends.find((entry) => entry.id === 'modal')?.status).toBe('needs-configuration');
    expect(snapshot.backends.find((entry) => entry.id === 'modal')?.liveCapable).toBe(true);
    expect(snapshot.safety.noBackendLiveByDefault).toBe(true);
    expect(snapshot.safety.cloudBackendsRequireExplicitConfiguration).toBe(true);
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

  it('plans Modal and Daytona through real adapter envelopes once configured', () => {
    const service = new ZavorthTerminalBackendsService({
      env: {
        DAYTONA_API_KEY: 'daytona-secret',
        ZAVORTH_DAYTONA_WORKSPACE: 'zavorth-workspace',
      },
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner: () => ({
        status: 0,
        stdout: 'daytona version 1.0.0',
        stderr: '',
        error: null,
      }),
    });

    const snapshot = service.execute({
      action: 'terminal.plan',
      backend: 'daytona',
      command: 'echo ok',
    });

    expect(snapshot.status).toBe('preview');
    expect(snapshot.selectedBackend).toBe('daytona');
    expect(snapshot.plan.willExecute).toBe(false);
    expect(snapshot.plan.executable).toBe('daytona');
    expect(snapshot.plan.args).toEqual(['workspace', 'exec', 'zavorth-workspace', '--', 'echo ok']);
    expect(snapshot.backends.find((entry) => entry.id === 'daytona')?.liveCapable).toBe(true);
    expect(snapshot.backends.find((entry) => entry.id === 'daytona')?.status).toBe('ready');
  });

  it('does not claim strong backend readiness from env or host assumptions without a successful probe', () => {
    const service = new ZavorthTerminalBackendsService({
      env: {
        ZAVORTH_DOCKER_ENABLED: 'true',
        ZAVORTH_WSL_ENABLED: 'true',
        ZAVORTH_VERCEL_SANDBOX_ENABLED: 'true',
        VERCEL_TOKEN: 'vercel-secret',
        ZAVORTH_MODAL_ENABLED: 'true',
        DAYTONA_API_KEY: 'daytona-secret',
        ZAVORTH_DAYTONA_WORKSPACE: 'zavorth-workspace',
        ZAVORTH_SSH_HOST: 'example.internal',
      },
      cwd: 'C:/workspace',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner: () => ({
        status: 1,
        stdout: '',
        stderr: 'not available',
        error: 'spawn ENOENT',
      }),
    });

    const snapshot = service.execute();
    const strongBackends = snapshot.backends.filter((entry) => entry.id !== 'local');

    expect(strongBackends.some((entry) => entry.liveReady)).toBe(false);
    for (const backend of strongBackends.filter((entry) => ['docker', 'wsl', 'vercel-sandbox', 'modal', 'daytona'].includes(entry.id))) {
      expect(backend.status).toBe('needs-configuration');
      expect(backend.readinessProof.kind).toBe('probe-failed');
      expect(backend.readinessProof.rawSecretSerialized).toBe(false);
    }
    expect(snapshot.backends.find((entry) => entry.id === 'ssh')?.readinessProof.kind).toBe('configured-only');
    expect(snapshot.backends.find((entry) => entry.id === 'ssh')?.liveReady).toBe(false);
  });

  it('marks installed Docker and WSL as dormant on-demand backends without heavy readiness probes', () => {
    const probeRunner = jest.fn((input) => {
      if (input.executable === 'where.exe') {
        return {
          status: 0,
          stdout: input.args.includes('docker') ? 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' : 'C:\\Windows\\System32\\wsl.exe',
          stderr: '',
          error: null,
        };
      }
      return {
        status: 1,
        stdout: '',
        stderr: 'heavy probe should not run',
        error: 'unexpected probe',
      };
    });
    const service = new ZavorthTerminalBackendsService({
      env: {},
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner,
    });

    const snapshot = service.execute();
    const docker = snapshot.backends.find((entry) => entry.id === 'docker');
    const wsl = snapshot.backends.find((entry) => entry.id === 'wsl');

    expect(docker).toEqual(expect.objectContaining({
      status: 'available-on-demand',
      liveReady: false,
      activationMode: 'on-demand',
      dormant: true,
      installed: true,
      readinessProof: expect.objectContaining({
        kind: 'available-dormant',
        observed: true,
        command: 'where.exe docker',
      }),
    }));
    expect(wsl).toEqual(expect.objectContaining({
      status: 'available-on-demand',
      liveReady: false,
      activationMode: 'on-demand',
      dormant: true,
      installed: true,
      readinessProof: expect.objectContaining({
        kind: 'available-dormant',
        observed: true,
        command: 'where.exe wsl.exe',
      }),
    }));
    expect(probeRunner).not.toHaveBeenCalledWith(expect.objectContaining({
      executable: 'docker',
    }));
    expect(probeRunner).not.toHaveBeenCalledWith(expect.objectContaining({
      executable: 'wsl.exe',
      args: expect.arrayContaining(['--']),
    }));
  });

  it('upgrades dormant Docker into a real readiness probe when live execution explicitly selects it', () => {
    const probeRunner = jest.fn((input) => {
      if (input.executable === 'docker') {
        return {
          status: 0,
          stdout: '24.0.7',
          stderr: '',
          error: null,
        };
      }
      if (input.executable === 'where.exe') {
        return {
          status: 0,
          stdout: 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
          stderr: '',
          error: null,
        };
      }
      return {
        status: 1,
        stdout: '',
        stderr: 'unexpected probe',
        error: 'unexpected probe',
      };
    });
    const service = new ZavorthTerminalBackendsService({
      env: {},
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner,
    });

    const snapshot = service.execute({
      action: 'terminal.execute',
      backend: 'docker',
      command: 'echo ok',
      live: true,
      approvalId: 'approval-1',
    });
    const docker = snapshot.backends.find((entry) => entry.id === 'docker');

    expect(docker).toMatchObject({
      status: 'ready',
      liveReady: true,
      dormant: false,
      readinessProof: {
        kind: 'host-probe',
        rawSecretSerialized: false,
      },
    });
    expect(probeRunner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'docker',
      args: ['version', '--format', '{{.Server.Version}}'],
    }));
  });

  it('upgrades dormant WSL into a minimal execution probe when live execution explicitly selects it', () => {
    const probeRunner = jest.fn((input) => {
      if (input.executable === 'wsl.exe') {
        return {
          status: 0,
          stdout: 'ok',
          stderr: '',
          error: null,
        };
      }
      if (input.executable === 'where.exe') {
        return {
          status: 0,
          stdout: 'C:\\Windows\\System32\\wsl.exe',
          stderr: '',
          error: null,
        };
      }
      return {
        status: 1,
        stdout: '',
        stderr: 'unexpected probe',
        error: 'unexpected probe',
      };
    });
    const service = new ZavorthTerminalBackendsService({
      env: {},
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner,
    });

    const snapshot = service.execute({
      action: 'terminal.execute',
      backend: 'wsl',
      command: 'echo ok',
      live: true,
      approvalId: 'approval-1',
    });
    const wsl = snapshot.backends.find((entry) => entry.id === 'wsl');

    expect(wsl).toMatchObject({
      status: 'ready',
      liveReady: true,
      dormant: false,
      readinessProof: {
        kind: 'host-probe',
        rawSecretSerialized: false,
      },
    });
    expect(probeRunner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'wsl.exe',
      args: ['--', 'sh', '-lc', 'true'],
      timeoutMs: 90000,
    }));
  });

  it('proves WSL readiness with a minimal execution probe instead of a status-only probe', () => {
    const probeRunner = jest.fn(() => ({
      status: 0,
      stdout: 'ok',
      stderr: '',
      error: null,
    }));
    const service = new ZavorthTerminalBackendsService({
      env: { ZAVORTH_WSL_ENABLED: 'true' },
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner,
    });

    const snapshot = service.execute();

    expect(snapshot.backends.find((entry) => entry.id === 'wsl')).toMatchObject({
      status: 'ready',
      liveReady: true,
      readinessProof: {
        kind: 'host-probe',
        rawSecretSerialized: false,
      },
    });
    expect(probeRunner).toHaveBeenCalledWith(expect.objectContaining({
      executable: 'wsl.exe',
      args: ['--', 'sh', '-lc', 'true'],
      timeoutMs: 90000,
    }));
  });

  it('sanitizes backend probe summaries before receipts or JSON projection', () => {
    const service = new ZavorthTerminalBackendsService({
      env: { ZAVORTH_WSL_ENABLED: 'true' },
      cwd: 'C:/workspace',
      platform: 'win32',
      now: () => new Date('2026-05-24T12:00:00.000Z'),
      probeRunner: () => ({
        status: 1,
        stdout: '',
        stderr: 'W\u0000S\u0000L\u0000 failed sk-secret12345678901234567890',
        error: null,
      }),
    });

    const summary = service.execute().backends.find((entry) => entry.id === 'wsl')?.readinessProof.summary || '';

    expect(summary).not.toContain('\u0000');
    expect(summary).not.toContain('sk-secret');
    expect(summary).toContain('[redacted-secret]');
  });
});
