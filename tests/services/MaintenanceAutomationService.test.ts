import fs from 'fs';
import os from 'os';
import path from 'path';
import { MaintenanceAutomationService } from '../../src/services/MaintenanceAutomationService';
import { createTestLogRepo } from '../helpers/testLogRepoUtils.js';

describe('MaintenanceAutomationService', () => {
  it('dispatches the recurring maintenance once when the daily window is reached', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-maint-automation-'));
    const stateFile = path.join(tempDir, 'maintenance-automation-state.json');
    const actionService = {
      execute: jest.fn(() => ({
        id: 'scheduled-maintenance',
        logFile: path.join(tempDir, 'scheduled.log'),
        pid: 9012,
      })),
    };
    const logRepo = createTestLogRepo();
    const now = new Date('2026-03-29T04:35:00');

    const service = new MaintenanceAutomationService(
      actionService as any,
      logRepo,
      stateFile,
      4,
      30,
      {
        now: () => new Date(now),
        operationsHealthService: {
          readSnapshot: jest.fn(() => ({
            nodeMeshSmoke: {
              status: 'passed',
              stale: false,
            },
          })),
        } as any,
      },
    );

    service.enable('test', 'Ativada no teste.');
    await (service as any).tick();

    expect(actionService.execute).toHaveBeenCalledTimes(1);
    expect(actionService.execute).toHaveBeenCalledWith('scheduled-maintenance');
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        enabled: true,
        lastActionId: 'scheduled-maintenance',
        lastTriggeredDateKey: '2026-03-29',
        lastTriggerSource: 'automation',
      }),
    );
  });

  it('does not dispatch when disabled and allows manual trigger', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-maint-automation-'));
    const stateFile = path.join(tempDir, 'maintenance-automation-state.json');
    const actionService = {
      execute: jest.fn(() => ({
        id: 'scheduled-maintenance',
        logFile: path.join(tempDir, 'scheduled.log'),
        pid: 9012,
      })),
    };
    const service = new MaintenanceAutomationService(
      actionService as any,
      { log: jest.fn() } as any,
      stateFile,
      4,
      30,
      {
        now: () => new Date('2026-03-29T03:00:00'),
        operationsHealthService: {
          readSnapshot: jest.fn(() => ({
            nodeMeshSmoke: {
              status: 'passed',
              stale: false,
            },
          })),
        } as any,
      },
    );

    service.disable('42', 'Pausado em teste.');
    const status = service.triggerNow('42', 'Disparo manual.');

    expect(actionService.execute).toHaveBeenCalledTimes(1);
    expect(status).toEqual(
      expect.objectContaining({
        enabled: false,
        lastActionId: 'scheduled-maintenance',
        lastTriggerSource: 'manual',
      }),
    );
  });

  it('anticipates the scheduled maintenance when the Node Mesh smoke becomes stale', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-maint-automation-priority-'));
    const stateFile = path.join(tempDir, 'maintenance-automation-state.json');
    const actionService = {
      execute: jest.fn(() => ({
        id: 'validate-node-mesh-smoke',
        logFile: path.join(tempDir, 'node-mesh-smoke.log'),
        pid: 9013,
      })),
    };
    const service = new MaintenanceAutomationService(
      actionService as any,
      { log: jest.fn() } as any,
      stateFile,
      4,
      30,
      {
        now: () => new Date('2026-03-29T03:00:00'),
        operationsHealthService: {
          readSnapshot: jest.fn(() => ({
            nodeMeshSmoke: {
              status: 'passed',
              stale: true,
              checkedAt: '2026-03-28T00:00:00.000Z',
            },
          })),
        } as any,
      },
    );

    service.enable('test', 'Ativada no teste.');
    await (service as any).tick();

    expect(actionService.execute).toHaveBeenCalledTimes(1);
    expect(actionService.execute).toHaveBeenCalledWith('validate-node-mesh-smoke');
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        lastActionId: 'validate-node-mesh-smoke',
        lastTriggerSource: 'priority',
        lastPriorityReason: expect.stringContaining('stale Node Mesh smoke'),
        note: expect.stringContaining('stale Node Mesh smoke'),
      }),
    );
  });

  it('respects the priority cooldown and avoids repeating stale Node Mesh maintenance immediately', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-maint-automation-cooldown-'));
    const stateFile = path.join(tempDir, 'maintenance-automation-state.json');
    const actionService = {
      execute: jest.fn(() => ({
        id: 'validate-node-mesh-smoke',
        logFile: path.join(tempDir, 'node-mesh-smoke.log'),
        pid: 9014,
      })),
    };
    const service = new MaintenanceAutomationService(
      actionService as any,
      { log: jest.fn() } as any,
      stateFile,
      4,
      30,
      {
        now: () => new Date('2026-03-29T03:00:00'),
        priorityCooldownMs: 60 * 60 * 1000,
        operationsHealthService: {
          readSnapshot: jest.fn(() => ({
            nodeMeshSmoke: {
              status: 'failed',
              stale: false,
              error: 'system.run nao retornou o marcador esperado.',
            },
          })),
        } as any,
      },
    );

    service.enable('test', 'Ativada no teste.');
    await (service as any).tick();
    await (service as any).tick();

    expect(actionService.execute).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        lastActionId: 'validate-node-mesh-smoke',
        lastTriggerSource: 'priority',
        lastPriorityReason: expect.stringContaining('failure in real smoke'),
        note: expect.stringContaining('failure in real smoke'),
      }),
    );
  });

  it('anticipates the scheduled maintenance when the native channel doctor becomes stale', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-maint-automation-channel-priority-'));
    const stateFile = path.join(tempDir, 'maintenance-automation-state.json');
    const actionService = {
      execute: jest.fn(() => ({
        id: 'validate-channel-providers',
        logFile: path.join(tempDir, 'channel-provider-doctor.log'),
        pid: 9015,
      })),
    };
    const service = new MaintenanceAutomationService(
      actionService as any,
      { log: jest.fn() } as any,
      stateFile,
      4,
      30,
      {
        now: () => new Date('2026-03-29T03:00:00'),
        operationsHealthService: {
          readSnapshot: jest.fn(() => ({
            nodeMeshSmoke: {
              status: 'passed',
              stale: false,
            },
            channelProviderDoctor: {
              status: 'passed',
              stale: true,
              checkedAt: '2026-03-28T00:00:00.000Z',
              summary: 'Doctor dos canais nativos validou os providers configurados.',
            },
          })),
        } as any,
      },
    );

    service.enable('test', 'Ativada no teste.');
    await (service as any).tick();

    expect(actionService.execute).toHaveBeenCalledTimes(1);
    expect(actionService.execute).toHaveBeenCalledWith('validate-channel-providers');
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        lastActionId: 'validate-channel-providers',
        lastTriggerSource: 'priority',
        lastPriorityReason: expect.stringContaining('stale native channel doctor'),
        note: expect.stringContaining('stale native channel doctor'),
      }),
    );
  });

  it('anticipates the scheduled maintenance when the remote transport doctor becomes stale', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-maint-automation-remote-priority-'));
    const stateFile = path.join(tempDir, 'maintenance-automation-state.json');
    const actionService = {
      execute: jest.fn(() => ({
        id: 'validate-remote-transports',
        logFile: path.join(tempDir, 'remote-transport-doctor.log'),
        pid: 9016,
      })),
    };
    const service = new MaintenanceAutomationService(
      actionService as any,
      { log: jest.fn() } as any,
      stateFile,
      4,
      30,
      {
        now: () => new Date('2026-03-29T03:00:00'),
        operationsHealthService: {
          readSnapshot: jest.fn(() => ({
            nodeMeshSmoke: {
              status: 'passed',
              stale: false,
            },
            channelProviderDoctor: {
              status: 'passed',
              stale: false,
            },
            remoteTransportDoctor: {
              status: 'passed',
              stale: true,
              checkedAt: '2026-03-28T00:00:00.000Z',
              summary: 'Doctor dos transportes remotos validou os fluxos configurados.',
            },
          })),
        } as any,
      },
    );

    service.enable('test', 'Ativada no teste.');
    await (service as any).tick();

    expect(actionService.execute).toHaveBeenCalledTimes(1);
    expect(actionService.execute).toHaveBeenCalledWith('validate-remote-transports');
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        lastActionId: 'validate-remote-transports',
        lastTriggerSource: 'priority',
        lastPriorityReason: expect.stringContaining('stale remote transport doctor'),
        note: expect.stringContaining('stale remote transport doctor'),
      }),
    );
  });
});
