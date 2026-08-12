import { EventEmitter } from 'events';
import { GatewayUpstreamSyncService } from '../../src/services/GatewayUpstreamSyncService';

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

describe('GatewayUpstreamSyncService', () => {
  it('promotes the AIGateway upstream, restarting the sidecar and re-running compatibility', async () => {
    const sidecarService = {
      stop: jest.fn(async () => undefined),
      start: jest.fn(async () => ({
        enabled: true,
        ready: true,
      })),
    };
    const compatibilityDoctorService = {
      run: jest.fn(async () => ({
        ok: true,
        status: 'passed',
        summary: 'Gateway proprio do AIGateway respondeu pelo contrato OpenAI-compatible.',
        error: null,
      })),
      readLastReport: jest.fn(),
    };
    const spawn = createSpawnStub('vendor update ok');
    const vendorReleaseIndexService = {
      getEntry: jest.fn(() => ({
        vendorId: 'AIGateway',
      })),
      getDiffSummary: jest.fn(() => ({
        vendorId: 'AIGateway',
        summary: 'Update disponivel.',
      })),
      getLicenseDecision: jest.fn(() => ({
        vendorId: 'AIGateway',
        reviewRequired: false,
      })),
    };

    const service = new GatewayUpstreamSyncService({
      sidecarService: sidecarService as any,
      compatibilityDoctorService: compatibilityDoctorService as any,
      vendorReleaseIndexService: vendorReleaseIndexService as any,
      spawn: spawn as any,
    });

    const report = await service.promote({ autoRollback: false });

    expect(sidecarService.stop).toHaveBeenCalledTimes(1);
    expect(sidecarService.start).toHaveBeenCalledTimes(1);
    expect(compatibilityDoctorService.run).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(report).toEqual(expect.objectContaining({
      ok: true,
      action: 'promote',
      status: 'promoted',
      rollbackApplied: false,
      vendorIndex: expect.objectContaining({
        vendorId: 'AIGateway',
      }),
    }));
  });
});
