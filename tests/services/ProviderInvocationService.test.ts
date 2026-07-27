import { ProviderInvocationService } from '../../src/services/ProviderInvocationService.js';
import { ProviderRuntimeRouter } from '../../src/services/ProviderRuntimeRouter.js';
import { ProviderRuntimeClientFactory } from '../../src/services/ProviderRuntimeClientFactory.js';
import { SecurityAuditLogger } from '../../src/services/SecurityAuditLogger.js';

jest.mock('../../src/services/ProviderRuntimeRouter.js', () => {
  return {
    ProviderRuntimeRouter: {
      getInstance: jest.fn().mockReturnValue({
        route: jest.fn()
      })
    }
  };
});

jest.mock('../../src/services/ProviderRuntimeClientFactory.js', () => {
  return {
    ProviderRuntimeClientFactory: {
      getInstance: jest.fn().mockReturnValue({
        createInvoker: jest.fn()
      })
    }
  };
});

describe('ProviderInvocationService', () => {
  let mockRoute: jest.Mock;
  let mockCreateInvoker: jest.Mock;
  let mockInvoke: jest.Mock;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    mockRoute = ProviderRuntimeRouter.getInstance().route as jest.Mock;
    mockCreateInvoker = ProviderRuntimeClientFactory.getInstance().createInvoker as jest.Mock;
    mockInvoke = jest.fn();

    mockCreateInvoker.mockResolvedValue({ invoke: mockInvoke });
    loggerSpy = jest.spyOn(SecurityAuditLogger.prototype, 'logWorkspaceEvent').mockResolvedValue(undefined);
    jest.clearAllMocks();
  });

  afterEach(() => {
    loggerSpy.mockRestore();
  });

  it('invokes successfully and logs start and success without exposing prompt', async () => {
    mockRoute.mockResolvedValue({ providerId: 'p-1', modelId: 'gpt-4', providerType: 'openai' });
    mockInvoke.mockResolvedValue({ text: 'mock text' });

    const service = ProviderInvocationService.getInstance();
    const result = await service.invoke({ providerId: 'p-1' }, [{ content: 'SECRET_PROMPT_DO_NOT_LOG' }]);

    expect(result.text).toBe('mock text');

    expect(loggerSpy).toHaveBeenCalledTimes(2); // start and success

    // Ensure prompt is not leaked in log
    const startCall = loggerSpy.mock.calls[0];
    expect(JSON.stringify(startCall)).not.toContain('SECRET_PROMPT_DO_NOT_LOG');
  });

  it('normalizes error and logs failure without raw provider error leak', async () => {
    mockRoute.mockResolvedValue({ providerId: 'p-1', modelId: 'gpt-4', providerType: 'openai' });
    const mockError = new Error('invalid_key');
    mockInvoke.mockRejectedValue(mockError);

    const service = ProviderInvocationService.getInstance();

    await expect(service.invoke({ providerId: 'p-1' }, [])).rejects.toThrow('invalid_key');

    expect(loggerSpy).toHaveBeenCalledTimes(2); // start and fail

    const failCallArg = loggerSpy.mock.calls[1][0];
    expect(failCallArg.event).toBe('provider_invocation_failed');
    expect(failCallArg.metadata.errorCode).toBe('invalid_key');
    expect(failCallArg.metadata.fallbackUsed).toBe(false);
  });
});
