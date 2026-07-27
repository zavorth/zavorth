import { ProviderInvocationService } from '../../src/services/ProviderInvocationService';
import { ProviderRuntimeRouter } from '../../src/services/ProviderRuntimeRouter';
import { ProviderRuntimeClientFactory } from '../../src/services/ProviderRuntimeClientFactory';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger';

jest.mock('../../src/services/ProviderRuntimeRouter');
jest.mock('../../src/services/ProviderRuntimeClientFactory');
jest.mock('../../src/services/SecurityAuditLogger');

describe('ProviderRuntimeAuditAttribution', () => {
  let service: ProviderInvocationService;
  let mockRouter: any;
  let mockFactory: any;
  let mockLogger: any;

  beforeEach(() => {
    service = ProviderInvocationService.getInstance();

    mockRouter = {
      route: jest.fn().mockResolvedValue({
        providerId: 'prov-123',
        providerType: 'openai',
        modelId: 'gpt-4',
      }),
    };
    (ProviderRuntimeRouter.getInstance as jest.Mock).mockReturnValue(mockRouter);

    mockFactory = {
      createInvoker: jest.fn().mockResolvedValue({
        invoke: jest.fn().mockResolvedValue({ text: 'AI Response' }),
      }),
    };
    (ProviderRuntimeClientFactory.getInstance as jest.Mock).mockReturnValue(mockFactory);

    mockLogger = {
      logWorkspaceEvent: jest.fn(),
    };
    (SecurityAuditLogger as jest.Mock).mockImplementation(() => mockLogger);
  });

  it('deve usar o workspaceId correto se fornecido no request', async () => {
    await service.invoke({
      workspaceId: 'my-active-workspace',
      capability: 'chat',
    }, []);

    expect(mockLogger.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'provider_invocation_started',
        workspaceId: 'my-active-workspace',
      })
    );
  });

  it('deve cair no default system se workspaceId not for fornecido no request', async () => {
    // Capturar console.log
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await service.invoke({
      capability: 'chat',
    }, []);

    expect(mockLogger.logWorkspaceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'provider_invocation_started',
        workspaceId: 'system',
      })
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Warning: Fallback to system-level workspaceId')
    );

    logSpy.mockRestore();
  });
});
