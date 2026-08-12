import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CompanionControlService } from '../../src/services/CompanionControlService.js';
import type { DesktopResourceSnapshot } from '../../src/contracts/DesktopResourceContract.js';

function buildDesktopSnapshot(): DesktopResourceSnapshot {
  return {
    version: 1,
    generatedAt: '2026-04-14T15:00:00.000Z',
    host: {
      hostname: 'WORKSTATION',
      platform: 'win32',
      totalVisibleMemoryMb: 8192,
      freePhysicalMemoryMb: 2048,
      totalPhysicalMemoryMb: 8192,
      memoryLoadPercent: 75,
      pressure: 'moderate',
      usedPhysicalMemoryMb: 6144,
    },
    signals: {
      wsl: {
        ok: true,
        message: 'WSL ativo.',
        warnings: [],
        distros: [
          {
            name: 'Ubuntu-24.04',
            state: 'Running',
            version: '2',
            isDefault: true,
          },
        ],
      },
      docker: {
        detected: true,
        status: 'idle',
        runningContainerCount: 0,
        contextName: 'desktop-linux',
        warnings: [],
      },
    },
    totals: {
      processesTracked: 4,
      groupsTracked: 4,
      memoryTrackedMb: 900,
      companionMemoryMb: 500,
      zavorthMemoryMb: 200,
      externalMemoryMb: 200,
    },
    groups: [
      {
        id: 'docker-desktop',
        label: 'Docker Desktop',
        owner: 'companion',
        pressure: 'high',
        summary: 'Docker Desktop ativo e aparentando ociosidade.',
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 320,
          pagedMemoryMb: 300,
          privateMemoryMb: 280,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        itemCount: 2,
        itemIds: ['process:10', 'process:11'],
        actions: [],
      },
      {
        id: 'wsl',
        label: 'WSL',
        owner: 'companion',
        pressure: 'low',
        summary: 'WSL com 1 distro ativa.',
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 10,
          pagedMemoryMb: 8,
          privateMemoryMb: 8,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        itemCount: 1,
        itemIds: ['wsl:ubuntu-24.04'],
        actions: [],
      },
    ],
    items: [
      {
        id: 'process:10',
        label: 'Docker Desktop',
        owner: 'companion',
        kind: 'docker-runtime',
        pressure: 'high',
        controlId: 'docker-desktop',
        status: 'running',
        summary: 'Docker Desktop usando 320 MB.',
        details: [],
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 320,
          pagedMemoryMb: 300,
          privateMemoryMb: 280,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        process: {
          pid: 10,
          processName: 'Docker Desktop',
          executablePath: 'C:/Program Files/Docker/Docker/Docker Desktop.exe',
          commandLine: 'Docker Desktop.exe',
          mainWindowTitle: 'Docker Desktop',
        },
      },
      {
        id: 'process:11',
        label: 'com.docker.backend',
        owner: 'companion',
        kind: 'docker-runtime',
        pressure: 'moderate',
        controlId: 'docker-desktop',
        status: 'running',
        summary: 'Backend docker.',
        details: [],
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 40,
          pagedMemoryMb: 30,
          privateMemoryMb: 25,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        process: {
          pid: 11,
          processName: 'com.docker.backend',
          executablePath: 'C:/Program Files/Docker/Docker/resources/com.docker.backend.exe',
          commandLine: 'com.docker.backend.exe',
          mainWindowTitle: null,
        },
      },
      {
        id: 'process:20',
        label: 'ZavorthBridge',
        owner: 'companion',
        kind: 'companion-app',
        pressure: 'moderate',
        controlId: 'zavorthBridge',
        status: 'running',
        summary: 'ZavorthBridge usando 120 MB.',
        details: [],
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 120,
          pagedMemoryMb: 100,
          privateMemoryMb: 90,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        process: {
          pid: 20,
          processName: 'ZavorthBridge',
          executablePath: 'C:/Program Files/ZavorthBridge/ZavorthBridge.exe',
          commandLine: 'ZavorthBridge.exe',
          mainWindowTitle: 'ZavorthBridge',
        },
      },
      {
        id: 'wsl:ubuntu-24.04',
        label: 'WSL Ubuntu-24.04',
        owner: 'companion',
        kind: 'wsl-distro',
        pressure: 'low',
        controlId: 'wsl',
        status: 'running',
        summary: 'WSL ativo.',
        details: [],
        metrics: {
          cpuSeconds: 0,
          workingSetMb: 0,
          pagedMemoryMb: 0,
          privateMemoryMb: 0,
          readTransferMb: 0,
          writeTransferMb: 0,
        },
        process: null,
      },
    ],
    topConsumers: [],
    recommendedActions: [],
    warnings: [],
    recommendations: [],
  };
}

function cloneDesktopSnapshot(snapshot: DesktopResourceSnapshot = buildDesktopSnapshot()): DesktopResourceSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DesktopResourceSnapshot;
}

function buildDockerStoppedSnapshot(): DesktopResourceSnapshot {
  const snapshot = cloneDesktopSnapshot();
  snapshot.signals.docker.detected = true;
  snapshot.signals.docker.status = 'stopped';
  snapshot.signals.docker.runningContainerCount = 0;
  snapshot.items = snapshot.items.filter((entry) => entry.controlId !== 'docker-desktop');
  snapshot.groups = snapshot.groups.filter((entry) => entry.id !== 'docker-desktop');
  snapshot.totals.processesTracked = snapshot.items.filter((entry) => entry.process).length;
  snapshot.totals.groupsTracked = snapshot.groups.length;
  snapshot.totals.memoryTrackedMb = snapshot.items.reduce((total, entry) => total + entry.metrics.workingSetMb, 0);
  snapshot.totals.companionMemoryMb = snapshot.items
    .filter((entry) => entry.owner === 'companion')
    .reduce((total, entry) => total + entry.metrics.workingSetMb, 0);
  return snapshot;
}

function buildImpactPlanner() {
  return {
    planCompanionAction: jest.fn(async () => ({
      generatedAt: '2026-04-14T15:00:00.000Z',
      taskKind: 'companion',
      intent: 'companion action',
      heavy: false,
      approvalRequired: false,
      summary: 'Impacto simulado.',
      userFacingSummary: 'Impacto simulado.',
      budget: {
        ramMb: 0,
        cpuPercent: 0,
        diskMb: 0,
        processCount: 0,
        externalExposure: 'none',
        recurring: false,
        companionDependencies: ['docker-desktop'],
        capabilityIds: [],
        fallback: 'Nenhum.',
        notes: [],
      },
      capabilityEstimates: [],
      companionEstimates: [],
      warnings: [],
    })),
    renderImpactSummary: jest.fn(() => 'Impacto simulado.'),
  };
}

describe('CompanionControlService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lists all companions with actions and statuses', async () => {
    const service = new CompanionControlService({
      desktopResources: {
        inspectLive: jest.fn(async () => buildDesktopSnapshot()),
        readLatest: jest.fn(),
      } as any,
      zavorthBridgeControl: {
        status: jest.fn(async () => ({ ok: true, message: 'ZavorthBridge pronto.' })),
        restart: jest.fn(),
      } as any,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.companions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'wsl', status: 'running' }),
        expect.objectContaining({ id: 'docker-desktop', status: 'idle' }),
        expect.objectContaining({ id: 'zavorthBridge', status: 'running' }),
        expect.objectContaining({ id: 'codex-companion', status: 'stopped' }),
      ]),
    );
  });

  it('executes a safe docker idle stop action', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-state-'));
    const dockerRoot = path.join(tempDir, 'Docker');
    const frontendDir = path.join(dockerRoot, 'frontend');
    const resourcesDir = path.join(dockerRoot, 'resources');
    const cliPluginsDir = path.join(tempDir, 'cli-plugins');
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.mkdirSync(cliPluginsDir, { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'Docker Desktop.exe'), '');
    fs.writeFileSync(path.join(resourcesDir, 'com.docker.backend.exe'), '');
    fs.writeFileSync(path.join(cliPluginsDir, 'docker-agent.exe'), '');
    fs.writeFileSync(path.join(cliPluginsDir, 'docker-sandbox.exe'), '');
    const desktopSnapshot = buildDesktopSnapshot();
    const dockerDesktopProcess = desktopSnapshot.items.find((entry) => entry.id === 'process:10');
    const dockerBackendProcess = desktopSnapshot.items.find((entry) => entry.id === 'process:11');
    if (dockerDesktopProcess?.process) {
      dockerDesktopProcess.process.executablePath = path.join(frontendDir, 'Docker Desktop.exe');
    }
    if (dockerBackendProcess?.process) {
      dockerBackendProcess.process.executablePath = path.join(resourcesDir, 'com.docker.backend.exe');
    }
    const stoppedSnapshot = buildDockerStoppedSnapshot();
    const inspectLive = jest.fn();
    const snapshots = [desktopSnapshot, stoppedSnapshot];
    inspectLive.mockImplementation(async () => snapshots.shift() || stoppedSnapshot);
    const exec = jest.fn(async () => '');
    const impactPlanner = buildImpactPlanner();
    const service = new CompanionControlService({
      stateFilePath: path.join(tempDir, 'companions-state.json'),
      desktopResources: {
        inspectLive,
        readLatest: jest.fn(),
      } as any,
      zavorthBridgeControl: {
        status: jest.fn(async () => ({ ok: true, message: 'ZavorthBridge pronto.' })),
        restart: jest.fn(),
      } as any,
      impactPlanner: impactPlanner as any,
      exec,
    });

    const result = await service.executeAction({
      companionId: 'docker-desktop',
      actionId: 'stop-idle',
      requestedBy: 'tester',
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(exec).toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining([
        '-NoProfile',
        expect.stringContaining('taskkill.exe'),
      ]),
      expect.objectContaining({
        timeoutMs: 30_000,
      }),
    );
    expect(exec.mock.calls[0]?.[1]?.[2] || '').toContain('docker-agent.exe');
    expect(exec.mock.calls[0]?.[1]?.[2] || '').toContain('docker-sandbox.exe');
    expect(exec.mock.calls[0]?.[1]?.[2] || '').toContain(dockerRoot);
    expect(result.summary).toContain('Docker Desktop encerrado');
    expect(result.snapshot?.companions.find((entry) => entry.id === 'docker-desktop')).toEqual(
      expect.objectContaining({
        status: 'stopped',
        processCount: 0,
      }),
    );
    expect(result.snapshot?.companions.find((entry) => entry.id === 'docker-desktop')?.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Ultima acao: stop-idle'),
      ]),
    );
    expect(result.resourceImpact).toEqual(expect.objectContaining({
      taskKind: 'companion',
      budget: expect.objectContaining({
        ramMb: expect.any(Number),
      }),
    }));
  });

  it('still allows docker cleanup when the daemon is unavailable but residual processes remain', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-docker-residual-'));
    const dockerRoot = path.join(tempDir, 'Docker');
    const frontendDir = path.join(dockerRoot, 'frontend');
    const resourcesDir = path.join(dockerRoot, 'resources');
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'Docker Desktop.exe'), '');
    fs.writeFileSync(path.join(resourcesDir, 'com.docker.backend.exe'), '');
    const desktopSnapshot = buildDesktopSnapshot();
    desktopSnapshot.signals.docker.detected = false;
    desktopSnapshot.signals.docker.runningContainerCount = null;
    desktopSnapshot.signals.docker.contextName = null as any;
    const dockerDesktopProcess = desktopSnapshot.items.find((entry) => entry.id === 'process:10');
    const dockerBackendProcess = desktopSnapshot.items.find((entry) => entry.id === 'process:11');
    if (dockerDesktopProcess?.process) {
      dockerDesktopProcess.process.executablePath = path.join(frontendDir, 'Docker Desktop.exe');
    }
    if (dockerBackendProcess?.process) {
      dockerBackendProcess.process.executablePath = path.join(resourcesDir, 'com.docker.backend.exe');
    }
    const settledSnapshot = buildDockerStoppedSnapshot();
    settledSnapshot.signals.docker.detected = false;
    settledSnapshot.signals.docker.status = 'unavailable';
    settledSnapshot.signals.docker.contextName = null;
    const inspectLive = jest.fn();
    const snapshots = [desktopSnapshot, settledSnapshot];
    inspectLive.mockImplementation(async () => snapshots.shift() || settledSnapshot);
    const exec = jest.fn(async () => '');
    const service = new CompanionControlService({
      stateFilePath: path.join(tempDir, 'companions-state.json'),
      desktopResources: {
        inspectLive,
        readLatest: jest.fn(),
      } as any,
      zavorthBridgeControl: {
        status: jest.fn(async () => ({ ok: true, message: 'ZavorthBridge pronto.' })),
        restart: jest.fn(),
      } as any,
      exec,
    });

    const result = await service.executeAction({
      companionId: 'docker-desktop',
      actionId: 'stop-idle',
      requestedBy: 'tester',
      force: true,
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(exec).toHaveBeenCalled();
    expect(result.summary).toContain('Docker Desktop encerrado');
  });

  it('returns a settled docker snapshot after resume', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-companion-resume-'));
    const dockerRoot = path.join(tempDir, 'Docker');
    const frontendDir = path.join(dockerRoot, 'frontend');
    const resourcesDir = path.join(dockerRoot, 'resources');
    fs.mkdirSync(frontendDir, { recursive: true });
    fs.mkdirSync(resourcesDir, { recursive: true });
    fs.writeFileSync(path.join(frontendDir, 'Docker Desktop.exe'), '');
    fs.writeFileSync(path.join(resourcesDir, 'com.docker.backend.exe'), '');

    const warmupSnapshot = cloneDesktopSnapshot();
    warmupSnapshot.signals.docker.detected = false;
    warmupSnapshot.signals.docker.status = 'unavailable';
    warmupSnapshot.signals.docker.contextName = null;
    const dockerDesktopProcess = warmupSnapshot.items.find((entry) => entry.id === 'process:10');
    const dockerBackendProcess = warmupSnapshot.items.find((entry) => entry.id === 'process:11');
    if (dockerDesktopProcess?.process) {
      dockerDesktopProcess.process.executablePath = path.join(frontendDir, 'Docker Desktop.exe');
    }
    if (dockerBackendProcess?.process) {
      dockerBackendProcess.process.executablePath = path.join(resourcesDir, 'com.docker.backend.exe');
    }

    const resumedSnapshot = buildDesktopSnapshot();
    const inspectLive = jest.fn();
    const snapshots = [warmupSnapshot, resumedSnapshot];
    inspectLive.mockImplementation(async () => snapshots.shift() || resumedSnapshot);
    const exec = jest.fn(async () => '');
    const impactPlanner = buildImpactPlanner();
    const service = new CompanionControlService({
      stateFilePath: path.join(tempDir, 'companions-state.json'),
      desktopResources: {
        inspectLive,
        readLatest: jest.fn(),
      } as any,
      zavorthBridgeControl: {
        status: jest.fn(async () => ({ ok: true, message: 'ZavorthBridge pronto.' })),
        restart: jest.fn(),
      } as any,
      impactPlanner: impactPlanner as any,
      exec,
    });

    const result = await service.executeAction({
      companionId: 'docker-desktop',
      actionId: 'resume',
      requestedBy: 'tester',
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(exec).toHaveBeenCalledWith(
      'powershell.exe',
      expect.arrayContaining([
        '-NoProfile',
        expect.stringContaining('Start-Process'),
      ]),
      expect.objectContaining({
        timeoutMs: 15_000,
      }),
    );
    expect(result.snapshot?.companions.find((entry) => entry.id === 'docker-desktop')).toEqual(
      expect.objectContaining({
        status: 'idle',
        processCount: 2,
      }),
    );
    expect(result.snapshot?.companions.find((entry) => entry.id === 'docker-desktop')?.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Ultima acao: resume'),
      ]),
    );
  });

  it('blocks WSL hibernate without force when approval is required', async () => {
    const service = new CompanionControlService({
      desktopResources: {
        inspectLive: jest.fn(async () => buildDesktopSnapshot()),
        readLatest: jest.fn(),
      } as any,
      zavorthBridgeControl: {
        status: jest.fn(async () => ({ ok: true, message: 'ZavorthBridge pronto.' })),
        restart: jest.fn(),
      } as any,
      wslControl: {
        status: jest.fn(),
        start: jest.fn(),
        shutdown: jest.fn(),
      } as any,
    });

    const result = await service.executeAction({
      companionId: 'wsl',
      actionId: 'hibernate',
      requestedBy: 'tester',
    });

    expect(result.ok).toBe(false);
    expect(result.requiresApproval).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.result).toEqual(expect.objectContaining({ status: 'approval_required' }));
  });
});
