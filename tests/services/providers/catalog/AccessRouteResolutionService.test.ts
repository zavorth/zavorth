import { describe, it, expect } from 'vitest';
import {
  createMinimalProviderIntegrationManifest,
} from '../../../../src/services/providers/catalog/ProviderIntegrationManifest.js';
import {
  ProviderIntegrationRegistry,
} from '../../../../src/services/providers/catalog/ProviderIntegrationRegistry.js';
import {
  AccessRouteResolutionService,
} from '../../../../src/services/providers/catalog/AccessRouteResolutionService.js';

describe('AccessRouteResolutionService', () => {
  it('marks an official configured route as ready without exposing the secret value', () => {
    const service = new AccessRouteResolutionService();

    const result = service.resolveRoutes({
      generatedAt: '2026-05-03T12:00:00.000Z',
      includeAdvanced: true,
      credentials: {
        OPENAI_API_KEY: 'test-openai-key',
      },
    });

    const openai = result.routes.find((route) => route.id === 'openai');

    expect(openai).toEqual(expect.objectContaining({
      routeKind: 'official',
      routeClass: 'official',
      credentialRefs: ['OPENAI_API_KEY'],
      authConfigured: true,
      readiness: 'ready',
      readinessCode: 'ready',
      ready: true,
      issue: null,
    }));
    expect(JSON.stringify(openai)).not.toContain('test-openai-key');
  });

  it('marks a custom-compatible route with API key and base URL as ready', () => {
    const registry = new ProviderIntegrationRegistry([
      createMinimalProviderIntegrationManifest({
        id: 'acme-ai',
        label: 'Acme AI',
        vendorId: 'acme',
        aliases: ['acme', 'openai-compatible-acme'],
        routeKind: 'custom_compatible',
        authKind: 'api_key',
        credentialRefs: ['ACME_API_KEY', 'ACME_BASE_URL'],
      }),
    ]);
    const service = new AccessRouteResolutionService({ registry });

    const result = service.resolveRoutes({
      generatedAt: '2026-05-03T12:00:00.000Z',
      includeAdvanced: true,
      credentials: {
        ACME_API_KEY: 'test-acme-key',
      },
      baseUrls: {
        ACME_BASE_URL: 'https://acme.example/v1',
      },
    });

    expect(result.routes[0]).toEqual(expect.objectContaining({
      id: 'acme-ai',
      routeKind: 'custom_compatible',
      routeClass: 'custom_compatible',
      baseUrlRef: 'ACME_BASE_URL',
      baseUrlConfigured: true,
      readinessCode: 'ready',
      ready: true,
    }));
  });

  it('keeps auth and base URL blockers explicit instead of returning unknown', () => {
    const service = new AccessRouteResolutionService();

    const result = service.resolveRoutes({
      generatedAt: '2026-05-03T12:00:00.000Z',
      includeAdvanced: true,
    });

    const openai = result.routes.find((route) => route.id === 'openai');
    const custom = result.routes.find((route) => route.id === 'custom-openai-compatible');

    expect(openai).toEqual(expect.objectContaining({
      readiness: 'needs_config',
      readinessCode: 'missing_auth',
      issue: expect.stringContaining('OPENAI_API_KEY'),
    }));
    expect(custom).toEqual(expect.objectContaining({
      readiness: 'needs_config',
      readinessCode: 'missing_base_url',
      issue: expect.stringContaining('CUSTOM_OPENAI_COMPATIBLE_BASE_URL'),
    }));
  });

  it('uses health when present for governed local gateway routes', () => {
    const service = new AccessRouteResolutionService();

    const result = service.resolveRoutes({
      generatedAt: '2026-05-03T12:00:00.000Z',
      includeAdvanced: true,
      baseUrls: {
        AIGateway_BASE_URL: 'http://127.0.0.1:21128/v1',
      },
      health: {
        AIGateway: {
          ready: false,
          message: 'Gateway offline',
          checkedAt: '2026-05-03T12:00:00.000Z',
        },
      },
      requireProbeForRouteIds: ['AIGateway'],
    });

    const gateway = result.routes.find((route) => route.id === 'AIGateway');

    expect(gateway).toEqual(expect.objectContaining({
      routeKind: 'custom_compatible',
      routeClass: 'gateway',
      readiness: 'needs_probe',
      readinessCode: 'unhealthy',
      ready: false,
      health: expect.objectContaining({
        status: 'unhealthy',
        message: 'Gateway offline',
      }),
    }));
  });
});
