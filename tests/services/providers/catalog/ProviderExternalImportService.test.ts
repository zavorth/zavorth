import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderExternalImportService } from '../../../../src/services/providers/catalog/ProviderExternalImportService.js';

describe('ProviderExternalImportService', () => {
  let service: ProviderExternalImportService;

  beforeEach(() => {
    service = new ProviderExternalImportService();
  });

  describe('import()', () => {
    it('should import JSON config with single provider', async () => {
      const input = {
        source: JSON.stringify({
          id: 'test-provider',
          baseUrl: 'https://api.test.com/v1',
          apiKey: 'test-key',
          models: [{ id: 'model-1' }, { id: 'model-2' }],
        }),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].id).toBe('test-provider');
      expect(result.providers[0].models).toHaveLength(2);
    });

    it('should import JSON config with multiple providers', async () => {
      const input = {
        source: JSON.stringify([
          { id: 'provider-1', baseUrl: 'https://api1.com/v1' },
          { id: 'provider-2', baseUrl: 'https://api2.com/v1' },
        ]),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(2);
    });

    it('should import providers from nested JSON structure', async () => {
      const input = {
        source: JSON.stringify({
          providers: [
            { id: 'provider-1' },
            { id: 'provider-2' },
          ],
        }),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.success).toBe(true);
      expect(result.providers).toHaveLength(2);
    });

    it('should import env config', async () => {
      const input = {
        source: 'OPENAI_API_KEY=sk-test\nOPENAI_BASE_URL=https://api.openai.com/v1\nGROQ_API_KEY=gsk-test',
        format: 'env' as const,
      };

      const result = await service.import(input);
      expect(result.providers.length).toBeGreaterThan(0);
    });

    it('should generate valid manifests', async () => {
      const input = {
        source: JSON.stringify({
          id: 'test-provider',
          models: [{ id: 'model-1' }],
        }),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.manifests).toHaveLength(1);
      expect(result.manifests[0].schemaVersion).toBe(1);
      expect(result.manifests[0].id).toBe('test-provider');
      expect(result.manifests[0].routeKind).toBe('custom_compatible');
    });

    it('should sanitize provider IDs', async () => {
      const input = {
        source: JSON.stringify({
          id: 'My Provider!',
          models: [],
        }),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.providers[0].id).toBe('my-provider');
    });

    it('should sanitize model IDs', async () => {
      const input = {
        source: JSON.stringify({
          id: 'test',
          models: [{ id: 'model/with/slashes' }],
        }),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.providers[0].models![0].id).toBe('model/with/slashes');
    });

    it('should handle empty source', async () => {
      const input = {
        source: '{}',
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.providers).toBeDefined();
    });

    it('should handle invalid JSON gracefully', async () => {
      const input = {
        source: 'not valid json',
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.providers).toHaveLength(0);
    });

    it('should warn on empty providers', async () => {
      const input = {
        source: JSON.stringify({}),
        format: 'json' as const,
      };

      const result = await service.import(input);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});
