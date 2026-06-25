import { readFileSync } from 'fs';
import { join } from 'path';

function readGatewayFile(...segments: string[]): string {
  return readFileSync(join(process.cwd(), 'src/zavorth-control', ...segments), 'utf8');
}

function readApiRoute(...segments: string[]): string {
  return readGatewayFile('app/api', ...segments, 'route.ts');
}

describe('auth boundary hardening', () => {
  it('keeps the public API allowlist exact by default', () => {
    const apiAuth = readGatewayFile('shared/utils/apiAuth.ts');

    expect(apiAuth).toContain('PUBLIC_API_EXACT_ROUTES');
    expect(apiAuth).toContain('PUBLIC_API_PREFIX_ROUTES');
    expect(apiAuth).toContain('PUBLIC_API_EXACT_ROUTES.has(normalizedPathname)');
    expect(apiAuth).not.toContain('PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))');
    expect(apiAuth).not.toContain('"/api/oauth/"');
  });

  it('keeps login responses non-cacheable and aligns cookie lifetime with the JWT', () => {
    const loginRoute = readApiRoute('auth', 'login');

    expect(loginRoute).toContain('AUTH_NO_STORE_HEADERS');
    expect(loginRoute).toContain('"Cache-Control": "no-store, max-age=0"');
    expect(loginRoute).toContain('AUTH_SESSION_TTL_SECONDS');
    expect(loginRoute).toContain('maxAge: AUTH_SESSION_TTL_SECONDS');
    expect(loginRoute).toContain('httpOnly: true');
    expect(loginRoute).toContain('sameSite: "lax"');
  });

  it('compares the initial password without a direct equality oracle', () => {
    const loginRoute = readApiRoute('auth', 'login');

    expect(loginRoute).toContain('timingSafeEqual');
    expect(loginRoute).toContain('safePasswordEquals(password, initialPassword)');
    expect(loginRoute).not.toContain('password === initialPassword');
  });

  it('keeps session status and logout responses non-cacheable', () => {
    const statusRoute = readApiRoute('auth', 'status');
    const logoutRoute = readApiRoute('auth', 'logout');

    for (const route of [statusRoute, logoutRoute]) {
      expect(route).toContain('AUTH_NO_STORE_HEADERS');
      expect(route).toContain('"Cache-Control": "no-store, max-age=0"');
      expect(route).toContain('"X-Content-Type-Options": "nosniff"');
    }
  });

  it('expires logout cookies with the same security attributes used for login', () => {
    const logoutRoute = readApiRoute('auth', 'logout');

    expect(logoutRoute).toContain('cookieStore.set("auth_token", ""');
    expect(logoutRoute).toContain('httpOnly: true');
    expect(logoutRoute).toContain('sameSite: "lax"');
    expect(logoutRoute).toContain('maxAge: 0');
    expect(logoutRoute).toContain('shouldUseSecureCookie(request)');
  });

  it('keeps dashboard JWT auto-refresh cookies bounded', () => {
    const proxy = readGatewayFile('proxy.ts');

    expect(proxy).toContain('AUTH_SESSION_TTL_SECONDS');
    expect(proxy).toContain('maxAge: AUTH_SESSION_TTL_SECONDS');
  });

  it('requires strict management auth on sensitive read/export routes', () => {
    const apiAuth = readGatewayFile('shared/utils/apiAuth.ts');
    const requireManagementAuth = readGatewayFile('lib/api/requireManagementAuth.ts');
    const exportAllRoute = readApiRoute('db-backups', 'exportAll');
    const auditRoute = readApiRoute('audit');
    const complianceAuditRoute = readApiRoute('compliance', 'audit-log');
    const sessionsRoute = readApiRoute('sessions');
    const logsExportRoute = readApiRoute('logs', 'export');
    const dbBackupsRoute = readApiRoute('db-backups');
    const providersClientRoute = readApiRoute('providers', 'client');
    const codexAuthExportRoute = readApiRoute('providers', '[id]', 'codex-auth', 'export');

    expect(apiAuth).toContain('isStrictlyAuthenticated');
    expect(requireManagementAuth).toContain('requireStrictManagementAuth');
    for (const route of [
      exportAllRoute,
      auditRoute,
      complianceAuditRoute,
      sessionsRoute,
      logsExportRoute,
      dbBackupsRoute,
      providersClientRoute,
      codexAuthExportRoute,
    ]) {
      expect(route).toContain('requireStrictManagementAuth');
      expect(route).toContain('const authError = await requireStrictManagementAuth');
    }
  });

  it('keeps the public A2A endpoint fail-closed when no external API key is configured', () => {
    const a2aRoute = readGatewayFile('app/a2a/route.ts');
    const a2aReadme = readGatewayFile('lib/a2a/README.md');

    expect(a2aRoute).toContain('configuredA2AApiKey');
    expect(a2aRoute).toContain('ZAVORTH_A2A_API_KEY');
    expect(a2aRoute).toContain('isStrictlyAuthenticated');
    expect(a2aRoute).toContain('isSameOriginDashboardRequest(req) && !(await isAuthRequired())');
    expect(a2aRoute).toContain('ZAVORTH_A2A_ALLOW_UNAUTHENTICATED');
    expect(a2aRoute).toContain('timingSafeEqual');
    expect(a2aRoute).not.toContain('if (!configuredKey) return true');
    expect(a2aRoute).not.toContain('return token === configuredKey');

    expect(a2aRoute.indexOf('if (!(await authenticate(req)))')).toBeLessThan(
      a2aRoute.indexOf('body = await req.json()')
    );
    expect(a2aReadme).toContain('external requests fail closed');
    expect(a2aReadme).not.toContain('authentication is bypassed');
  });

  it('keeps keyless /v1 gateway access restricted to loopback hosts', () => {
    const apiKeyPolicy = readGatewayFile('shared/utils/apiKeyPolicy.ts');
    const modelCatalog = readGatewayFile('app/api/v1/models/catalog.ts');

    expect(apiKeyPolicy).toContain('isLoopbackGatewayRequest');
    expect(apiKeyPolicy).toContain('x-forwarded-host');
    expect(apiKeyPolicy).toContain('Missing API key for non-loopback gateway request');
    expect(apiKeyPolicy).toContain('Invalid API key');
    expect(apiKeyPolicy).toContain('hostCandidates.every((host) => isLoopbackHostname(host))');
    expect(apiKeyPolicy).not.toContain('No API key = local mode, skip policy checks');
    expect(modelCatalog).toContain('enforceApiKeyPolicy(request, null)');
  });

  it('keeps no-login convenience local-only for management routes', () => {
    const apiAuth = readGatewayFile('shared/utils/apiAuth.ts');
    const requireManagementAuth = readGatewayFile('lib/api/requireManagementAuth.ts');
    const proxy = readGatewayFile('proxy.ts');

    expect(apiAuth).toContain('isLoopbackRequest');
    expect(apiAuth).toContain('return isStrictlyAuthenticated(request);');
    expect(requireManagementAuth).not.toContain('isAuthRequired');
    expect(proxy).toContain('!authRequired && isLoopbackRequest(request)');
    expect(proxy).toContain('settings.requireLogin === false && isLoopbackRequest(request)');
  });
});
