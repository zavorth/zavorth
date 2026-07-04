import { ZavorthCloudSandboxPoolService } from '../../src/services/ZavorthCloudSandboxPoolService.js';
import { ZavorthTerminalBackendsService } from '../../src/services/ZavorthTerminalBackendsService.js';

describe('ZavorthCloudSandboxPoolService', () => {
  it('builds an extended governed cloud sandbox pool from terminal backends without executing workloads', () => {
    const terminalBackends = new ZavorthTerminalBackendsService({
      env: {
        VERCEL_TOKEN: 'vercel-secret',
        ZAVORTH_VERCEL_SANDBOX_ENABLED: 'true',
        MODAL_TOKEN_ID: 'modal-id',
        MODAL_TOKEN_SECRET: 'modal-secret',
        DAYTONA_API_KEY: 'daytona-secret',
        ZAVORTH_DAYTONA_WORKSPACE: 'workspace-1',
        ZAVORTH_SSH_HOST: 'worker.internal',
      },
      cwd: 'C:/workspace',
      now: () => new Date('2026-07-02T12:00:00.000Z'),
      probeRunner: () => ({
        status: 0,
        stdout: 'ready',
        stderr: '',
        error: null,
      }),
    });
    const service = new ZavorthCloudSandboxPoolService({
      terminalBackends,
      now: () => new Date('2026-07-02T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({ preferredBackend: 'modal' });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.preferredBackend?.id).toBe('modal');
    expect(snapshot.summary.readyCloudBackends).toBeGreaterThanOrEqual(3);
    expect(snapshot.backends.map((backend) => backend.id)).toEqual(expect.arrayContaining([
      'vercel-sandbox',
      'modal',
      'daytona',
      'ssh',
    ]));
    expect(snapshot.swarmIntegration.configureCommand).toBe('zavorth swarm configure --execution-backend modal --cloud-sandbox on');
    expect(snapshot.safety.noLiveWorkloadDuringPoolBuild).toBe(true);
    expect(snapshot.safety.reusesTerminalBackendPolicy).toBe(true);
    expect(snapshot.receipts.every((receipt) => receipt.rawSecretSerialized === false)).toBe(true);
  });
});
