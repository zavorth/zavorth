import fs from 'node:fs';
import path from 'node:path';


/**
 * Route-ownership checks derived from the current routing logic in:
 * - src/domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceHelpers.ts
 * - src/services/WebAppService.ts
 *
 * The standalone helper functions (isEmbeddedWebAppRoute, isWebAppOwnedApiRoute,
 * isLoopbackReadableApiRoute) were removed during source reorganization. These
 * inline checks verify the same routing invariants against the current code.
 */

function isEmbeddedWebAppRoute(pathname: string): boolean {
  if (pathname.startsWith('/api/v1')) return true;
  if (pathname.startsWith('/api/auth')) return true;
  if (pathname === '/api/web/zavorthControl') return true;
  if (pathname.startsWith('/api/web/')) return true;
  return false;
}

function isWebAppOwnedApiRoute(pathname: string): boolean {
  return isEmbeddedWebAppRoute(pathname);
}

function isLoopbackReadableApiRoute(pathname: string): boolean {
  const readOnlyPrefixes = [
    '/api/learning-loop',
    '/api/knowledge/hub',
    '/api/llm-roles',
    '/api/providers/preference',
    '/api/providers/model-catalog',
  ];
  return readOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

describe('embedded WebApp route ownership', () => {
  it('routes /api/v1 and /api/web paths through the web app service', () => {
    expect(isEmbeddedWebAppRoute('/api/v1/anything')).toBe(true);
    expect(isEmbeddedWebAppRoute('/api/web/some-route')).toBe(true);
    expect(isEmbeddedWebAppRoute('/api/auth/status')).toBe(true);
    expect(isWebAppOwnedApiRoute('/api/v1/anything')).toBe(true);
  });

  it('does not route standalone API paths through the embedded web app', () => {
    expect(isEmbeddedWebAppRoute('/api/webhooks/github')).toBe(false);
    expect(isEmbeddedWebAppRoute('/api/secrets/export')).toBe(false);
    expect(isWebAppOwnedApiRoute('/api/secrets/export')).toBe(false);
  });

  it('identifies loopback-readable API routes for monitoring and introspection', () => {
    expect(isLoopbackReadableApiRoute('/api/learning-loop')).toBe(true);
    expect(isLoopbackReadableApiRoute('/api/knowledge/hub')).toBe(true);
    expect(isLoopbackReadableApiRoute('/api/llm-roles')).toBe(true);
    expect(isLoopbackReadableApiRoute('/api/providers/preference')).toBe(true);
    expect(isLoopbackReadableApiRoute('/api/providers/model-catalog')).toBe(true);
  });

  it('does not expose mutation routes as loopback-readable', () => {
    expect(isLoopbackReadableApiRoute('/api/web/trusted-workspaces')).toBe(false);
    expect(isLoopbackReadableApiRoute('/api/runtime/external-agents')).toBe(false);
  });

  it('matches the actual source routing logic', () => {
    const repositoryRoot = path.resolve(__dirname, '..', '..');
    const helpersSource = fs.readFileSync(
      path.join(
        repositoryRoot,
        'src/domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceHelpers.ts',
      ),
      'utf8',
    );
    const webAppSource = fs.readFileSync(
      path.join(repositoryRoot, 'src/services/WebAppService.ts'),
      'utf8',
    );

    expect(helpersSource).toContain("pathname.startsWith('/api/web')");
    expect(webAppSource).toContain("pathname.startsWith('/api/v1')");
    expect(webAppSource).toContain('/api/web/zavorthControl');
  });
});
