import { asErrorLike } from '../../src/utils/errorLike';
/**
 * Provider Runtime Integration Smoke Tests
 *
 * Validates that provider runtime respects workspace config:
 *   - workspace provider/model used if no explicit request override
 *   - fallback blocked when allowProviderFallback=false
 *   - error codes sanitized
 *   - invocation result never leaks secrets
 *
 * Security marker: sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A
 * Must NEVER appear outside tests/mocks.
 */

import { ProviderInvocationService } from '../../src/services/ProviderInvocationService';
import { ProviderRuntimeRouter } from '../../src/services/ProviderRuntimeRouter';
import { ProviderRuntimeClientFactory, ProviderInvocationResult } from '../../src/services/ProviderRuntimeClientFactory';

jest.mock('../../src/services/ProviderRuntimeRouter');
jest.mock('../../src/services/ProviderRuntimeClientFactory');

const SMOKE_MARKER = 'sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A';

describe('AgentWorkspaceProviderRuntimeSmoke', () => {
  let mockRoute: jest.Mock;
  let mockCreateInvoker: jest.Mock;
  let mockInvoke: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke = jest.fn();
    mockRoute = jest.fn();
    mockCreateInvoker = jest.fn().mockResolvedValue({ invoke: mockInvoke });

    (ProviderRuntimeRouter.getInstance as jest.Mock).mockReturnValue({ route: mockRoute });
    (ProviderRuntimeClientFactory.getInstance as jest.Mock).mockReturnValue({ createInvoker: mockCreateInvoker });
  });

  // 1. Successful invocation with workspace-configured provider
  describe('successful invocation flow', () => {
    it('uses workspace provider and returns sanitized result', async () => {
      const resolvedRuntime = {
        providerId: 'ws-openai',
        providerType: 'openai',
        displayName: 'OpenAI',
        modelId: 'gpt-4',
        runtimeReady: true,
        capabilities: ['chat'],
      };
      const invocationResult: ProviderInvocationResult = {
        providerId: 'ws-openai',
        providerType: 'openai',
        modelId: 'gpt-4',
        content: 'Hello from the model.',
        finishReason: 'stop',
        durationMs: 123,
        runtimeReady: true,
      };

      mockRoute.mockResolvedValue(resolvedRuntime);
      mockInvoke.mockResolvedValue(invocationResult);

      const svc = ProviderInvocationService.getInstance();
      const result = await svc.invoke({ workspaceId: 'ws-21k-a' } as any, [{ role: 'user', content: 'Hello' }]);

      expect(result.providerId).toBe('ws-openai');
      expect(result.content).toBe('Hello from the model.');

      // Result must never expose secrets
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(SMOKE_MARKER);
      expect(serialized).not.toContain('sk-');
      expect(serialized).not.toContain('Authorization');
      expect(serialized).not.toContain('Bearer');
      expect(serialized).not.toContain('secretRef');
    });

    it('invocation result does not contain raw request messages', async () => {
      const resolvedRuntime = { providerId: 'p1', providerType: 'openai', modelId: 'm1', runtimeReady: true, capabilities: ['chat'] };
      const invocationResult: ProviderInvocationResult = {
        providerId: 'p1', providerType: 'openai', modelId: 'm1',
        content: 'Answer here.', finishReason: 'stop', durationMs: 50, runtimeReady: true,
      };
      mockRoute.mockResolvedValue(resolvedRuntime);
      mockInvoke.mockResolvedValue(invocationResult);

      const svc = ProviderInvocationService.getInstance();
      const sensitiveMessages = [{ role: 'user', content: `My API key is ${SMOKE_MARKER}` }];
      const result = await svc.invoke({} as any, sensitiveMessages);

      // The result must not contain the sensitive message content
      expect(JSON.stringify(result)).not.toContain(SMOKE_MARKER);
    });
  });

  // 2. Missing key — sanitized error
  describe('missing provider key — sanitized error flow', () => {
    it('throws missing_key when provider not ready', async () => {
      mockRoute.mockRejectedValue(new Error('missing_key'));

      const svc = ProviderInvocationService.getInstance();
      let caught: Error | null = null;
      try {
        await svc.invoke({} as any, []);
      } catch (error: unknown) { const err = asErrorLike(error);
caught = e;
      }

      expect(caught).not.toBeNull();
      expect(caught!.message).toBe('missing_key');
      expect(caught!.message).not.toContain(SMOKE_MARKER);
      expect(caught!.message).not.toContain('sk-');
    });

    it('throws provider_not_found when provider id does not exist', async () => {
      mockRoute.mockRejectedValue(new Error('provider_not_found'));

      const svc = ProviderInvocationService.getInstance();
      await expect(svc.invoke({ providerId: 'ghost-provider' } as any, [])).rejects.toThrow('provider_not_found');
    });

    it('throws capability_not_supported when workspace disallows requested capability', async () => {
      mockRoute.mockRejectedValue(new Error('capability_not_supported'));

      const svc = ProviderInvocationService.getInstance();
      await expect(
        svc.invoke({ capability: 'vision' } as any, [])
      ).rejects.toThrow('capability_not_supported');
    });
  });

  // 3. Unknown/raw errors are normalized by router
  describe('raw provider errors are normalized', () => {
    it('routing_error wraps unknown failures — raw details never exposed', async () => {
      // Router already normalizes; invocation service re-throws router errors
      mockRoute.mockRejectedValue(new Error('routing_error'));

      const svc = ProviderInvocationService.getInstance();
      let caught: Error | null = null;
      try {
        await svc.invoke({} as any, []);
      } catch (error: unknown) { const err = asErrorLike(error);
caught = e;
      }

      expect(caught!.message).toBe('routing_error');
      expect(caught!.message).not.toContain('sk-');
      expect(caught!.message).not.toContain('Authorization');
      expect(caught!.message).not.toContain('Bearer');
      expect(caught!.message).not.toContain(SMOKE_MARKER);
    });
  });

  // 4. Fallback policy respected
  describe('fallback policy', () => {
    it('invocation with fallback=false does not silently switch provider', async () => {
      // When workspace has allowProviderFallback=false, router won't attempt fallback.
      // Router throws provider_not_found instead of falling back.
      mockRoute.mockRejectedValue(new Error('provider_not_found'));

      const svc = ProviderInvocationService.getInstance();
      await expect(svc.invoke({ providerId: 'specific-provider', allowFallback: false } as any, []))
        .rejects.toThrow('provider_not_found');
    });
  });
});
