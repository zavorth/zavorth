import { ResilientProviderRouter } from './ResilientProviderRouter.js';
import { ILlmProvider, ChatMessage } from '../../src/providers/ILlmProvider.js';

class MockLlmProvider implements ILlmProvider {
  public readonly name: string;
  private readonly behavior: () => any;

  constructor(name: string, behavior: () => any) {
    this.name = name;
    this.behavior = behavior;
  }

  public async chat(): Promise<any> {
    return this.behavior();
  }
}

describe('ResilientProviderRouter', () => {
  it('calls first provider and returns response on success', async () => {
    const mockBehavior = jest.fn().mockResolvedValue({ content: 'success response', toolCalls: [], finishReason: 'stop' });
    const targets = [
      { providerName: 'mock1', apiKey: 'key-1' },
      { providerName: 'mock2', apiKey: 'key-2' },
    ];
    const buildProvider = (t: any) => new MockLlmProvider(t.providerName, mockBehavior);

    const router = new ResilientProviderRouter('resilient-mock', targets, buildProvider);
    const response = await router.chat([]);

    expect(response.content).toBe('success response');
    expect(mockBehavior).toHaveBeenCalledTimes(1);
  });

  it('rotates to next provider if first one throws 429', async () => {
    let callCount = 0;
    const mockBehavior = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const err: any = new Error('Rate limit exceeded');
        err.status = 429;
        throw err;
      }
      return Promise.resolve({ content: 'success on second try', toolCalls: [], finishReason: 'stop' });
    });

    const targets = [
      { providerName: 'mock1', apiKey: 'key-1' },
      { providerName: 'mock2', apiKey: 'key-2' },
    ];
    const buildProvider = (t: any) => new MockLlmProvider(t.providerName, mockBehavior);

    const router = new ResilientProviderRouter('resilient-mock', targets, buildProvider);
    const response = await router.chat([]);

    expect(response.content).toBe('success on second try');
    expect(mockBehavior).toHaveBeenCalledTimes(2);
  });

  it('fails if all providers in the pool throw retryable errors', async () => {
    const mockBehavior = jest.fn().mockImplementation(() => {
      const err: any = new Error('Too many requests');
      err.status = 429;
      throw err;
    });

    const targets = [
      { providerName: 'mock1', apiKey: 'key-1' },
      { providerName: 'mock2', apiKey: 'key-2' },
    ];
    const buildProvider = (t: any) => new MockLlmProvider(t.providerName, mockBehavior);

    const router = new ResilientProviderRouter('resilient-mock', targets, buildProvider);
    await expect(router.chat([])).rejects.toThrow('Too many requests');
    expect(mockBehavior).toHaveBeenCalledTimes(2);
  });

  it('does not retry and immediately throws non-retryable error', async () => {
    const mockBehavior = jest.fn().mockImplementation(() => {
      const err: any = new Error('Validation failed');
      err.status = 400;
      throw err;
    });

    const targets = [
      { providerName: 'mock1', apiKey: 'key-1' },
      { providerName: 'mock2', apiKey: 'key-2' },
    ];
    const buildProvider = (t: any) => new MockLlmProvider(t.providerName, mockBehavior);

    const router = new ResilientProviderRouter('resilient-mock', targets, buildProvider);
    await expect(router.chat([])).rejects.toThrow('Validation failed');
    expect(mockBehavior).toHaveBeenCalledTimes(1);
  });
});
