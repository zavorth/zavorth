import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { config } from '../src/config/index';
import { ZavorthHost } from '../src/host';

class FakeChild extends EventEmitter {
  public kill = jest.fn();
  public send = jest.fn();
}

function createProcessRef() {
  const processRef = new EventEmitter() as NodeJS.Process & EventEmitter;
  (processRef as any).env = {};
  (processRef as any).pid = process.pid;
  return processRef;
}

describe('ZavorthHost', () => {
  const tempDirs: string[] = [];
  const originalHostAutoRepairStateFile = config.hostAutoRepairStateFile;
  const originalSupervisedAutoRepairRequestScriptPath = config.supervisedAutoRepairRequestScriptPath;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    config.hostAutoRepairStateFile = originalHostAutoRepairStateFile;
    config.supervisedAutoRepairRequestScriptPath = originalSupervisedAutoRepairRequestScriptPath;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('restarts the worker after an unexpected exit', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-'));
    tempDirs.push(root);
    const childA = new FakeChild();
    const childB = new FakeChild();
    const forkImpl = jest.fn().mockReturnValueOnce(childA as any).mockReturnValueOnce(childB as any);
    const processRef = createProcessRef();
    let nowMs = 0;

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
        now: () => nowMs,
      },
    });

    host.start();
    nowMs = 45_000;
    childA.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);

    expect(forkImpl).toHaveBeenCalledTimes(2);
  });

  it('sanitizes duplicate PATH variants before spawning the worker on Windows', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-env-'));
    tempDirs.push(root);
    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const processRef = createProcessRef();
    (processRef as any).env = {
      PATH: 'from-uppercase',
      Path: 'from-canonical',
      ZAVORTH_SAMPLE: 'ok',
    };
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

    Object.defineProperty(process, 'platform', { value: 'win32' });

    try {
      const host = new ZavorthHost({
        workerScript: path.join(root, 'index.js'),
        backupsDir: path.join(root, 'backups'),
        manifestPath: path.join(root, 'backups', 'manifest.json'),
        hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
        runtime: {
          forkImpl: forkImpl as any,
          processRef,
        },
      });

      host.start();
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform);
      }
    }

    const forkOptions = forkImpl.mock.calls[0]?.[2] || {};
    expect(forkOptions.env.Path).toBe('from-canonical');
    expect(forkOptions.env.PATH).toBeUndefined();
    expect(forkOptions.env.ZAVORTH_SAMPLE).toBe('ok');
  });

  it('kills the worker when heartbeats stop arriving', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-'));
    tempDirs.push(root);
    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const processRef = createProcessRef();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
      },
    });

    host.start();
    jest.advanceTimersByTime(60_000 * 3);

    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  });

  it('keeps the worker alive when the web surface still answers during heartbeat recovery', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-heartbeat-web-'));
    tempDirs.push(root);
    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const processRef = createProcessRef();
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const logFn = jest.fn();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      heartbeatIntervalMs: 50,
      heartbeatMissLimit: 3,
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
        fetchImpl: fetchImpl as any,
        logFn,
      },
    });

    host.start();
    child.emit('message', { type: 'boot_success' });
    jest.advanceTimersByTime(150);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();
    expect(
      logFn.mock.calls.some(([message]) =>
        String(message).includes('a superficie web segue saudavel'),
      ),
    ).toBe(true);
  });

  it('extends the boot grace period while the worker reports boot progress', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-boot-progress-'));
    tempDirs.push(root);
    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const processRef = createProcessRef();
    const logFn = jest.fn();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      bootGracePeriodMs: 1_000,
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
        logFn,
      },
    });

    host.start();
    jest.advanceTimersByTime(900);
    child.emit('message', { type: 'boot_progress', stage: 'mcp-runtime' });
    jest.advanceTimersByTime(900);

    expect(child.kill).not.toHaveBeenCalled();

    jest.advanceTimersByTime(150);

    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(
      logFn.mock.calls.some(([message]) =>
        String(message).includes('Worker still booting: mcp-runtime'),
      ),
    ).toBe(true);
  });

  it('kills and restarts only the worker after repeated resource limit breaches', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-'));
    tempDirs.push(root);
    const childA = new FakeChild();
    const childB = new FakeChild();
    const forkImpl = jest.fn().mockReturnValueOnce(childA as any).mockReturnValueOnce(childB as any);
    const processRef = createProcessRef();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      resourceMemoryLimitMb: 100,
      resourceCpuLimitPercent: 50,
      resourceBreachLimit: 2,
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
      },
    });

    host.start();
    childA.emit('message', { type: 'boot_success' });
    childA.emit('message', { type: 'heartbeat', stats: { rssMb: 150, cpuPercent: 10 } });
    childA.emit('message', { type: 'heartbeat', stats: { rssMb: 151, cpuPercent: 10 } });
    childA.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);

    expect(childA.kill).toHaveBeenCalledWith('SIGKILL');
    expect(forkImpl).toHaveBeenCalledTimes(2);
  });

  it('creates a backup and acknowledges the worker before self-modification', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-'));
    tempDirs.push(root);
    const targetFile = path.join(root, 'sample.ts');
    fs.writeFileSync(targetFile, 'console.log("stable");', 'utf8');

    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const processRef = createProcessRef();
    const backupsDir = path.join(root, 'backups');
    const manifestPath = path.join(backupsDir, 'manifest.json');

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir,
      manifestPath,
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
      },
    });

    host.start();
    child.emit('message', { type: 'pre_modify', files: [targetFile] });

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.files).toHaveLength(1);
    expect(fs.existsSync(manifest.files[0].backupPath)).toBe(true);
    expect(child.send).toHaveBeenCalledWith({ type: 'backup_done' });
  });

  it('rolls files back after repeated crashes during the boot grace period', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-'));
    tempDirs.push(root);
    const targetFile = path.join(root, 'sample.ts');
    fs.writeFileSync(targetFile, 'console.log("stable");', 'utf8');
    const autoRepairScriptPath = path.join(root, 'request-supervised-autorepair.ps1');
    const powershellPath = path.join(root, 'powershell.exe');
    fs.writeFileSync(autoRepairScriptPath, '# autorepair handoff', 'utf8');
    fs.writeFileSync(powershellPath, 'fake powershell', 'utf8');

    const childA = new FakeChild();
    const childB = new FakeChild();
    const childC = new FakeChild();
    const childD = new FakeChild();
    const forkImpl = jest
      .fn()
      .mockReturnValueOnce(childA as any)
      .mockReturnValueOnce(childB as any)
      .mockReturnValueOnce(childC as any)
      .mockReturnValueOnce(childD as any);
    const spawnImpl = jest.fn().mockReturnValue({ unref: jest.fn() } as any);
    const processRef = createProcessRef();
    const backupsDir = path.join(root, 'backups');
    const manifestPath = path.join(backupsDir, 'manifest.json');
    const autoRepairStateFilePath = path.join(root, 'runtime', 'host-autorepair-state.json');
    let nowMs = 0;
    config.supervisedAutoRepairRequestScriptPath = autoRepairScriptPath;

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir,
      manifestPath,
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      hostAutoRepairStateFilePath: autoRepairStateFilePath,
      runtime: {
        forkImpl: forkImpl as any,
        spawnImpl: spawnImpl as any,
        processRef,
        now: () => nowMs,
      },
      powershellExecutablePath: powershellPath,
    });

    host.start();
    childA.emit('message', { type: 'pre_modify', files: [targetFile] });
    fs.writeFileSync(targetFile, 'console.log("broken");', 'utf8');

    childA.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);
    childB.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);
    childC.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);

    expect(fs.readFileSync(targetFile, 'utf8')).toContain('stable');
    expect(forkImpl).toHaveBeenCalledTimes(3);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });

  it('does not escalate to rollback when the worker exits due to an existing process lock', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-lock-'));
    tempDirs.push(root);
    const childA = new FakeChild();
    const childB = new FakeChild();
    const childC = new FakeChild();
    const childD = new FakeChild();
    const forkImpl = jest
      .fn()
      .mockReturnValueOnce(childA as any)
      .mockReturnValueOnce(childB as any)
      .mockReturnValueOnce(childC as any)
      .mockReturnValueOnce(childD as any);
    const processRef = createProcessRef();
    const logFn = jest.fn();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      runtime: {
        forkImpl: forkImpl as any,
        processRef,
        logFn,
      },
    });

    host.start();
    childA.emit('exit', 75, null);
    jest.advanceTimersByTime(3_000);
    childB.emit('exit', 75, null);
    jest.advanceTimersByTime(3_000);
    childC.emit('exit', 75, null);
    jest.advanceTimersByTime(3_000);

    expect(forkImpl).toHaveBeenCalledTimes(4);
    const loggedMessages = logFn.mock.calls.map(([message]) => String(message));
    expect(
      loggedMessages.some((message) =>
        message.includes('Worker detected an existing Zavorth process lock. Waiting and retrying without rollback escalation.'),
      ),
    ).toBe(true);
    expect(
      loggedMessages.some((message) => message.includes('Max consecutive crashes reached. Attempting rollback...')),
    ).toBe(false);
  });

  it('exits duplicate host supervisors before spawning a worker', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-dup-'));
    tempDirs.push(root);
    const lockFilePath = path.join(root, 'runtime', 'host.lock.json');
    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const exitImpl = jest.fn();
    const processKillImpl = jest.fn((pid: number) => {
      if (pid !== 2001) {
        const error = Object.assign(new Error('missing pid'), { code: 'ESRCH' });
        throw error;
      }
    });
    const logFn = jest.fn();

    const primary = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups-a'),
      manifestPath: path.join(root, 'backups-a', 'manifest.json'),
      hostLockFilePath: lockFilePath,
      runtime: {
        forkImpl: forkImpl as any,
        processRef: Object.assign(createProcessRef(), { pid: 2001 }),
        processKillImpl,
        logFn,
      },
    });
    primary.start();

    const duplicate = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups-b'),
      manifestPath: path.join(root, 'backups-b', 'manifest.json'),
      hostLockFilePath: lockFilePath,
      runtime: {
        forkImpl: forkImpl as any,
        processRef: Object.assign(createProcessRef(), { pid: 2002 }),
        processKillImpl,
        exitImpl,
        logFn,
      },
    });

    duplicate.start();

    expect(forkImpl).toHaveBeenCalledTimes(1);
    expect(exitImpl).toHaveBeenCalledWith(0);
    expect(
      logFn.mock.calls.some(([message]) =>
        String(message).includes('Another Zavorth host supervisor is already active (PID 2001). Exiting duplicate host.'),
      ),
    ).toBe(true);
  });

  it('hands off to automatic autorepair after a crash loop outside the boot grace period', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-autorepair-loop-'));
    tempDirs.push(root);
    const scriptPath = path.join(root, 'request-supervised-autorepair.ps1');
    const powershellPath = path.join(root, 'powershell.exe');
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, '# autorepair handoff', 'utf8');
    fs.writeFileSync(powershellPath, 'fake powershell', 'utf8');
    config.supervisedAutoRepairRequestScriptPath = scriptPath;

    const childA = new FakeChild();
    const childB = new FakeChild();
    const childC = new FakeChild();
    const forkImpl = jest
      .fn()
      .mockReturnValueOnce(childA as any)
      .mockReturnValueOnce(childB as any)
      .mockReturnValueOnce(childC as any);
    const spawnImpl = jest.fn().mockReturnValue({ unref: jest.fn() } as any);
    const processRef = createProcessRef();
    const logFn = jest.fn();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      hostAutoRepairStateFilePath: path.join(root, 'runtime', 'host-autorepair-state.json'),
      crashLoopWindowMs: 120_000,
      runtime: {
        forkImpl: forkImpl as any,
        spawnImpl: spawnImpl as any,
        processRef,
        logFn,
      },
      powershellExecutablePath: powershellPath,
    });

    host.start();
    childA.emit('message', { type: 'boot_success' });
    childA.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);
    childB.emit('message', { type: 'boot_success' });
    childB.emit('exit', 1, null);
    jest.advanceTimersByTime(3_000);
    childC.emit('message', { type: 'boot_success' });
    childC.emit('exit', 1, null);

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const spawnedArgs = spawnImpl.mock.calls[0]?.[1] || [];
    expect(path.basename(String(spawnedArgs[5] || ''))).toBe('request-supervised-autorepair.ps1');
    expect(spawnedArgs).not.toContain('-AutoRepair');
    expect(spawnedArgs).toContain('-AutoRepairReason');
    expect(
      logFn.mock.calls.some(([message]) =>
        String(message).includes('Crash loop detectado fora do boot grace period'),
      ),
    ).toBe(true);
  });

  it('hands off to automatic autorepair after a boot timeout failure', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-autorepair-boot-'));
    tempDirs.push(root);
    const scriptPath = path.join(root, 'request-supervised-autorepair.ps1');
    const powershellPath = path.join(root, 'powershell.exe');
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.writeFileSync(scriptPath, '# autorepair handoff', 'utf8');
    fs.writeFileSync(powershellPath, 'fake powershell', 'utf8');
    config.supervisedAutoRepairRequestScriptPath = scriptPath;

    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const spawnImpl = jest.fn().mockReturnValue({ unref: jest.fn() } as any);
    const processRef = createProcessRef();
    const logFn = jest.fn();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      hostAutoRepairStateFilePath: path.join(root, 'runtime', 'host-autorepair-state.json'),
      bootGracePeriodMs: 1_000,
      runtime: {
        forkImpl: forkImpl as any,
        spawnImpl: spawnImpl as any,
        processRef,
        logFn,
      },
      powershellExecutablePath: powershellPath,
    });

    host.start();
    jest.advanceTimersByTime(1_000);

    expect(child.kill).toHaveBeenCalledWith('SIGKILL');

    child.emit('exit', 1, null);

    expect(spawnImpl).toHaveBeenCalledTimes(1);
    const spawnedArgs = spawnImpl.mock.calls[0]?.[1] || [];
    expect(path.basename(String(spawnedArgs[5] || ''))).toBe('request-supervised-autorepair.ps1');
    expect(spawnedArgs).toContain('-AutoRepairReason');
    expect(
      logFn.mock.calls.some(([message]) =>
        String(message).includes('Boot failure detected. Attempting rollback before external autorepair handoff...'),
      ),
    ).toBe(true);
  });

  it('honors the autorepair cooldown file before spawning another handoff', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-host-autorepair-cooldown-'));
    tempDirs.push(root);
    const stateFilePath = path.join(root, 'runtime', 'host-autorepair-state.json');
    fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
    fs.writeFileSync(
      stateFilePath,
      JSON.stringify({
        triggeredAt: new Date().toISOString(),
        reason: 'autorepair recente',
      }),
      'utf8',
    );

    const child = new FakeChild();
    const forkImpl = jest.fn().mockReturnValue(child as any);
    const spawnImpl = jest.fn().mockReturnValue({ unref: jest.fn() } as any);
    const processRef = createProcessRef();
    const logFn = jest.fn();

    const host = new ZavorthHost({
      workerScript: path.join(root, 'index.js'),
      backupsDir: path.join(root, 'backups'),
      manifestPath: path.join(root, 'backups', 'manifest.json'),
      hostLockFilePath: path.join(root, 'runtime', 'host.lock.json'),
      hostAutoRepairStateFilePath: stateFilePath,
      autoRepairCooldownMs: 600_000,
      runtime: {
        forkImpl: forkImpl as any,
        spawnImpl: spawnImpl as any,
        processRef,
        logFn,
      },
      powershellExecutablePath: path.join(root, 'powershell.exe'),
    });

    host.start();
    (host as any).pendingBootFailureReason =
      'Failure de boot detectada pelo host supervisor: o worker excedeu o boot grace period sem enviar boot_success.';
    child.emit('exit', 1, null);

    expect(spawnImpl).not.toHaveBeenCalled();
    expect(
      logFn.mock.calls.some(([message]) =>
        String(message).includes('Automatic autorepair is cooling down'),
      ),
    ).toBe(true);
  });
});
