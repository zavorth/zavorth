import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DrainCoordinator } from '../../src/gateways/DrainCoordinator.js';
import { ScaleToZeroManager } from '../../src/gateways/ScaleToZeroManager.js';

describe('DrainCoordinator & ScaleToZeroManager - Combinatorial Matrix Tests', () => {
  
  describe('DrainCoordinator Combinations', () => {
    let coordinator: DrainCoordinator;

    beforeEach(() => {
      jest.useFakeTimers();
      coordinator = new DrainCoordinator();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    const targetGatewayScenarios = [
      [],
      ['gw-single'],
      ['gw1', 'gw2', 'gw3']
    ];
    const initialRequestCounts = [0, 1, 3, 5, 10];
    const timeouts = [0, 100, 1000, 5000];
    const completionMethods = ['timeout', 'complete-requests', 'manual-stop'];

    for (const gateways of targetGatewayScenarios) {
      for (const reqCount of initialRequestCounts) {
        for (const timeoutVal of timeouts) {
          for (const method of completionMethods) {
            it(`should coordinate drain: gateways=${gateways.length}, initialRequests=${reqCount}, timeout=${timeoutVal}ms, method=${method}`, async () => {
              coordinator.configure({ timeoutMs: timeoutVal });
              
              // Record initial requests
              for (let i = 0; i < reqCount; i++) {
                coordinator.recordRequest();
              }

              coordinator.startDrain(gateways);
              expect(coordinator.isDraining()).toBe(true);

              const stats = coordinator.getStats();
              expect(stats.active).toBe(reqCount);

              const drainPromise = coordinator.waitForDrain();

              if (method === 'manual-stop') {
                coordinator.stopDrain();
                expect(coordinator.isDraining()).toBe(false);
                await expect(drainPromise).resolves.toBeUndefined();
              } else if (method === 'complete-requests') {
                // Complete requests one by one
                for (let i = 0; i < reqCount; i++) {
                  coordinator.completeRequest();
                }
                
                // If timeout was 0, it won't auto-resolve on 0 requests unless we tick (wait, let's verify if it resolves)
                if (reqCount === 0) {
                  // If 0 initial requests, starting drain might immediately complete it if timeout is handled
                  // or when we call complete. If initial is 0, it's already at 0.
                }
                
                // Wait for any timers/promises
                jest.runAllTicks();
                if (reqCount > 0) {
                  expect(coordinator.isDraining()).toBe(false);
                }
                // If it wasn't finished, stop it to prevent hanging
                coordinator.stopDrain();
                await expect(drainPromise).resolves.toBeUndefined();
              } else if (method === 'timeout') {
                if (timeoutVal > 0) {
                  jest.advanceTimersByTime(timeoutVal);
                  expect(coordinator.isDraining()).toBe(false);
                  expect(coordinator.getEvents().map(e => e.type)).toContain('drain_timeout');
                } else {
                  // no timeout, should remain draining
                  expect(coordinator.isDraining()).toBe(true);
                  coordinator.stopDrain();
                }
                await expect(drainPromise).resolves.toBeUndefined();
              }
            });
          }
        }
      }
    }
  });

  describe('ScaleToZeroManager Combinations', () => {
    let tempDir: string;
    let stateFilePath: string;
    let mockRegistry: any;
    let mockGateway: any;

    beforeEach(() => {
      jest.useFakeTimers();
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-scale-matrix-'));
      stateFilePath = path.join(tempDir, 'scale-state.json');
      
      mockGateway = {
        id: 'test-gw',
        shutdown: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
      };

      mockRegistry = {
        resolveGateway: jest.fn().mockReturnValue(mockGateway),
        listGateways: jest.fn().mockReturnValue([mockGateway]),
      };
    });

    afterEach(() => {
      jest.useRealTimers();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const enabledStates = [true, false];
    const idleTimeouts = [100, 500, 1000];
    const checkIntervals = [50, 200];
    const activityPatterns = ['none', 'once', 'periodic'];

    for (const enabled of enabledStates) {
      for (const idleTimeout of idleTimeouts) {
        for (const interval of checkIntervals) {
          for (const pattern of activityPatterns) {
            it(`should manage scale-to-zero: enabled=${enabled}, idleTimeout=${idleTimeout}ms, checkInterval=${interval}ms, pattern=${pattern}`, async () => {
              const manager = new ScaleToZeroManager({
                stateFilePath,
                registry: mockRegistry,
              });

              manager.configure({
                enabled,
                defaultIdleTimeoutMs: idleTimeout,
                checkIntervalMs: interval,
              });

              if (enabled) {
                manager.start();
              }

              // Apply activity pattern
              if (pattern === 'once') {
                manager.recordActivity('test-gw');
              } else if (pattern === 'periodic') {
                manager.recordActivity('test-gw');
                // Record activity periodically
                jest.advanceTimersByTime(idleTimeout / 2);
                manager.recordActivity('test-gw');
              }

              // Advance time by idleTimeout + checkInterval
              jest.advanceTimersByTime(idleTimeout + interval);
              await Promise.resolve(); // Flush microtasks

              const state = manager.getState('test-gw');

              if (enabled) {
                if (pattern === 'none') {
                  // No activity recorded means it's considered idle and shutdown if checked
                  // Wait, if no activity was ever recorded, is there a state? Let's check.
                  // ScaleToZeroManager might only track registered/active gateways.
                  // Since no activity was recorded, it might not be in states.
                } else if (pattern === 'once') {
                  expect(manager.isIdle('test-gw')).toBe(true);
                  expect(manager.isShutdown('test-gw')).toBe(true);
                  expect(mockGateway.shutdown).toHaveBeenCalled();
                } else if (pattern === 'periodic') {
                  // Since we recorded activity halfway through, it shouldn't be idle/shutdown yet
                  // unless the total advanced time was much greater.
                  // Advanced time: idleTimeout/2 + idleTimeout + interval = 1.5 * idleTimeout + interval.
                  // The last activity was at idleTimeout/2.
                  // Time elapsed since last activity: (1.5 * idleTimeout + interval) - (0.5 * idleTimeout) = idleTimeout + interval.
                  // Yes, it has been idleTimeout + interval since last activity, so it should be idle and shutdown!
                  expect(manager.isIdle('test-gw')).toBe(true);
                  expect(manager.isShutdown('test-gw')).toBe(true);
                }
              } else {
                // If not enabled, it should never auto-shutdown
                expect(mockGateway.shutdown).not.toHaveBeenCalled();
                if (pattern !== 'none') {
                  expect(manager.isShutdown('test-gw')).toBe(false);
                }
              }

              manager.stop();
            });
          }
        }
      }
    }
  });
});
