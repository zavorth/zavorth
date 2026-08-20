import fs from 'fs';
import os from 'os';
import path from 'path';
import { SystemSupervisorSmokeService as SystemOverlordSmokeService } from '../../src/services/SystemSupervisorSmokeService.js';


function buildAction(overrides: Partial<any> = {}) {
  return {
    actionId: overrides.actionId || 'action-1',
    runId: null,
    requestedBy: 'system-overlord-smoke',
    surface: 'ops-smoke',
    createdAt: '2026-04-11T12:00:00.000Z',
    updatedAt: '2026-04-11T12:00:01.000Z',
    status: overrides.status || 'completed',
    request: overrides.request || {
      capability: overrides.capability || 'browser.control',
      profile: 'dangerous',
      autonomyLevel: 5,
      approved: true,
    },
    decision: overrides.decision || {
      allowed: true,
      requiresApproval: false,
      reason: 'ok',
      capability: overrides.capability || 'browser.control',
      profile: 'dangerous',
      requiredProfile: 'dangerous',
      autonomyLevel: 5,
      requiredAutonomyLevel: 5,
      runtimeTarget: overrides.runtimeTarget || 'browser',
      mutating: true,
      blockedReason: null,
    },
    command: overrides.command || null,
    workspace: overrides.workspace || __dirname,
    stdout: overrides.stdout || null,
    stderr: overrides.stderr || null,
    exitCode: overrides.exitCode ?? 0,
    errorCode: overrides.errorCode || null,
    errorMessage: overrides.errorMessage || null,
    rollbackAvailable: overrides.rollbackAvailable === true,
    metadata: overrides.metadata || {},
  };
}

function buildTunnelStatus(overrides: Partial<any> = {}) {
  return {
    enabled: false,
    running: false,
    ready: false,
    pid: null,
    tunnelPid: null,
    cliPath: 'cloudflared',
    hostScriptPath: path.join(__dirname, 'scripts', 'public-tunnel-host.js'),
    publicUrl: null,
    targetUrl: null,
    checkedAt: '2026-04-11T12:00:00.000Z',
    message: 'disabled',
    stateFile: path.join(__dirname, 'data', 'runtime', 'zavorth-public-tunnel.json'),
    logFile: path.join(__dirname, 'data', 'runtime', 'zavorth-public-tunnel.log'),
    ...overrides,
  };
}

describe('SystemOverlordSmokeService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('writes a passed smoke report with honest skips for optional runtimes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-overlord-smoke-pass-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'system-overlord-smoke-last.json');
    const browserTool = {
      handleToolCall: jest.fn(),
      diagnose: jest.fn(async () => ({
        checkedAt: '2026-04-11T12:00:00.000Z',
        ok: true,
        moduleName: 'custom',
        moduleAvailable: true,
        launchable: true,
        error: null,
        recommendations: [],
      })),
      shutdown: jest.fn(async () => undefined),
    };
    const gateway = {
      execute: jest.fn(async (request: any) => {
        if (request.capability === 'browser.control') {
          return buildAction({
            actionId: 'browser-1',
            capability: 'browser.control',
            runtimeTarget: 'browser',
            stdout: JSON.stringify({
              url: 'http://127.0.0.1:39999/',
              title: 'Zavorth Overlord Smoke',
            }),
          });
        }
        if (request.capability === 'docker.exec') {
          return buildAction({
            actionId: 'docker-inspect',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            status: 'failed',
            errorCode: 'spawn_failed',
            errorMessage: 'docker not found',
            stderr: 'docker not found',
          });
        }
        throw new Error(`capability inesperada: ${request.capability}`);
      }),
      rollbackAction: jest.fn(),
    };
    const tunnelService = {
      readStatus: jest.fn(() => buildTunnelStatus({ enabled: false, message: 'disabled by config' })),
      ensureStarted: jest.fn(),
      stop: jest.fn(async () => buildTunnelStatus()),
    };
    const companionControlService = {
      executeAction: jest.fn(async () => ({ ok: false, executed: false })),
    };

    const service = new SystemOverlordSmokeService({
      gatewayService: gateway as any,
      browserTool: browserTool as any,
      publicTunnelService: tunnelService as any,
      companionControlService: companionControlService as any,
      reportFile,
      platform: 'linux',
      createProbeServer: async () => ({
        url: 'http://127.0.0.1:39999/',
        close: async () => undefined,
      }),
    });

    const report = await service.run();

    expect(report.status).toBe('passed');
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: 'browser.control',
          status: 'passed',
        }),
        expect.objectContaining({
          capability: 'network.tunnel',
          status: 'skipped',
        }),
        expect.objectContaining({
          capability: 'wsl.exec',
          status: 'skipped',
        }),
        expect.objectContaining({
          capability: 'docker.exec',
          status: 'skipped',
        }),
      ]),
    );
    expect(fs.existsSync(reportFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(reportFile, 'utf8')).status).toBe('passed');
    expect(browserTool.shutdown).toHaveBeenCalled();
    expect(gateway.rollbackAction).not.toHaveBeenCalled();
  });

  it('rolls back a tunnel started by the smoke itself', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-overlord-smoke-tunnel-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'system-overlord-smoke-last.json');
    const browserTool = {
      handleToolCall: jest.fn(),
      diagnose: jest.fn(async () => ({
        checkedAt: '2026-04-11T12:00:00.000Z',
        ok: true,
        moduleName: 'custom',
        moduleAvailable: true,
        launchable: true,
        error: null,
        recommendations: [],
      })),
      shutdown: jest.fn(async () => undefined),
    };
    const gateway = {
      execute: jest.fn(async (request: any) => {
        if (request.capability === 'browser.control') {
          return buildAction({
            actionId: 'browser-1',
            capability: 'browser.control',
            runtimeTarget: 'browser',
            stdout: JSON.stringify({
              url: 'http://127.0.0.1:39999/',
              title: 'Zavorth Overlord Smoke',
            }),
          });
        }
        if (request.capability === 'network.tunnel') {
          return buildAction({
            actionId: 'tunnel-1',
            capability: 'network.tunnel',
            runtimeTarget: 'host',
            rollbackAvailable: true,
            metadata: {
              ready: true,
              publicUrl: 'https://zavorth-smoke.example.com',
              started: true,
              message: 'started',
            },
          });
        }
        if (request.capability === 'docker.exec') {
          return buildAction({
            actionId: 'docker-inspect',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            status: 'failed',
            errorCode: 'spawn_failed',
            errorMessage: 'docker not found',
          });
        }
        throw new Error(`capability inesperada: ${request.capability}`);
      }),
      rollbackAction: jest.fn(async () =>
        buildAction({
          actionId: 'rollback-tunnel-1',
          capability: 'network.tunnel',
          runtimeTarget: 'host',
        })),
    };
    const tunnelService = {
      readStatus: jest.fn(() => buildTunnelStatus({
        enabled: true,
        message: 'enabled',
      })),
      ensureStarted: jest.fn(),
      stop: jest.fn(async () => buildTunnelStatus({
        enabled: true,
        message: 'stopped',
      })),
    };
    const companionControlService = {
      executeAction: jest.fn(async () => ({ ok: false, executed: false })),
    };

    const service = new SystemOverlordSmokeService({
      gatewayService: gateway as any,
      browserTool: browserTool as any,
      publicTunnelService: tunnelService as any,
      companionControlService: companionControlService as any,
      reportFile,
      platform: 'linux',
      existsSync: jest.fn(() => true),
      createProbeServer: async () => ({
        url: 'http://127.0.0.1:39999/',
        close: async () => undefined,
      }),
    });

    const report = await service.run();

    expect(report.status).toBe('passed');
    expect(gateway.rollbackAction).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'tunnel-1',
    }));
  });

  it('provisions and removes a temporary docker container when the daemon is available but no container is running', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-overlord-smoke-docker-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'system-overlord-smoke-last.json');
    const browserTool = {
      handleToolCall: jest.fn(),
      diagnose: jest.fn(async () => ({
        checkedAt: '2026-04-11T12:00:00.000Z',
        ok: true,
        moduleName: 'custom',
        moduleAvailable: true,
        launchable: true,
        error: null,
        recommendations: [],
      })),
      shutdown: jest.fn(async () => undefined),
    };
    const gateway = {
      execute: jest.fn(async (request: any) => {
        if (request.capability === 'browser.control') {
          return buildAction({
            actionId: 'browser-1',
            capability: 'browser.control',
            runtimeTarget: 'browser',
            stdout: JSON.stringify({
              url: 'http://127.0.0.1:39999/',
              title: 'Zavorth Overlord Smoke',
            }),
          });
        }
        if (request.capability === 'wsl.exec') {
          return buildAction({
            actionId: 'wsl-inspect',
            capability: 'wsl.exec',
            runtimeTarget: 'wsl',
            status: 'failed',
            errorCode: 'spawn_failed',
            errorMessage: 'wsl not configured',
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('Inspecionar')) {
          return buildAction({
            actionId: 'docker-inspect',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            metadata: {
              containers: [],
            },
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('Provisionar')) {
          return buildAction({
            actionId: 'docker-run',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            metadata: {
              container: 'zavorth-overlord-smoke-test',
            },
            stdout: 'zavorth-overlord-smoke-test',
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('diagnostico')) {
          return buildAction({
            actionId: 'docker-exec',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            stdout: '/workspace',
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('Remover')) {
          return buildAction({
            actionId: 'docker-rm',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            stdout: 'zavorth-overlord-smoke-test',
          });
        }
        throw new Error(`capability inesperada: ${request.capability}`);
      }),
      rollbackAction: jest.fn(),
    };
    const tunnelService = {
      readStatus: jest.fn(() => buildTunnelStatus({ enabled: false, message: 'disabled by config' })),
      ensureStarted: jest.fn(),
      stop: jest.fn(async () => buildTunnelStatus()),
    };
    const companionControlService = {
      executeAction: jest.fn(async () => ({ ok: false, executed: false })),
    };

    const service = new SystemOverlordSmokeService({
      gatewayService: gateway as any,
      browserTool: browserTool as any,
      publicTunnelService: tunnelService as any,
      companionControlService: companionControlService as any,
      reportFile,
      platform: 'linux',
      createProbeServer: async () => ({
        url: 'http://127.0.0.1:39999/',
        close: async () => undefined,
      }),
    });

    const report = await service.run();

    expect(report.status).toBe('passed');
    expect(report.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: 'docker.exec',
          status: 'passed',
          summary: expect.stringContaining('Docker supervisionado executou'),
        }),
      ]),
    );
    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'docker.exec',
      objective: expect.stringContaining('Provisionar um container temporario'),
    }));
    expect(gateway.execute).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'docker.exec',
      objective: expect.stringContaining('Remover o container temporario'),
    }));
  });

  it('wakes Docker Desktop on demand for the smoke and hibernates it after the probe', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-overlord-smoke-docker-wake-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'system-overlord-smoke-last.json');
    const browserTool = {
      handleToolCall: jest.fn(),
      diagnose: jest.fn(async () => ({
        checkedAt: '2026-04-11T12:00:00.000Z',
        ok: true,
        moduleName: 'custom',
        moduleAvailable: true,
        launchable: true,
        error: null,
        recommendations: [],
      })),
      shutdown: jest.fn(async () => undefined),
    };
    let dockerInspectCalls = 0;
    const gateway = {
      execute: jest.fn(async (request: any) => {
        if (request.capability === 'browser.control') {
          return buildAction({
            actionId: 'browser-1',
            capability: 'browser.control',
            runtimeTarget: 'browser',
            stdout: JSON.stringify({
              url: 'http://127.0.0.1:39999/',
              title: 'Zavorth Overlord Smoke',
            }),
          });
        }
        if (request.capability === 'wsl.exec') {
          return buildAction({
            actionId: 'wsl-inspect',
            capability: 'wsl.exec',
            runtimeTarget: 'wsl',
            status: 'failed',
            errorCode: 'spawn_failed',
            errorMessage: 'wsl not configured',
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('Inspecionar')) {
          dockerInspectCalls += 1;
          if (dockerInspectCalls === 1) {
            return buildAction({
              actionId: 'docker-inspect-cold',
              capability: 'docker.exec',
              runtimeTarget: 'container',
              status: 'failed',
              errorCode: 'spawn_failed',
              errorMessage: 'Cannot connect to the Docker daemon',
            });
          }
          if (dockerInspectCalls === 2) {
            return buildAction({
              actionId: 'docker-inspect-warming',
              capability: 'docker.exec',
              runtimeTarget: 'container',
              status: 'timed_out',
              errorCode: 'action_timed_out',
              errorMessage: 'Docker Desktop ainda esta inicializando',
            });
          }
          return buildAction({
            actionId: 'docker-inspect-ready',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            metadata: {
              containers: [],
            },
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('Provisionar')) {
          return buildAction({
            actionId: 'docker-run',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            metadata: {
              container: 'zavorth-overlord-smoke-test',
            },
            stdout: 'zavorth-overlord-smoke-test',
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('diagnostico')) {
          return buildAction({
            actionId: 'docker-exec',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            stdout: '/workspace',
          });
        }
        if (request.capability === 'docker.exec' && request.objective.includes('Remover')) {
          return buildAction({
            actionId: 'docker-rm',
            capability: 'docker.exec',
            runtimeTarget: 'container',
            stdout: 'zavorth-overlord-smoke-test',
          });
        }
        throw new Error(`capability inesperada: ${request.capability}`);
      }),
      rollbackAction: jest.fn(),
    };
    const tunnelService = {
      readStatus: jest.fn(() => buildTunnelStatus({ enabled: false, message: 'disabled by config' })),
      ensureStarted: jest.fn(),
      stop: jest.fn(async () => buildTunnelStatus()),
    };
    const companionControlService = {
      executeAction: jest.fn(async (input: any) => ({
        ok: true,
        executed: true,
        companionId: input.companionId,
        actionId: input.actionId,
      })),
    };

    const service = new SystemOverlordSmokeService({
      gatewayService: gateway as any,
      browserTool: browserTool as any,
      publicTunnelService: tunnelService as any,
      companionControlService: companionControlService as any,
      reportFile,
      platform: 'win32',
      sleep: async () => undefined,
      createProbeServer: async () => ({
        url: 'http://127.0.0.1:39999/',
        close: async () => undefined,
      }),
    });

    const report = await service.run();

    expect(report.status).toBe('passed');
    expect(companionControlService.executeAction).toHaveBeenCalledWith(expect.objectContaining({
      companionId: 'docker-desktop',
      actionId: 'resume',
    }));
    expect(companionControlService.executeAction).toHaveBeenCalledWith(expect.objectContaining({
      companionId: 'docker-desktop',
      actionId: 'stop-idle',
    }));
  });
});
