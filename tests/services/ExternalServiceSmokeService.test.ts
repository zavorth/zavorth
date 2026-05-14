import { config } from '../../src/config/index';
import { ExternalServiceSmokeService } from '../../src/services/ExternalServiceSmokeService';

describe('ExternalServiceSmokeService', () => {
  const originalAIGatewayEnabled = config.AIGatewaySidecarEnabled;
  const originalZavorthBridgeEnabled = config.ZavorthTerminalSidecarEnabled;

  afterEach(() => {
    config.AIGatewaySidecarEnabled = originalAIGatewayEnabled;
    config.ZavorthTerminalSidecarEnabled = originalZavorthBridgeEnabled;
    jest.restoreAllMocks();
  });

  it('runs the AIGateway smoke probe when the runtime is supervised and the sidecar is ready', async () => {
    config.AIGatewaySidecarEnabled = true;

    const fetchImpl = jest.fn().mockResolvedValue({ status: 200 });
    const service = new ExternalServiceSmokeService({
      fetchImpl: fetchImpl as any,
      sidecarStatusService: {
        readSummary: jest.fn().mockReturnValue({
          AIGateway: {
            ready: true,
            baseUrl: 'http://127.0.0.1:3210',
            message: 'ok',
          },
          ZavorthTerminal: {
            ready: false,
            baseUrl: null,
            message: 'skip',
          },
        }),
      } as any,
      zavorthBridgeRemoteDoctorService: {
        run: jest.fn(),
      } as any,
    });

    const steps = await service.run({
      targetFile: 'src/index.ts',
      supervisedRuntime: true,
      domains: ['telegram'],
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]?.label).toBe('AIGateway-smoke');
    expect(steps[0]?.status).toBe('passed');
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3210/models', { method: 'GET' });
  });

  it('fails the ZavorthBridge remote smoke when the doctor still reports the runtime as unhealthy', async () => {
    config.ZavorthTerminalSidecarEnabled = true;

    const zavorthBridgeRemoteDoctorService = {
      run: jest.fn().mockResolvedValue({
        readyAfter: false,
        summary: 'Remote ainda nao esta pronto.',
        remainingRecommendations: ['Abrir a sessao remota.'],
      }),
    };
    const service = new ExternalServiceSmokeService({
      sidecarStatusService: {
        readSummary: jest.fn(),
      } as any,
      zavorthBridgeRemoteDoctorService: zavorthBridgeRemoteDoctorService as any,
    });

    const steps = await service.run({
      targetFile: 'src/services/zavorth-bridge-remote-runtime.ts',
      supervisedRuntime: true,
      domains: [],
    });

    expect(steps).toHaveLength(1);
    expect(steps[0]?.label).toBe('zavorth-bridge-remote-smoke');
    expect(steps[0]?.status).toBe('failed');
    expect(steps[0]?.output).toContain('pendencias');
    expect(zavorthBridgeRemoteDoctorService.run).toHaveBeenCalledWith(false, false);
  });
});
