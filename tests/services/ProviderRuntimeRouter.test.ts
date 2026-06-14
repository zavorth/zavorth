import { ProviderRuntimeRouter } from '../../src/services/ProviderRuntimeRouter.js';
import { ModelSelectionService } from '../../src/services/ModelSelectionService.js';

jest.mock('../../src/services/ModelSelectionService.js', () => {
  return {
    ModelSelectionService: {
      getInstance: jest.fn().mockReturnValue({
        selectProvider: jest.fn()
      })
    }
  };
});

describe('ProviderRuntimeRouter', () => {
  let mockSelectProvider: jest.Mock;

  beforeEach(() => {
    mockSelectProvider = ModelSelectionService.getInstance().selectProvider as jest.Mock;
    jest.clearAllMocks();
  });

  it('should return the resolved runtime if it is ready', async () => {
    const mockResolved = {
      providerId: 'p1',
      runtimeReady: true,
      configured: true
    };
    mockSelectProvider.mockResolvedValue(mockResolved);

    const router = ProviderRuntimeRouter.getInstance();
    const res = await router.route({});
    expect(res).toBe(mockResolved);
  });

  it('should throw missing_key if the resolved provider is not runtimeReady', async () => {
    const mockResolved = {
      providerId: 'p1',
      runtimeReady: false,
      configured: false
    };
    mockSelectProvider.mockResolvedValue(mockResolved);

    const router = ProviderRuntimeRouter.getInstance();
    await expect(router.route({})).rejects.toThrow('missing_key');
  });
});
