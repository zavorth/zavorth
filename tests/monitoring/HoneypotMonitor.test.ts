import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HoneypotMonitor } from '../../src/monitoring/HoneypotMonitor';
import { SecurityLockService } from '../../src/services/SecurityLockService';

jest.setTimeout(20000);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('HoneypotMonitor', () => {
  let tempDir: string;
  let lock: SecurityLockService;
  let alertCallback: jest.Mock;
  let monitor: HoneypotMonitor;
  let honeyPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-honeypot-'));
    lock = new SecurityLockService(tempDir);
    alertCallback = jest.fn().mockResolvedValue(undefined);
    monitor = new HoneypotMonitor(lock, alertCallback, tempDir);
    honeyPath = path.join(tempDir, 'secrets_honey.txt');
  });

  afterEach(() => {
    monitor.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('recreates the decoy after repeated delete events without losing the watch', async () => {
    monitor.start();
    // Espera o self-write window (300ms) passar antes de deletar
    await wait(500);

    fs.rmSync(honeyPath, { force: true });
    await wait(500);
    expect(fs.existsSync(honeyPath)).toBe(true);

    // Espera o self-write window do re-create anterior passar
    await wait(500);
    fs.rmSync(honeyPath, { force: true });
    await wait(500);
    expect(fs.existsSync(honeyPath)).toBe(true);
  });

  it('does NOT trigger alert or lock on startup (self-write suppression)', async () => {
    monitor.start();
    // Espera tempo suficiente para qualquer evento do FS ser processado
    await wait(500);

    expect(alertCallback).not.toHaveBeenCalled();
    expect(lock.isLocked()).toBe(false);
  });

  it('does NOT auto-lock the bot when honeypot file is accessed', async () => {
    monitor.start();
    // Espera o grace period passar
    await wait(2500);

    // Simula um acesso externo escrevendo no arquivo
    fs.writeFileSync(honeyPath, 'external access attempt', 'utf-8');
    await wait(500);

    // O bot NAO deve estar trancado (apenas alerta)
    expect(lock.isLocked()).toBe(false);
  });
});
