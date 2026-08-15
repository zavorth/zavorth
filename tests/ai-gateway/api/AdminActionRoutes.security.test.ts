import { readFileSync } from 'fs';
import { join , resolve} from 'path';


function readApiRoute(...segments: string[]): string {
  return readFileSync(resolve(__dirname, '../../../src/ai-gateway/app/api', ...segments, 'route.ts'), 'utf8');
}

function expectHandlerAuthBefore(route: string, handler: string, sensitiveCall: string): void {
  const handlerIndex = route.indexOf(`export async function ${handler}`);
  expect(handlerIndex).toBeGreaterThanOrEqual(0);
  const authIndex = route.indexOf('const authError', handlerIndex);
  const sensitiveIndex = route.indexOf(sensitiveCall, handlerIndex);
  expect(authIndex).toBeGreaterThanOrEqual(0);
  expect(sensitiveIndex).toBeGreaterThanOrEqual(0);
  expect(authIndex).toBeLessThan(sensitiveIndex);
}

describe('admin action API route hardening', () => {
  it('requires management auth before terminating the process', () => {
    const shutdownRoute = readApiRoute('shutdown');
    const restartRoute = readApiRoute('restart');

    expect(shutdownRoute).toContain('requireStrictManagementAuth');
    expect(restartRoute).toContain('requireStrictManagementAuth');
    expect(shutdownRoute.indexOf('requireStrictManagementAuth')).toBeLessThan(shutdownRoute.indexOf('process.kill'));
    expect(restartRoute.indexOf('requireStrictManagementAuth')).toBeLessThan(restartRoute.indexOf('process.kill'));
  });

  it('requires management auth before resetting resilience state', () => {
    const route = readApiRoute('resilience', 'reset');

    expect(route).toContain('requireManagementAuth');
    expect(route.indexOf('requireManagementAuth')).toBeLessThan(route.indexOf('getAllCircuitBreakerStatuses'));
  });

  it('requires management auth on local proxy, backup and skill mutation routes', () => {
    const routes = [
      readApiRoute('cli-tools', 'zavorth-bridge-mitm'),
      readApiRoute('cli-tools', 'backups'),
      readApiRoute('db-backups'),
      readApiRoute('skills', 'install'),
    ];

    for (const route of routes) {
      expect(route).toMatch(/require(?:Strict)?ManagementAuth/);
    }

    expect(routes[0].indexOf('requireManagementAuth')).toBeLessThan(routes[0].indexOf('startMitm'));
    expect(routes[1].indexOf('requireManagementAuth')).toBeLessThan(routes[1].indexOf('await restoreBackup'));
    expect(routes[2].indexOf('requireManagementAuth')).toBeLessThan(routes[2].indexOf('await restoreDbBackup'));
    expect(routes[3].indexOf('requireManagementAuth')).toBeLessThan(routes[3].indexOf('skillRegistry.register'));
  });

  it('requires management auth on CLI settings, system prompt and env repair routes', () => {
    const routes = [
      readApiRoute('cli-tools', 'claude-settings'),
      readApiRoute('cli-tools', 'codex-settings'),
      readApiRoute('cli-tools', 'cline-settings'),
      readApiRoute('cli-tools', 'droid-settings'),
      readApiRoute('cli-tools', 'kilo-settings'),
      readApiRoute('settings', 'system-prompt'),
      readApiRoute('system', 'env', 'repair'),
    ];

    for (const route of routes) {
      expect(route).toMatch(/require(?:Strict)?ManagementAuth/);
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[1], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[2], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[3], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[4], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[5], 'GET', 'getSystemPromptConfig');
    expectHandlerAuthBefore(routes[6], 'GET', 'loadSyncHelpers');
  });

  it('requires management auth on dashboard inventory routes that expose local state', () => {
    const routes = [
      readApiRoute('cli-tools', 'external-executor', 'auto-order'),
      readApiRoute('cli-tools', 'runtime', '[toolId]'),
      readApiRoute('cli-tools', 'status'),
      readApiRoute('token-health'),
      readApiRoute('provider-metrics'),
      readApiRoute('providers', 'expiration'),
      readApiRoute('translator', 'history'),
      readApiRoute('storage', 'health'),
      readApiRoute('skills'),
      readApiRoute('evals', '[suiteId]'),
      readApiRoute('analytics', 'diversity'),
      readApiRoute('models', 'catalog'),
      readApiRoute('providers', '[id]', 'models'),
      readApiRoute('telemetry', 'summary'),
      readApiRoute('pricing', 'models'),
    ];
    const externalExecutorSettingsRoute = readFileSync(
      resolve(__dirname, '../../../src/ai-gateway/app/api/cli-tools/_shared/externalExecutorSettingsRoute.ts'),
      'utf8'
    );

    for (const route of [...routes, externalExecutorSettingsRoute]) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'fetch(');
    expectHandlerAuthBefore(routes[1], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[2], 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(routes[3], 'GET', 'getProviderConnections');
    expectHandlerAuthBefore(routes[4], 'GET', 'getDbInstance');
    expectHandlerAuthBefore(routes[5], 'GET', 'getAllExpirations');
    expectHandlerAuthBefore(routes[6], 'GET', 'getTranslationEvents');
    expectHandlerAuthBefore(routes[7], 'GET', 'resolveDataDir');
    expectHandlerAuthBefore(routes[8], 'GET', 'skillRegistry.loadFromDatabase');
    expectHandlerAuthBefore(routes[9], 'GET', 'getSuite');
    expectHandlerAuthBefore(routes[10], 'GET', 'getDiversityReport');
    expectHandlerAuthBefore(routes[11], 'GET', 'getProviderConnections');
    expectHandlerAuthBefore(routes[12], 'GET', 'handleProviderModelsGet');
    expectHandlerAuthBefore(routes[13], 'GET', 'getTelemetrySummary');
    expectHandlerAuthBefore(routes[14], 'GET', 'getAllCustomModels');
    expectHandlerAuthBefore(externalExecutorSettingsRoute, 'GET', 'getCliRuntimeStatus');
    expectHandlerAuthBefore(externalExecutorSettingsRoute, 'POST', 'request.json');
    expectHandlerAuthBefore(externalExecutorSettingsRoute, 'DELETE', 'ensureCliConfigWriteAllowed');
  });

  it('redacts CLI settings responses that can contain API keys or tokens', () => {
    const claudeRoute = readApiRoute('cli-tools', 'claude-settings');
    const droidRoute = readApiRoute('cli-tools', 'droid-settings');

    expect(claudeRoute).toContain('redactSensitiveEnv');
    expect(claudeRoute).toContain('[redacted]');
    expect(droidRoute).toContain('redactDroidSettings');
    expect(droidRoute).toContain('[redacted]');
  });

  it('requires management auth on proxy registry and proxy secret routes', () => {
    const routes = [
      readApiRoute('settings', 'proxy'),
      readApiRoute('settings', 'proxy', 'test'),
      readApiRoute('settings', 'proxies'),
      readApiRoute('settings', 'proxies', 'assignments'),
      readApiRoute('settings', 'proxies', 'bulk-assign'),
      readApiRoute('settings', 'proxies', 'health'),
      readApiRoute('settings', 'proxies', 'migrate'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getProxyConfig');
    expectHandlerAuthBefore(routes[0], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[0], 'DELETE', 'deleteProxyForLevel');
    expectHandlerAuthBefore(routes[1], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[2], 'GET', 'listProxies');
    expectHandlerAuthBefore(routes[2], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[2], 'PATCH', 'request.json');
    expectHandlerAuthBefore(routes[2], 'DELETE', 'deleteProxyById');
    expectHandlerAuthBefore(routes[3], 'GET', 'getProxyAssignments');
    expectHandlerAuthBefore(routes[3], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[4], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[5], 'GET', 'getProxyHealthStats');
    expectHandlerAuthBefore(routes[6], 'POST', 'request.json');
  });

  it('redacts proxy passwords from management API responses', () => {
    const proxyRoute = readApiRoute('settings', 'proxy');

    expect(proxyRoute).toContain('redactProxySecrets');
    expect(proxyRoute).toContain('"[redacted]"');
    expect(proxyRoute.indexOf('redactProxySecrets(result)')).toBeGreaterThanOrEqual(0);
    expect(proxyRoute.indexOf('redactProxySecrets(config)')).toBeGreaterThanOrEqual(0);
  });

  it('requires management auth on backup import/export, cloud sync and local credential import routes', () => {
    const routes = [
      readApiRoute('settings', 'export-json'),
      readApiRoute('settings', 'import-json'),
      readApiRoute('sync', 'cloud'),
      readApiRoute('providers', '[id]', 'codex-auth', 'export'),
      readApiRoute('providers', '[id]', 'codex-auth', 'apply-local'),
      readApiRoute('oauth', 'cursor', 'import'),
      readApiRoute('oauth', 'kiro', 'import'),
      readApiRoute('cli-tools', 'guide-settings', '[toolId]'),
      readApiRoute('cli-tools', 'codex-profiles'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getApiKeys');
    expectHandlerAuthBefore(routes[1], 'POST', 'request.formData');
    expectHandlerAuthBefore(routes[2], 'GET', 'getApiKeys');
    expectHandlerAuthBefore(routes[2], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[3], 'POST', 'buildCodexAuthFile');
    expectHandlerAuthBefore(routes[4], 'POST', 'ensureCliConfigWriteAllowed');
    expectHandlerAuthBefore(routes[5], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[5], 'GET', 'getTokenStorageInstructions');
    expectHandlerAuthBefore(routes[6], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[7], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[8], 'GET', 'ensureProfilesDir');
    expectHandlerAuthBefore(routes[8], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[8], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[8], 'DELETE', 'request.json');
  });

  it('uses strict auth for secret export, key reveal and local execution routes', () => {
    const strictRoutes = [
      readApiRoute('settings', 'export-json'),
      readApiRoute('db-backups', 'export'),
      readApiRoute('keys'),
      readApiRoute('keys', '[id]', 'reveal'),
      readApiRoute('system', 'env', 'repair'),
      readApiRoute('system', 'version'),
      readApiRoute('tunnels', 'cloudflared'),
      readApiRoute('version-manager', 'install'),
      readApiRoute('version-manager', 'start'),
      readApiRoute('version-manager', 'restart'),
      readApiRoute('version-manager', 'stop'),
    ];

    for (const route of strictRoutes) {
      expect(route).toContain('requireStrictManagementAuth');
    }
  });

  it('redacts secrets from portable settings backups', () => {
    const route = readApiRoute('settings', 'export-json');
    const adapter = readFileSync(
      resolve(__dirname, '../../../src/ai-gateway/lib/db/jsonBackupAdapters.ts'),
      'utf8'
    );

    expect(route).toContain('redactZavorthSettingsBackupSecrets');
    expect(adapter).toContain('redactZavorthSettingsBackupSecrets');
    expect(adapter).toContain('accessToken');
    expect(adapter).toContain('apiKey');
    expect(adapter).toContain('[redacted]');
  });

  it('requires management auth before provider credential mutation and validation', () => {
    const routes = [
      readApiRoute('providers'),
      readApiRoute('providers', '[id]'),
      readApiRoute('providers', 'validate'),
      readApiRoute('providers', '[id]', 'refresh'),
      readApiRoute('providers', '[id]', 'test'),
      readApiRoute('providers', 'test-batch'),
      readApiRoute('providers', 'client'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getProviderConnections');
    expectHandlerAuthBefore(routes[0], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[1], 'GET', 'getProviderConnectionById');
    expectHandlerAuthBefore(routes[1], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[1], 'DELETE', 'getProviderConnectionById');
    expectHandlerAuthBefore(routes[2], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[3], 'POST', 'getProviderConnectionById');
    expectHandlerAuthBefore(routes[4], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[5], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[6], 'GET', 'getProviderConnections');
  });

  it('requires management auth before local OAuth token extraction and social exchange', () => {
    const routes = [
      readApiRoute('oauth', 'cursor', 'auto-import'),
      readApiRoute('oauth', 'kiro', 'auto-import'),
      readApiRoute('oauth', 'kiro', 'social-authorize'),
      readApiRoute('oauth', 'kiro', 'social-exchange'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'new Database');
    expectHandlerAuthBefore(routes[1], 'GET', 'readdir');
    expectHandlerAuthBefore(routes[2], 'GET', 'generatePKCE');
    expectHandlerAuthBefore(routes[3], 'POST', 'request.json');
  });

  it('requires management auth and callback CSRF checks on dynamic OAuth routes', () => {
    const route = readApiRoute('oauth', '[provider]', '[action]');

    expect(route).toContain('requireManagementAuth');
    expect(route).toContain('normalizeOAuthRedirectUri');
    expect(route).toContain('invalid_state');
    expect(route).toContain('state: authData.state');

    expectHandlerAuthBefore(route, 'GET', 'generateAuthData');
    expectHandlerAuthBefore(route, 'POST', 'request.json');
    expect(route.indexOf('normalizeOAuthRedirectUri(redirectUri, request)')).toBeLessThan(
      route.indexOf('exchangeTokens(provider, code')
    );
    expect(route.indexOf('!safeEqual(params.state, state)')).toBeLessThan(
      route.indexOf('exchangeTokens(provider, params.code')
    );
  });

  it('requires management auth on operational settings routes', () => {
    const routes = [
      readApiRoute('settings'),
      readApiRoute('settings', 'auto-disable-accounts'),
      readApiRoute('settings', 'background-degradation'),
      readApiRoute('settings', 'cache-config'),
      readApiRoute('settings', 'cache-metrics'),
      readApiRoute('settings', 'codex-service-tier'),
      readApiRoute('settings', 'combo-defaults'),
      readApiRoute('settings', 'memory'),
      readApiRoute('settings', 'models-dev'),
      readApiRoute('settings', 'purge-logs'),
      readApiRoute('settings', 'task-routing'),
      readApiRoute('settings', 'thinking-budget'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[0], 'PATCH', 'request.json');
    expectHandlerAuthBefore(routes[1], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[1], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[2], 'GET', 'getBackgroundDegradationConfig');
    expectHandlerAuthBefore(routes[2], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[2], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[3], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[3], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[4], 'GET', 'getCacheMetrics');
    expectHandlerAuthBefore(routes[4], 'DELETE', 'resetCacheMetrics');
    expectHandlerAuthBefore(routes[5], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[5], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[6], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[6], 'PATCH', 'request.json');
    expectHandlerAuthBefore(routes[7], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[7], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[8], 'GET', 'getSyncStatus');
    expectHandlerAuthBefore(routes[8], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[9], 'POST', 'getDbInstance');
    expectHandlerAuthBefore(routes[10], 'GET', 'getTaskRoutingConfig');
    expectHandlerAuthBefore(routes[10], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[10], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[11], 'GET', 'getThinkingBudgetConfig');
    expectHandlerAuthBefore(routes[11], 'PUT', 'request.json');
  });

  it('requires management auth on webhook, cache, MITM alias and custom agent admin routes', () => {
    const routes = [
      readApiRoute('webhooks'),
      readApiRoute('webhooks', '[id]'),
      readApiRoute('webhooks', '[id]', 'test'),
      readApiRoute('cache'),
      readApiRoute('cache', 'entries'),
      readApiRoute('cache', 'stats'),
      readApiRoute('cli-tools', 'zavorth-bridge-mitm', 'alias'),
      readApiRoute('acp', 'agents'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getWebhooks');
    expectHandlerAuthBefore(routes[0], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[1], 'GET', 'getWebhook');
    expectHandlerAuthBefore(routes[1], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[1], 'DELETE', 'deleteWebhook');
    expectHandlerAuthBefore(routes[2], 'POST', 'deliverWebhook');
    expectHandlerAuthBefore(routes[3], 'GET', 'getCacheStats');
    expectHandlerAuthBefore(routes[3], 'DELETE', 'clearCache');
    expectHandlerAuthBefore(routes[4], 'GET', 'getDbInstance');
    expectHandlerAuthBefore(routes[4], 'DELETE', 'getDbInstance');
    expectHandlerAuthBefore(routes[5], 'GET', 'getPromptCache');
    expectHandlerAuthBefore(routes[5], 'DELETE', 'getPromptCache');
    expectHandlerAuthBefore(routes[6], 'GET', 'getMitmAlias');
    expectHandlerAuthBefore(routes[6], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[7], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[7], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[7], 'DELETE', 'getSettings');
  });

  it('requires management auth on combo, provider node, mapping and memory routes', () => {
    const routes = [
      readApiRoute('combos'),
      readApiRoute('combos', '[id]'),
      readApiRoute('combos', 'metrics'),
      readApiRoute('combos', 'reorder'),
      readApiRoute('combos', 'test'),
      readApiRoute('provider-nodes'),
      readApiRoute('provider-nodes', 'validate'),
      readApiRoute('provider-nodes', '[id]'),
      readApiRoute('model-combo-mappings'),
      readApiRoute('model-combo-mappings', '[id]'),
      readApiRoute('memory'),
      readApiRoute('memory', '[id]'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getCombos');
    expectHandlerAuthBefore(routes[0], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[1], 'GET', 'getComboById');
    expectHandlerAuthBefore(routes[1], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[1], 'DELETE', 'deleteCombo');
    expectHandlerAuthBefore(routes[2], 'GET', 'getAllComboMetrics');
    expectHandlerAuthBefore(routes[2], 'DELETE', 'resetAllComboMetrics');
    expectHandlerAuthBefore(routes[3], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[4], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[5], 'GET', 'getProviderNodes');
    expectHandlerAuthBefore(routes[5], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[6], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[7], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[7], 'DELETE', 'getProviderNodeById');
    expectHandlerAuthBefore(routes[8], 'GET', 'getModelComboMappings');
    expectHandlerAuthBefore(routes[8], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[9], 'GET', 'getModelComboMappingById');
    expectHandlerAuthBefore(routes[9], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[9], 'DELETE', 'deleteModelComboMapping');
    expectHandlerAuthBefore(routes[10], 'GET', 'listMemories');
    expectHandlerAuthBefore(routes[10], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[11], 'GET', 'getMemory');
    expectHandlerAuthBefore(routes[11], 'DELETE', 'deleteMemory');
  });

  it('requires management auth on usage and log export routes', () => {
    const routes = [
      readApiRoute('usage', 'proxy-logs'),
      readApiRoute('usage', 'budget'),
      readApiRoute('usage', 'history'),
      readApiRoute('usage', 'logs'),
      readApiRoute('usage', 'request-logs'),
      readApiRoute('usage', 'provider-limits'),
      readApiRoute('usage', 'analytics'),
      readApiRoute('usage', 'combo-health'),
      readApiRoute('usage', 'quota'),
      readApiRoute('usage', 'utilization'),
      readApiRoute('usage', '[connectionId]'),
      readApiRoute('logs', 'console'),
      readApiRoute('logs', 'export'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'getProxyLogs');
    expectHandlerAuthBefore(routes[0], 'DELETE', 'clearProxyLogs');
    expectHandlerAuthBefore(routes[1], 'GET', 'getCostSummary');
    expectHandlerAuthBefore(routes[1], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[2], 'GET', 'getUsageStats');
    expectHandlerAuthBefore(routes[3], 'GET', 'getRecentLogs');
    expectHandlerAuthBefore(routes[4], 'GET', 'getRecentLogs');
    expectHandlerAuthBefore(routes[5], 'GET', 'getCachedProviderLimitsMap');
    expectHandlerAuthBefore(routes[5], 'POST', 'syncAllProviderLimits');
    expectHandlerAuthBefore(routes[6], 'GET', 'getUsageDb');
    expectHandlerAuthBefore(routes[7], 'GET', 'getCombos');
    expectHandlerAuthBefore(routes[8], 'GET', 'getProviderConnections');
    expectHandlerAuthBefore(routes[9], 'GET', 'getAggregatedSnapshots');
    expectHandlerAuthBefore(routes[10], 'GET', 'fetchAndPersistProviderLimits');
    expectHandlerAuthBefore(routes[11], 'GET', 'readFileSync');
    expectHandlerAuthBefore(routes[12], 'GET', 'getDbInstance');
    expect(routes[12]).toContain('Cache-Control');
    expect(routes[12]).toContain('no-store');
    expect(routes[12]).toContain('X-Content-Type-Options');
  });

  it('requires management auth on gateway-control read and operation routes', () => {
    const routes = [
      readApiRoute('gateway-control'),
      readApiRoute('gateway-control', 'cache'),
      readApiRoute('gateway-control', 'cache', 'invalidate'),
      readApiRoute('gateway-control', 'combos'),
      readApiRoute('gateway-control', 'combos', 'validate'),
      readApiRoute('gateway-control', 'health'),
      readApiRoute('gateway-control', 'models'),
      readApiRoute('gateway-control', 'providers'),
      readApiRoute('gateway-control', 'providers', 'test'),
      readApiRoute('gateway-control', 'rate-limits'),
      readApiRoute('gateway-control', 'rate-limits', 'toggle'),
      readApiRoute('gateway-control', 'resilience'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[1], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[2], 'POST', 'readGatewayControlJsonBody');
    expectHandlerAuthBefore(routes[3], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[4], 'POST', 'readGatewayControlJsonBody');
    expectHandlerAuthBefore(routes[5], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[6], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[7], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[8], 'POST', 'readGatewayControlJsonBody');
    expectHandlerAuthBefore(routes[9], 'GET', 'buildGatewayControlReadPayload');
    expectHandlerAuthBefore(routes[10], 'POST', 'readGatewayControlJsonBody');
    expectHandlerAuthBefore(routes[11], 'GET', 'buildSnapshot');
    expectHandlerAuthBefore(routes[11], 'POST', 'readJsonBody');
    expect(routes[11]).toContain('isUnsafeCrossSiteMutation');
  });

  it('requires management auth on Zavorth Control memory and channel setup routes', () => {
    const memoryRoute = readApiRoute('web', 'zavorthControl', 'memory');
    const channelSetupRoute = readApiRoute('web', 'zavorthControl', 'channels', 'setup');

    expect(memoryRoute).toContain('requireManagementAuth');
    expect(channelSetupRoute).toContain('requireManagementAuth');
    expectHandlerAuthBefore(memoryRoute, 'GET', 'listDashboardMemoryFacts');
    expectHandlerAuthBefore(memoryRoute, 'POST', 'readJsonBody');
    expectHandlerAuthBefore(channelSetupRoute, 'GET', 'buildSession');
    expectHandlerAuthBefore(channelSetupRoute, 'POST', 'readJsonBody');
    expect(memoryRoute).toContain('isUnsafeCrossSiteMutation');
    expect(channelSetupRoute).toContain('isUnsafeCrossSiteMutation');
    expect(channelSetupRoute).toContain('redactChannelSetupPayload');
  });

  it('requires management auth on consolidated operational API/Web/MCP routes', () => {
    const routes = [
      readApiRoute('openapi', 'try'),
      readApiRoute('mcp', 'audit'),
      readApiRoute('mcp', 'audit', 'stats'),
      readApiRoute('mcp', 'sse'),
      readApiRoute('mcp', 'status'),
      readApiRoute('mcp', 'stream'),
      readApiRoute('mcp', 'tools'),
      readApiRoute('fallback', 'chains'),
      readApiRoute('policies'),
      readApiRoute('pricing'),
      readApiRoute('pricing', 'sync'),
      readApiRoute('rate-limit'),
      readApiRoute('rate-limits'),
      readApiRoute('settings', 'ip-filter'),
      readApiRoute('settings', 'model-aliases'),
      readApiRoute('settings', 'require-login'),
      readApiRoute('skills', '[id]'),
      readApiRoute('skills', 'marketplace', 'install'),
      readApiRoute('evals'),
      readApiRoute('developer-workspace'),
      readApiRoute('models', 'availability'),
      readApiRoute('monitoring', 'health'),
      readApiRoute('resilience'),
      readApiRoute('sync', 'initialize'),
      readApiRoute('translator', 'load'),
      readApiRoute('translator', 'save'),
      readApiRoute('db-backups', 'import'),
      readApiRoute('a2a', 'tasks'),
      readApiRoute('a2a', 'tasks', '[id]'),
      readApiRoute('a2a', 'tasks', '[id]', 'cancel'),
      readApiRoute('remote-mesh', 'notebook', 'mcp'),
      readApiRoute('onboarding', 'personalization'),
      readApiRoute('translator', 'detect'),
      readApiRoute('translator', 'send'),
      readApiRoute('translator', 'translate'),
    ];

    for (const route of routes) {
      expect(route).toContain('requireManagementAuth');
    }

    expectHandlerAuthBefore(routes[0], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[1], 'GET', 'queryAuditEntries');
    expectHandlerAuthBefore(routes[2], 'GET', 'getAuditStats');
    expectHandlerAuthBefore(routes[3], 'GET', 'guardEnabled');
    expectHandlerAuthBefore(routes[3], 'POST', 'guardEnabled');
    expectHandlerAuthBefore(routes[4], 'GET', 'readMcpHeartbeat');
    expectHandlerAuthBefore(routes[5], 'POST', 'guardEnabled');
    expectHandlerAuthBefore(routes[5], 'GET', 'guardEnabled');
    expectHandlerAuthBefore(routes[5], 'DELETE', 'guardEnabled');
    expectHandlerAuthBefore(routes[6], 'GET', 'MCP_TOOLS');
    expectHandlerAuthBefore(routes[7], 'GET', 'getAllFallbackChains');
    expectHandlerAuthBefore(routes[7], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[7], 'DELETE', 'request.json');
    expectHandlerAuthBefore(routes[8], 'GET', 'getAllCircuitBreakerStatuses');
    expectHandlerAuthBefore(routes[8], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[9], 'GET', 'getPricing');
    expectHandlerAuthBefore(routes[9], 'PATCH', 'request.json');
    expectHandlerAuthBefore(routes[9], 'DELETE', 'resetAllPricing');
    expectHandlerAuthBefore(routes[10], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[10], 'GET', 'getSyncStatus');
    expectHandlerAuthBefore(routes[10], 'DELETE', 'clearSyncedPricing');
    expectHandlerAuthBefore(routes[11], 'GET', 'new URL');
    expectHandlerAuthBefore(routes[11], 'POST', 'new URL');
    expectHandlerAuthBefore(routes[12], 'GET', 'getProviderConnections');
    expectHandlerAuthBefore(routes[12], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[13], 'GET', 'getIPFilterConfig');
    expectHandlerAuthBefore(routes[13], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[14], 'GET', 'getBuiltInAliases');
    expectHandlerAuthBefore(routes[14], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[14], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[14], 'DELETE', 'request.json');
    expectHandlerAuthBefore(routes[15], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[16], 'DELETE', 'skillRegistry.unregisterById');
    expectHandlerAuthBefore(routes[16], 'PUT', 'request.json');
    expectHandlerAuthBefore(routes[17], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[18], 'GET', 'listSuites');
    expectHandlerAuthBefore(routes[18], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[19], 'GET', 'buildDeveloperWorkspaceReadPayload');
    expectHandlerAuthBefore(routes[19], 'POST', 'buildDeveloperWorkspaceActionPayload');
    expectHandlerAuthBefore(routes[20], 'GET', 'getAvailabilityReport');
    expectHandlerAuthBefore(routes[20], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[21], 'DELETE', 'resetAllCircuitBreakers');
    expectHandlerAuthBefore(routes[22], 'GET', 'getSettings');
    expectHandlerAuthBefore(routes[22], 'PATCH', 'request.json');
    expectHandlerAuthBefore(routes[23], 'POST', 'initializeCloudSync');
    expectHandlerAuthBefore(routes[24], 'GET', 'readFileSync');
    expectHandlerAuthBefore(routes[25], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[26], 'POST', 'request.formData');
    expectHandlerAuthBefore(routes[27], 'GET', 'getTaskManager');
    expectHandlerAuthBefore(routes[28], 'GET', 'getTaskManager');
    expectHandlerAuthBefore(routes[29], 'POST', 'getTaskManager');
    expectHandlerAuthBefore(routes[30], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[31], 'GET', 'createService');
    expectHandlerAuthBefore(routes[31], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[32], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[33], 'POST', 'request.json');
    expectHandlerAuthBefore(routes[34], 'POST', 'request.json');
  });

  it('constrains local proxy-style helper routes to local trusted targets', () => {
    const openApiTryRoute = readApiRoute('openapi', 'try');
    const syncInitializeRoute = readApiRoute('sync', 'initialize');

    expect(openApiTryRoute).toContain('Path must target a local /api route');
    expect(openApiTryRoute).not.toContain('x-forwarded-proto');
    expect(openApiTryRoute).toContain('new URL(path, requestUrl.origin)');
    expect(openApiTryRoute).toContain('delete forwardHeaders.Authorization');
    expect(openApiTryRoute).toContain('delete forwardHeaders.Cookie');

    expect(syncInitializeRoute).not.toContain('request.headers.get("origin")');
    expect(syncInitializeRoute).toContain('resolveZavorthGatewayBaseUrl()');
  });

  it('blocks webhook delivery to private network targets by default', () => {
    const dispatcher = readFileSync(
      resolve(__dirname, '../../../src/ai-gateway/lib/webhookDispatcher.ts'),
      'utf8'
    );
    const egressGuard = readFileSync(
      resolve(__dirname, '../../../src/ai-gateway/lib/security/egressGuard.ts'),
      'utf8'
    );

    expect(dispatcher).toContain('assertWebhookTargetAllowed');
    expect(dispatcher).toContain('ALLOW_PRIVATE_WEBHOOK_TARGETS');
    expect(egressGuard).toContain('URL resolved to a private or loopback address');
    expect(egressGuard).toContain('ALLOW_PRIVATE_EGRESS_TARGETS');
    expect(dispatcher.indexOf('await assertWebhookTargetAllowed(url)')).toBeLessThan(
      dispatcher.indexOf('fetchWebhookWithRedirectGuard(url')
    );
    expect(dispatcher).toContain('redirect: "manual"');
    expect(dispatcher).toContain('new URL(location, rawUrl)');
  });

  it('hardens MITM privileged setup and local HTTPS proxy boundaries', () => {
    const dnsConfig = readFileSync(
      resolve(__dirname, '../../../src/ai-gateway/mitm/dns/dnsConfig.ts'),
      'utf8'
    );
    const certInstall = readFileSync(
      resolve(__dirname, '../../../src/ai-gateway/mitm/cert/install.ts'),
      'utf8'
    );
    const mitmServer = readFileSync(resolve(__dirname, '../../../src/ai-gateway/mitm/server.cjs'), 'utf8');
    const mitmManager = readFileSync(resolve(__dirname, '../../../src/ai-gateway/mitm/manager.ts'), 'utf8');

    expect(dnsConfig).toContain('execFile(');
    expect(dnsConfig).toContain('execElevatedWindowsScript');
    expect(dnsConfig).toContain('EncodedCommand');
    expect(dnsConfig).not.toContain('exec(');
    expect(dnsConfig).not.toContain('sed -i');
    expect(dnsConfig).not.toContain('echo "');

    expect(certInstall).toContain('execFile(');
    expect(certInstall).toContain('execWithPassword(');
    expect(certInstall).toContain('execElevatedWindowsScript');
    expect(certInstall).not.toContain('exec(');

    expect(mitmServer).toContain('ZAVORTH_MITM_MAX_BODY_BYTES');
    expect(mitmServer).toContain('isAllowedMitmHost(req.headers.host)');
    expect(mitmServer).toContain('Misdirected Request');
    expect(mitmServer).toContain('MITM request body too large');
    expect(mitmServer).toContain('413');

    expect(mitmManager).toContain('checkDNSEntry()');
    expect(mitmManager).toContain('redactSensitiveText');
  });
});
