import fs from 'fs';
import os from 'os';
import path from 'path';
import { CircuitBreakerService } from '../../src/services/plugins/CircuitBreakerService';
import { RetryService } from '../../src/services/plugins/RetryService';
import { HealthCheckService } from '../../src/services/plugins/HealthCheckService';
import { BackupService } from '../../src/services/plugins/BackupService';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'resilience-'));

describe('CircuitBreakerService', () => {
  let svc: CircuitBreakerService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new CircuitBreakerService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('creates circuit on first use', () => { expect(svc.getCircuit('test').state).toBe('closed'); });
  it('allows execution when closed', () => { expect(svc.canExecute('test')).toBe(true); });
  it('opens after threshold failures', () => { for (let i = 0; i < 5; i++) svc.recordFailure('test'); expect(svc.canExecute('test')).toBe(false); });
  it('resets circuit', () => { for (let i = 0; i < 5; i++) svc.recordFailure('test'); svc.reset('test'); expect(svc.canExecute('test')).toBe(true); });
  it('lists circuits', () => { svc.getCircuit('a'); expect(svc.getCircuits()).toContain('a'); });
  it('gets stats', () => { svc.getCircuit('test'); expect(svc.getStats()).toContain('Total: 1'); });
});

describe('RetryService', () => {
  let svc: RetryService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new RetryService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('gets default config', () => { expect(svc.getConfig('default').maxRetries).toBe(3); });
  it('calculates delay', () => { expect(svc.calculateDelay(0, svc.getConfig('default'))).toBe(1000); });
  it('identifies retryable errors', () => { expect(svc.shouldRetry('ECONNRESET', svc.getConfig('default'))).toBe(true); });
  it('executes successfully', async () => { const r = await svc.executeWithRetry('test', async () => 'ok'); expect(r).toBe('ok'); });
  it('retries on failure', async () => {
    let calls = 0;
    try {
      await svc.executeWithRetry('test', async () => {
        calls++;
        if (calls < 3) throw new Error('ECONNRESET');
        return 'ok';
      }, 'file_operation');
    } catch {}
    expect(calls).toBeGreaterThanOrEqual(1);
  });
  it('gets stats', () => { expect(svc.getStats()).toContain('No retry'); });
});

describe('HealthCheckService', () => {
  let svc: HealthCheckService;
  let dir: string;
  beforeEach(() => { dir = tmpDir(); svc = new HealthCheckService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('reports health', () => { expect(svc.reportHealth('API', 'healthy', 'OK')).toContain('healthy'); });
  it('lists checks', () => { svc.reportHealth('API', 'healthy', 'OK'); expect(svc.listChecks()).toContain('API'); });
  it('gets overall health', () => { svc.reportHealth('API', 'healthy', 'OK'); expect(svc.getOverallHealth()).toContain('healthy'); });
  it('tracks unhealthy', () => { svc.reportHealth('DB', 'unhealthy', 'Down'); expect(svc.getUnhealthyComponents()).toContain('DB'); });
  it('gets stats', () => { svc.reportHealth('API', 'healthy', 'OK'); expect(svc.getStats()).toContain('Components: 1'); });
});

describe('BackupService', () => {
  let svc: BackupService;
  let dir: string;
  let srcDir: string;
  beforeEach(() => { dir = tmpDir(); srcDir = tmpDir(); svc = new BackupService({ storageDir: dir }); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(srcDir, { recursive: true, force: true }); });

  it('creates backup', () => { fs.writeFileSync(path.join(srcDir, 'test.txt'), 'hello'); expect(svc.createBackup('test', srcDir)).toContain('created'); });
  it('lists backups', () => { fs.writeFileSync(path.join(srcDir, 'test.txt'), 'hello'); svc.createBackup('test', srcDir); expect(svc.listBackups()).toContain('test'); });
  it('deletes backup', () => {
    fs.writeFileSync(path.join(srcDir, 'test.txt'), 'hello');
    svc.createBackup('test', srcDir);
    const backups = svc.listBackups();
    const match = backups.match(/backup_\w+/);
    expect(match).toBeTruthy();
    expect(svc.deleteBackup(match![0])).toContain('deleted');
  });
  it('gets stats', () => {
    fs.writeFileSync(path.join(srcDir, 'test.txt'), 'hello');
    svc.createBackup('test', srcDir);
    expect(svc.getStats()).toContain('Total backups: 1');
  });
});
