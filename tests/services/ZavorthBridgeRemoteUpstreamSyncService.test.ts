import { EventEmitter } from 'events';
import { ZavorthBridgeRemoteUpstreamSyncService } from '../../src/services/ZavorthBridgeRemoteUpstreamSyncService';

function createSpawnStub(output = 'vendor ok') {
  return jest.fn(() => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    process.nextTick(() => {
      child.stdout.emit('data', Buffer.from(output));
      child.emit('exit', 0);
    });
    return child;
  });
}

describe('ZavorthBridgeRemoteUpstreamSyncService', () => {
  it('promotes the ZavorthBridge Remote upstream, restarting the sidecar and re-running the doctor', async () => {
    const sidecarService = {
      stop: jest.fn(async () => undefined),
      start: jest.fn(async () => ({
        enabled: true,
        ready: true,
      })),
    };
    const doctorService = {
      run: jest.fn(async () => ({
        readyAfter: true,
        summary: 'Remoto do ZavorthBridge saudavel.',
      })),
      readLastReport: jest.fn(() => null),
    };
    const vendorReleaseIndexService = {
      getEntry: jest.fn(() => ({
        vendorId: 'omni-zavorth-bridge-remote-chat',
        diff: {
          vendorId: 'omni-zavorth-bridge-remote-chat',
          summary: 'Sem drift.',
        },
        licenseDecision: {
          vendorId: 'omni-zavorth-bridge-remote-chat',
          reviewRequired: true,
        },
      })),
      getDiffSummary: jest.fn(() => ({
        vendorId: 'omni-zavorth-bridge-remote-chat',
        summary: 'Sem drift.',
      })),
      getLicenseDecision: jest.fn(() => ({
        vendorId: 'omni-zavorth-bridge-remote-chat',
        reviewRequired: true,
      })),
    };
    const spawn = createSpawnStub('vendor update ok');

    const service = new ZavorthBridgeRemoteUpstreamSyncService({
      sidecarService: sidecarService as any,
      doctorService: doctorService as any,
      vendorReleaseIndexService: vendorReleaseIndexService as any,
      spawn: spawn as any,
    });

    const report = await service.promote({ autoRollback: false });

    expect(sidecarService.stop).toHaveBeenCalledTimes(1);
    expect(sidecarService.start).toHaveBeenCalledTimes(1);
    expect(doctorService.run).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(report).toEqual(expect.objectContaining({
      ok: true,
      action: 'promote',
      status: 'promoted',
      vendorIndex: expect.objectContaining({
        vendorId: 'omni-zavorth-bridge-remote-chat',
      }),
      licenseDecision: expect.objectContaining({
        reviewRequired: true,
      }),
    }));
  });
});
