import fs from 'fs';
import os from 'os';
import path from 'path';
import { RealZavorthBridgeWatcher } from '../../src/orchestrator/RealZavorthBridgeWatcher';

function createWatcher() {
  return new RealZavorthBridgeWatcher(
    { log: jest.fn() } as any,
    {
      broadcast: jest.fn().mockResolvedValue(undefined),
      sendToChat: jest.fn().mockResolvedValue(undefined),
    } as any,
    {},
  ) as any;
}

describe('RealZavorthBridgeWatcher hardening', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('does not overlap ticks while a previous reconciliation is still running', async () => {
    const watcher = createWatcher();
    let releaseFirstTick!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirstTick = resolve;
    });
    const calls: string[] = [];
    watcher.reconcileZavorthBridgePermissionState = jest.fn(async () => {
      calls.push('reconcile');
      await firstGate;
    });
    watcher.processPendingResponses = jest.fn(async () => calls.push('responses'));
    watcher.processPendingLogs = jest.fn(async () => calls.push('logs'));
    watcher.processPendingArtifacts = jest.fn(async () => calls.push('artifacts'));
    watcher.processPendingPermissionNotifications = jest.fn(async () => calls.push('permissions'));
    watcher.processVisibleResponses = jest.fn(async () => calls.push('visible'));
    watcher.processPendingDeliveries = jest.fn(async () => calls.push('deliveries'));
    watcher.processStalledSessions = jest.fn(async () => calls.push('stalled'));

    const first = watcher.processTick();
    await Promise.resolve();
    await watcher.processTick();
    releaseFirstTick();
    await first;

    expect(watcher.reconcileZavorthBridgePermissionState).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'reconcile',
      'responses',
      'logs',
      'artifacts',
      'permissions',
      'visible',
      'deliveries',
      'stalled',
    ]);
    expect(watcher.processing).toBe(false);
  });

  it('resets the processing guard after a failed tick so the next tick can recover', async () => {
    const watcher = createWatcher();
    watcher.reconcileZavorthBridgePermissionState = jest
      .fn()
      .mockRejectedValueOnce(new Error('first tick failed'))
      .mockResolvedValueOnce(undefined);
    watcher.processPendingResponses = jest.fn(async () => undefined);
    watcher.processPendingLogs = jest.fn(async () => undefined);
    watcher.processPendingArtifacts = jest.fn(async () => undefined);
    watcher.processPendingPermissionNotifications = jest.fn(async () => undefined);
    watcher.processVisibleResponses = jest.fn(async () => undefined);
    watcher.processPendingDeliveries = jest.fn(async () => undefined);
    watcher.processStalledSessions = jest.fn(async () => undefined);

    await expect(watcher.processTick()).rejects.toThrow('first tick failed');
    await expect(watcher.processTick()).resolves.toBeUndefined();

    expect(watcher.reconcileZavorthBridgePermissionState).toHaveBeenCalledTimes(2);
    expect(watcher.processing).toBe(false);
  });

  it('ignores duplicate start calls and can stop its polling handle', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ag-start-'));
    tempDirs.push(root);
    const watcher = createWatcher();
    watcher.responseDir = path.join(root, 'responses');
    watcher.brainDir = path.join(root, 'brain');
    watcher.logsDir = path.join(root, 'logs');
    watcher.processTick = jest.fn().mockResolvedValue(undefined);

    watcher.start();
    const firstHandle = watcher.pollHandle;
    watcher.start();

    expect(watcher.processTick).toHaveBeenCalledTimes(1);
    expect(watcher.pollHandle).toBe(firstHandle);
    expect(watcher.logRepo.log).toHaveBeenCalledWith(
      'warn',
      'RealZavorthBridgeWatcher',
      expect.stringContaining('duplicate start'),
    );

    watcher.stop();
    expect(watcher.pollHandle).toBeNull();
    expect(watcher.processing).toBe(false);
  });
});
