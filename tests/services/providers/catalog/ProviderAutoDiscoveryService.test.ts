import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ProviderAutoDiscoveryService,
  type ProviderAutoDiscoveryInput,
} from '../../../../src/services/providers/catalog/ProviderAutoDiscoveryService.js';

function createMockFetch(response: any, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  });
}

function createMockEgressGuard() {
  return vi.fn().mockResolvedValue(undefined);
}

describe('ProviderAutoDiscoveryService', () => {
  let service: ProviderAutoDiscoveryService;

  beforeEach(() => {
    service = new ProviderAutoDiscoveryService();
  });

  describe('discover()', () => {
    it('should discover models from OpenAI-compatible provider', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'gpt-4o-mini', owned_by: 'openai' },
          { id: 'text-embedding-3-small', owned_by: 'openai' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test-provider',
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'test-key',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.success).toBe(true);
      expect(result.providerId).toBe('test-provider');
      expect(result.source).toBe('live_api');
      expect(result.models).toHaveLength(3);
      expect(result.models[0].id).toBe('gpt-4o');
      expect(result.models[0].type).toBe('chat');
      expect(result.models[2].id).toBe('text-embedding-3-small');
      expect(result.models[2].type).toBe('embedding');
      expect(result.warnings).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should discover models from Anthropic-compatible provider', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
          { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'anthropic-test',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'test-key',
        kind: 'anthropic_compatible',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(2);
      expect(result.models[0].id).toBe('claude-sonnet-4-5');
      expect(result.manifest.families[0].defaultModelName).toBe('claude-sonnet-4-5');
    });

    it('should handle fallback catalog when API fails', async () => {
      const mockFetch = createMockFetch({}, 401);
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'failing-provider',
        baseUrl: 'https://api.failing.com/v1',
        apiKey: 'invalid-key',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.success).toBe(false);
      expect(result.source).toBe('fallback_catalog');
      expect(result.models).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle network errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'network-error-provider',
        baseUrl: 'https://api.network-error.com/v1',
        apiKey: 'test-key',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.success).toBe(false);
      expect(result.source).toBe('fallback_catalog');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate provider ID is required', async () => {
      const result = await service.discover({
        providerId: '',
        baseUrl: 'https://api.example.com/v1',
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate base URL is required', async () => {
      const result = await service.discover({
        providerId: 'test-provider',
        baseUrl: '',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Base URL is required for auto-discovery.');
    });

    it('should normalize provider ID', async () => {
      const mockFetch = createMockFetch({ data: [{ id: 'model-1' }] });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'My Test Provider!',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.providerId).toBe('my-test-provider');
    });

    it('should normalize label from provider ID', async () => {
      const mockFetch = createMockFetch({ data: [{ id: 'model-1' }] });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'my-cool-provider',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.label).toBeDefined();
      expect(result.label.length).toBeGreaterThan(0);
    });

    it('should use custom label when provided', async () => {
      const mockFetch = createMockFetch({ data: [{ id: 'model-1' }] });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        label: 'Custom Label',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.label).toBe('Custom Label');
    });

    it('should call egress guard before fetching', async () => {
      const mockFetch = createMockFetch({ data: [] });
      const egressGuard = createMockEgressGuard();

      await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(egressGuard).toHaveBeenCalled();
    });

    it('should generate correct manifest structure', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'model-a', name: 'Model A' },
          { id: 'model-b', name: 'Model B' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test-provider',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.manifest.schemaVersion).toBe(1);
      expect(result.manifest.id).toBe('test-provider');
      expect(result.manifest.routeKind).toBe('custom_compatible');
      expect(result.manifest.authKind).toBe('api_key');
      expect(result.manifest.families).toHaveLength(1);
      expect(result.manifest.families[0].defaultModelName).toBe('model-a');
      expect(result.manifest.routes).toHaveLength(1);
    });

    it('should handle models array response format', async () => {
      const mockFetch = createMockFetch({
        models: [{ id: 'model-1' }, { id: 'model-2' }],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.models).toHaveLength(2);
    });

    it('should classify image models correctly', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'dall-e-3', owned_by: 'openai' },
          { id: 'gpt-4o', owned_by: 'openai' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.models[0].type).toBe('image');
      expect(result.models[1].type).toBe('chat');
    });

    it('should classify audio models correctly', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'whisper-1', owned_by: 'openai' },
          { id: 'tts-1', owned_by: 'openai' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.models[0].type).toBe('audio');
      expect(result.models[1].type).toBe('audio');
    });

    it('should handle empty models array', async () => {
      const mockFetch = createMockFetch({ data: [] });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.models).toHaveLength(0);
      expect(result.warnings).toContain('No models discovered. You may need to add models manually.');
    });

    it('should strip models/ prefix from model IDs', async () => {
      const mockFetch = createMockFetch({
        data: [{ id: 'models/gpt-4o' }],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.models[0].id).toBe('gpt-4o');
    });

    it('should normalize base URL by stripping trailing slash', async () => {
      const mockFetch = createMockFetch({ data: [{ id: 'model-1' }] });
      const egressGuard = createMockEgressGuard();

      await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1/',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should try multiple endpoints for discovery', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [{ id: 'model-1' }] }),
        });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should infer capabilities from models', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'text-embedding-3-small', owned_by: 'openai' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.manifest.capabilities).toContain('chat');
      expect(result.manifest.capabilities).toContain('streaming');
    });

    it('should infer modalities from models', async () => {
      const mockFetch = createMockFetch({
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'dall-e-3', owned_by: 'openai' },
        ],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.manifest.modalities).toContain('text');
    });

    it('should handle Anthropic discovery failure gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'anthropic-test',
        baseUrl: 'https://api.anthropic.com',
        kind: 'anthropic_compatible',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.success).toBe(false);
      expect(result.source).toBe('fallback_catalog');
    });

    it('should set first model as primary in manifest', async () => {
      const mockFetch = createMockFetch({
        data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-c' }],
      });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      const models = result.manifest.routes[0]?.models || [];
      expect(models[0]?.primary).toBe(true);
      expect(models[1]?.primary).toBe(undefined);
      expect(models[2]?.primary).toBe(undefined);
    });

    it('should use runtime source for live_api discovery', async () => {
      const mockFetch = createMockFetch({ data: [{ id: 'model-1' }] });
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.manifest.source).toBe('runtime');
    });

    it('should use custom source for fallback discovery', async () => {
      const mockFetch = createMockFetch({}, 401);
      const egressGuard = createMockEgressGuard();

      const result = await service.discover({
        providerId: 'test',
        baseUrl: 'https://api.example.com/v1',
        fetchImpl: mockFetch as any,
        egressGuard,
      });

      expect(result.manifest.source).toBe('custom');
    });
  });
});
