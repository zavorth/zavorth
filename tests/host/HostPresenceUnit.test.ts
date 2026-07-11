import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ChildProcess } from 'node:child_process';

import {
  HostPresenceUnit,
  renderHostPresenceText,
  type HostPresenceGoalLoopHeartbeat,
} from '../../src/host/HostPresenceUnit.js';

describe('HostPresenceUnit', () => {
  let root: string;
  let stateDir: string;
  let currentTime = Date.parse('2026-07-10T12:00:00.000Z');
  const now = () => new Date(currentTime);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-presence-'));
    stateDir = path.join(root, '.zavorth', 'host-presence');
    fs.mkdirSync(path.join(root, 'packages', 'code', 'cli', 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    currentTime = Date.parse('2026-07-10T12:00:00.000Z');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function makeUnit(overrides: Partial<ConstructorParameters<typeof HostPresenceUnit>[0]> = {}) {
    const binaryPath = path.join(
      root,
      'packages',
      'code',
      'cli',
      'dist',
      'zavorth-windows-x64',
      'bin',
      'zavorth.exe',
    );
    return new HostPresenceUnit({
      projectRoot: root,
      env: {
        ZAVORTH_POLICY_AUTHORITY: 'gateway',
        ZAVORTH_GATEWAY_BASE_URL: 'http://127.0.0.1:20128',
      },
      now,
      stateDir,
      platform: 'win32',
      resolveBinary: () => (fs.existsSync(binaryPath) ? binaryPath : null),
      ensureBinary: () => {
        fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
        fs.writeFileSync(binaryPath, 'fake-bin');
        return { ok: true, path: binaryPath, detail: `ensured ${binaryPath}` };
      },
      probeGateway: async () => ({ ok: true, summary: 'HTTP 200 (injected)' }),
      readGoalLoopHeartbeat: () =>
        ({
          daemonId: 'cli-goal-loop-daemon',
          status: 'running',
          lastHeartbeatAt: '2026-07-10T11:59:00.000Z',
          source: 'state-db',
          heartbeatRecorded: true,
        }) satisfies HostPresenceGoalLoopHeartbeat,
      spawnImpl: jest.fn(() => {
        const child = {
          pid: 4242,
          unref: jest.fn(),
        } as unknown as ChildProcess;
        return child;
      }) as unknown as typeof import('node:child_process').spawn,
      spawnSyncImpl: jest.fn(() => ({ status: 0, error: undefined })) as unknown as typeof import('node:child_process').spawnSync,
      killPid: jest.fn(() => true),
      isPidAlive: jest.fn((pid: number) => pid === 4242),
      startSupervisorReload: jest.fn(() => ({ accepted: false, summary: 'not used in tests' })),
      supervisedReloadRequestScriptPath: path.join(root, 'scripts', 'request-supervised-reload.ps1'),
      powershellExecutablePath: path.join(root, 'powershell.exe'),
      ...overrides,
    });
  }

  it('install writes state, ensures binary, and scaffolds Windows OS service without admin failure', async () => {
    fs.writeFileSync(path.join(root, 'powershell.exe'), 'pwsh');
    const unit = makeUnit();
    const result = await unit.install({ ensureBinary: true, osService: true });

    expect(result.ok).toBe(true);
    expect(result.action).toBe('install');
    expect(result.snapshot.installed).toBe(true);
    expect(result.snapshot.binary.present).toBe(true);
    expect(result.snapshot.binary.mode).toBe('binary');
    expect(result.snapshot.binary.bunRequired).toBe(false);
    expect(result.snapshot.policyAuthority).toBe('gateway');
    expect(result.snapshot.gateway.ready).toBe(true);
    expect(result.snapshot.osService.scaffolded).toBe(true);
    expect(result.snapshot.osService.path).toBeTruthy();
    expect(fs.existsSync(result.snapshot.osService.path as string)).toBe(true);
    expect(fs.existsSync(path.join(stateDir, 'host-presence.json'))).toBe(true);
  });

  it('status surfaces goal-loop heartbeat, binary presence, policy authority, and gateway readiness', async () => {
    const unit = makeUnit();
    await unit.install({ ensureBinary: true, osService: false });
    const result = await unit.status();

    expect(result.ok).toBe(true);
    expect(result.snapshot.goalLoop.heartbeatRecorded).toBe(true);
    expect(result.snapshot.goalLoop.lastHeartbeatAt).toBe('2026-07-10T11:59:00.000Z');
    expect(result.snapshot.goalLoop.daemonId).toBe('cli-goal-loop-daemon');
    expect(result.snapshot.binary.present).toBe(true);
    expect(result.snapshot.policyAuthority).toBe('gateway');
    expect(result.snapshot.gateway.ready).toBe(true);
    expect(result.snapshot.gateway.summary).toContain('injected');

    const text = renderHostPresenceText(result.snapshot);
    expect(text).toContain('goal-loop:');
    expect(text).toContain('heartbeat=2026-07-10T11:59:00.000Z');
    expect(text).toContain('policy-authority: gateway');
    expect(text).toContain('bun-required: no');
    expect(text).toMatch(/registered=/);
  });

  it('start records pid and stop clears it (with yes)', async () => {
    const unit = makeUnit();
    await unit.install({ ensureBinary: true, osService: false });

    const preview = await unit.start({ yes: false });
    expect(preview.dryRun).toBe(true);
    expect(preview.snapshot.running).toBe(false);

    const started = await unit.start({ yes: true });
    expect(started.ok).toBe(true);
    expect(started.snapshot.running).toBe(true);
    expect(started.snapshot.pid).toBe(4242);

    const stopPreview = await unit.stop({ yes: false });
    expect(stopPreview.dryRun).toBe(true);

    const stopped = await unit.stop({ yes: true });
    expect(stopped.ok).toBe(true);
    expect(stopped.snapshot.pid).toBeNull();
    expect(stopped.snapshot.running).toBe(false);
  });

  it('start prefers dist/host.js over Code TUI binary', async () => {
    const binaryPath = path.join(
      root,
      'packages',
      'code',
      'cli',
      'dist',
      'zavorth-windows-x64',
      'bin',
      'zavorth.exe',
    );
    fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
    fs.writeFileSync(binaryPath, 'fake-bin');
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'host.js'), '/* host */');

    const spawnImpl = jest.fn(() => {
      const child = {
        pid: 5150,
        unref: jest.fn(),
      } as unknown as ChildProcess;
      return child;
    }) as unknown as typeof import('node:child_process').spawn;

    const unit = makeUnit({
      resolveBinary: () => binaryPath,
      spawnImpl,
      isPidAlive: jest.fn((pid: number) => pid === 5150),
    });
    await unit.install({ ensureBinary: false, osService: false });
    const started = await unit.start({ yes: true });

    expect(started.ok).toBe(true);
    expect(spawnImpl).toHaveBeenCalled();
    const command = String((spawnImpl as unknown as jest.Mock).mock.calls[0]?.[0] || '');
    expect(command).toContain('host.js');
    expect(command).not.toContain('zavorth.exe');
    expect(started.snapshot.binary.present).toBe(true);
    expect(started.snapshot.binary.bunRequired).toBe(false);
  });

  it('start falls back to agent host source (src/host.ts) when dist/host.js is missing', async () => {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'host.ts'), '// host');

    const spawnImpl = jest.fn(() => {
      const child = {
        pid: 6161,
        unref: jest.fn(),
      } as unknown as ChildProcess;
      return child;
    }) as unknown as typeof import('node:child_process').spawn;

    const unit = makeUnit({
      resolveBinary: () => null,
      ensureBinary: () => ({ ok: false, path: null, detail: 'skipped' }),
      spawnImpl,
      isPidAlive: jest.fn((pid: number) => pid === 6161),
    });
    await unit.install({ ensureBinary: false, osService: false });
    const started = await unit.start({ yes: true });

    const command = String((spawnImpl as unknown as jest.Mock).mock.calls[0]?.[0] || '');
    expect(command).toContain('host.ts');
    expect(command).toMatch(/tsx/);
    expect(command).not.toContain('zavorth.exe');
    expect(started.snapshot.pid).toBe(6161);
  });

  it('defaults supervised reload script to scripts/request-supervised-reload.ps1', async () => {
    const scriptPath = path.join(root, 'scripts', 'request-supervised-reload.ps1');
    fs.writeFileSync(scriptPath, '# reload');
    const unit = makeUnit({
      supervisedReloadRequestScriptPath: undefined,
    });
    const result = await unit.status();
    expect(result.snapshot.supervisor.reloadScriptPresent).toBe(true);
    expect(result.snapshot.supervisor.summary).toMatch(/available|present/i);
  });

  it('reports supervised reload missing honestly when script is absent', async () => {
    const unit = makeUnit({
      supervisedReloadRequestScriptPath: path.join(root, 'scripts', 'request-supervised-reload.ps1'),
    });
    const result = await unit.status();
    expect(result.snapshot.supervisor.reloadScriptPresent).toBe(false);
  });

  it('scaffolds launchd plist on darwin (not systemd)', async () => {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'host.js'), '/* host */');
    const spawnSyncImpl = jest.fn(() => ({
      status: 1,
      stdout: '',
      error: undefined,
    })) as unknown as typeof import('node:child_process').spawnSync;

    const unit = makeUnit({
      platform: 'darwin',
      powershellExecutablePath: null,
      spawnSyncImpl,
    });
    const result = await unit.install({ ensureBinary: false, osService: true });

    expect(result.ok).toBe(true);
    expect(result.snapshot.osService.platform).toBe('darwin');
    expect(result.snapshot.osService.scaffolded).toBe(true);
    expect(result.snapshot.osService.path).toMatch(/com\.zavorth\.host\.plist$/);
    expect(result.snapshot.osService.registered).toBe(false);
    expect(result.snapshot.osService.adminRequired).toBe(false);
    const plist = fs.readFileSync(result.snapshot.osService.path as string, 'utf8');
    expect(plist).toContain('com.zavorth.host');
    expect(plist).toContain('ProgramArguments');
    expect(plist).not.toContain('[Service]');
    expect(spawnSyncImpl).toHaveBeenCalledWith(
      'launchctl',
      expect.arrayContaining(['list', 'com.zavorth.host']),
      expect.any(Object),
    );
  });

  it('scaffolds systemd unit on linux and reports registered when enabled', async () => {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'host.js'), '/* host */');
    const spawnSyncImpl = jest.fn(() => ({
      status: 0,
      stdout: 'enabled\n',
      error: undefined,
    })) as unknown as typeof import('node:child_process').spawnSync;

    const unit = makeUnit({
      platform: 'linux',
      powershellExecutablePath: null,
      spawnSyncImpl,
    });
    const result = await unit.install({ ensureBinary: false, osService: true });

    expect(result.ok).toBe(true);
    expect(result.snapshot.osService.platform).toBe('linux');
    expect(result.snapshot.osService.scaffolded).toBe(true);
    expect(result.snapshot.osService.path).toMatch(/zavorth-host\.service$/);
    expect(result.snapshot.osService.registered).toBe(true);
    expect(result.snapshot.osService.adminRequired).toBe(true);
    const unitText = fs.readFileSync(result.snapshot.osService.path as string, 'utf8');
    expect(unitText).toContain('[Service]');
    expect(unitText).toContain('ExecStart=');
    expect(spawnSyncImpl).toHaveBeenCalledWith(
      'systemctl',
      expect.arrayContaining(['--user', 'is-enabled', 'zavorth-host.service']),
      expect.any(Object),
    );
    const text = renderHostPresenceText(result.snapshot);
    expect(text).toContain('registered=yes');
  });

  it('reports Windows scheduled task registration honestly when probe succeeds', async () => {
    fs.writeFileSync(path.join(root, 'powershell.exe'), 'pwsh');
    const spawnSyncImpl = jest.fn(() => ({
      status: 0,
      stdout: '',
      error: undefined,
    })) as unknown as typeof import('node:child_process').spawnSync;

    const unit = makeUnit({ spawnSyncImpl });
    const result = await unit.install({ ensureBinary: true, osService: true });

    expect(result.snapshot.osService.scaffolded).toBe(true);
    expect(result.snapshot.osService.registered).toBe(true);
    expect(renderHostPresenceText(result.snapshot)).toContain('registered=yes');
  });

  it('reports bunRequired when binary is missing', async () => {
    const unit = makeUnit({
      resolveBinary: () => null,
      ensureBinary: () => ({ ok: false, path: null, detail: 'skipped' }),
      readGoalLoopHeartbeat: () => null,
      probeGateway: async () => ({ ok: false, summary: 'down' }),
    });
    fs.writeFileSync(path.join(root, 'packages', 'code', 'cli', 'src', 'index.ts'), '// src');
    const result = await unit.status();
    expect(result.snapshot.binary.present).toBe(false);
    expect(result.snapshot.binary.mode).toBe('sources+bun');
    expect(result.snapshot.binary.bunRequired).toBe(true);
    expect(result.snapshot.goalLoop.heartbeatRecorded).toBe(false);
  });

  it('install dry-run does not write state', async () => {
    const unit = makeUnit();
    const result = await unit.install({ dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(fs.existsSync(path.join(stateDir, 'host-presence.json'))).toBe(false);
  });

  it('supervised reload soft-fails without admin/script hard error', () => {
    const unit = makeUnit({
      startSupervisorReload: () => ({ accepted: false, summary: 'script missing soft' }),
      supervisedReloadRequestScriptPath: path.join(root, 'missing.ps1'),
    });
    const result = unit.requestSupervisedReload({
      reason: 'test',
      requestedBy: 'jest',
    });
    expect(result.accepted).toBe(false);
    expect(result.summary).toMatch(/soft|missing|present|PowerShell/i);
  });

  it('does not break Windows paths in scheduled task scaffold', async () => {
    fs.writeFileSync(path.join(root, 'powershell.exe'), 'pwsh');
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'host.js'), '/* host */');
    const unit = makeUnit({
      spawnSyncImpl: jest.fn(() => ({
        status: 1,
        error: undefined,
      })) as unknown as typeof import('node:child_process').spawnSync,
    });
    const result = await unit.install({ ensureBinary: false, osService: true });
    const xmlPath = result.snapshot.osService.path as string;
    expect(xmlPath.includes('\\') || path.win32.isAbsolute(xmlPath) || fs.existsSync(xmlPath)).toBe(true);
    const xml = fs.readFileSync(xmlPath, 'utf8');
    expect(xml).toContain('WorkingDirectory');
    expect(xml).toContain('Zavorth HostPresenceUnit');
    const ps1 = path.join(path.dirname(xmlPath), 'register-zavorth-host-task.ps1');
    expect(fs.existsSync(ps1)).toBe(true);
  });
});
