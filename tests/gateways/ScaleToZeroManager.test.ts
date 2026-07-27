import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ScaleToZeroManager } from '../../src/gateways/ScaleToZeroManager.js';
import type { ChannelGatewayRegistry } from '../../src/gateways/ChannelGatewayRegistry.js';

describe('ScaleToZeroManager', () => {
  let tempDir: string;
  let stateFilePath: string;
  let mockRegistry: jest.Mocked<ChannelGatewayRegistry>;
  let localGateway: any;

  beforeEach(() => {
    jest.useFakeTimers();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scale-tests-'));
    stateFilePath = path.join(tempDir, 'scale-state.json');

    localGateway = {
      id: 'test-gw',
      shutdown: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
    };

    mockRegistry = {
      resolveGateway: jest.fn().mockReturnValue(localGateway),
      listGateways: jest.fn().mockReturnValue([localGateway]),
    } as any;
  });

  afterEach(() => {
    jest.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize with default config and empty states', () => {
    const manager = new ScaleToZeroManager({ stateFilePath });
    expect(manager.getConfig().enabled).toBe(false);
    expect(manager.getStates()).toHaveLength(0);
  });

  it('should allow configuration overrides and persist them', () => {
    const manager = new ScaleToZeroManager({ stateFilePath });
    manager.configure({ enabled: true, defaultIdleTimeoutMs: 1000 });

    expect(manager.getConfig().enabled).toBe(true);
    expect(manager.getConfig().defaultIdleTimeoutMs).toBe(1000);
    expect(fs.existsSync(stateFilePath)).toBe(true);

    // Load from same file to verify persistence
    const manager2 = new ScaleToZeroManager({ stateFilePath });
    expect(manager2.getConfig().enabled).toBe(true);
    expect(manager2.getConfig().defaultIdleTimeoutMs).toBe(1000);
  });

  it('should record activity and track idle/shutdown status', () => {
    const manager = new ScaleToZeroManager({ stateFilePath });
    manager.recordActivity('test-gw');

    const state = manager.getState('test-gw');
    expect(state).not.toBeNull();
    expect(state?.gatewayId).toBe('test-gw');
    expect(state?.isIdle).toBe(false);
    expect(state?.isShutdown).toBe(false);
    expect(state?.lastActivityAt).toBeGreaterThan(0);
  });

  it('should perform shutdown and trigger callbacks', async () => {
    const onShutdown = jest.fn().mockResolvedValue(undefined);
    const manager = new ScaleToZeroManager({
      stateFilePath,
      registry: mockRegistry,
      onShutdown,
    });

    manager.recordActivity('test-gw');
    const result = await manager.shutdown('test-gw');

    expect(result).toBe(true);
    expect(localGateway.shutdown).toHaveBeenCalled();
    expect(onShutdown).toHaveBeenCalledWith('test-gw');
    expect(manager.isShutdown('test-gw')).toBe(true);
    expect(manager.isIdle('test-gw')).toBe(true);
    expect(manager.getEvents().map(e => e.type)).toContain('shutdown');
  });

  it('should perform warmup and trigger callbacks', async () => {
    const onWarmUp = jest.fn().mockResolvedValue(undefined);
    const manager = new ScaleToZeroManager({
      stateFilePath,
      registry: mockRegistry,
      onWarmUp,
    });

    manager.recordActivity('test-gw');
    await manager.shutdown('test-gw');

    const result = await manager.warmUp('test-gw');

    expect(result).toBe(true);
    expect(localGateway.initialize).toHaveBeenCalled();
    expect(onWarmUp).toHaveBeenCalledWith('test-gw');
    expect(manager.isShutdown('test-gw')).toBe(false);
    expect(manager.isIdle('test-gw')).toBe(false);
    expect(manager.getEvents().map(e => e.type)).toContain('warmup');
  });

  it('should detect idle and auto-shutdown during periodic check', async () => {
    const manager = new ScaleToZeroManager({
      stateFilePath,
      registry: mockRegistry,
    });

    manager.configure({ enabled: true, defaultIdleTimeoutMs: 1000, checkIntervalMs: 500 });
    manager.recordActivity('test-gw');
    manager.start();

    // Advance timer past checkInterval and idleTimeout
    jest.advanceTimersByTime(1100);

    // We need to wait for any promises in runCheck to resolve
    await Promise.resolve();

    expect(manager.isIdle('test-gw')).toBe(true);
    expect(manager.isShutdown('test-gw')).toBe(true);
    expect(localGateway.shutdown).toHaveBeenCalled();

    manager.stop();
  });
});
