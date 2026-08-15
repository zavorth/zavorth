import path from 'node:path';
import { EventEmitter } from 'node:events';
import { WhatsAppBridgeSupervisorService } from '../../../src/services/WhatsAppBridgeSupervisorService.js';


class FakeChild extends EventEmitter {
  public killed = false;
  public pid = 4242;
  public stdout = new EventEmitter();
  public stderr = new EventEmitter();
  public kill = jest.fn(() => {
    this.killed = true;
    this.emit('exit', 0);
    return true;
  });
}

describe('WhatsAppBridgeSupervisorService', () => {
  it('reports package missing and experimental tier without starting', async () => {
    const service = new WhatsAppBridgeSupervisorService({
      projectRoot: path.join(__dirname, 'does-not-exist-root'),
      existsSync: () => false,
      fetchImpl: (async () => {
        throw new Error('offline');
      }) as typeof fetch,
    });
    const status = await service.status();
    expect(status.tier).toBe('T2');
    expect(status.experimental).toBe(true);
    expect(status.productionClaim).toBe('experimental');
    expect(status.packageReady).toBe(false);
    expect(status.nextStep).toContain('npm install');
  });

  it('starts child process when package and entry exist', async () => {
    const child = new FakeChild();
    const spawned: Array<{ cmd: string; args: string[] }> = [];
    const service = new WhatsAppBridgeSupervisorService({
      projectRoot: __dirname,
      existsSync: (target) => {
        const value = String(target);
        return value.includes('bridge.mjs')
          || value.includes('@whiskeysockets')
          || value.includes('baileys')
          || value.includes('whatsapp-bridge');
      },
      mkdirSync: () => undefined as never,
      writeFileSync: () => undefined,
      spawnImpl: ((cmd: string, args: string[]) => {
        spawned.push({ cmd, args });
        return child as never;
      }) as typeof import('node:child_process').spawn,
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, connection: 'connected', scriptHash: 'abc' }),
      })) as typeof fetch,
    });

    const started = await service.start();
    expect(started.process.running).toBe(true);
    expect(started.process.pid).toBe(4242);
    expect(spawned[0]?.args.some((arg) => arg.includes('bridge.mjs'))).toBe(true);
    expect(started.health.ok).toBe(true);

    const stopped = await service.stop();
    expect(child.kill).toHaveBeenCalled();
    expect(stopped.desired).toBe('stopped');
  });
});
