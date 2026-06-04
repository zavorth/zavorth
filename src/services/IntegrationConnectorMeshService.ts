import type {
  IntegrationConnectorDoctor,
  IntegrationConnectorExecutePreview,
  IntegrationConnectorId,
  IntegrationConnectorManifest,
  IntegrationConnectorSnapshot,
} from '../contracts/IntegrationConnectorMeshContract.js';

type ConnectorFetch = typeof fetch;

type IntegrationConnectorMeshRuntime = {
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: ConnectorFetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 6000;

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/gu, '');
}

function normalizeHttpUrl(value: string | null | undefined, trimTrailingSlash = false): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    const normalized = url.toString();
    return trimTrailingSlash ? trimSlash(normalized) : normalized;
  } catch {
    return null;
  }
}

function joinUrl(baseUrl: string, suffix: string): string {
  return `${trimSlash(baseUrl)}/${suffix.replace(/^\/+/u, '')}`;
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        /(token|secret|password|pass|api[_-]?key|credential|authorization)/iu.test(key) ? '***' : redactSecrets(entry),
      ]),
    );
  }
  if (typeof value === 'string') {
    return value.replace(/([?&](?:access_token|token|key|secret|code)=)[^&\s]+/giu, '$1[redacted]');
  }
  return value;
}

function baseManifest(input: IntegrationConnectorManifest): IntegrationConnectorManifest {
  return input;
}

export class IntegrationConnectorMeshService {
  private readonly now: () => Date;
  private readonly env: NodeJS.ProcessEnv;
  private readonly fetchImpl: ConnectorFetch;
  private readonly timeoutMs: number;

  constructor(runtime: IntegrationConnectorMeshRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.env = runtime.env || process.env;
    this.fetchImpl = runtime.fetchImpl || fetch;
    this.timeoutMs = Math.max(100, runtime.timeoutMs || DEFAULT_TIMEOUT_MS);
  }

  public listManifests(): IntegrationConnectorManifest[] {
    return [
      baseManifest({
        id: 'composio',
        label: 'Composio',
        summary: 'Agent tool broker for external app actions, toolkits, MCP and connected accounts.',
        docsUrl: 'https://docs.composio.dev/',
        env: {
          apiKey: 'COMPOSIO_API_KEY',
          baseUrl: 'COMPOSIO_BASE_URL',
          executeUrl: null,
        },
        defaultBaseUrl: 'https://backend.composio.dev',
        capabilities: ['agent_tools', 'actions', 'mcp', 'oauth'],
        toolDiscovery: {
          supported: true,
          endpoint: '/api/v3.1/toolkits',
          summary: 'Lists available toolkits through the Composio API.',
        },
        toolExecution: {
          supported: true,
          endpointTemplate: '/api/v3.1/tools/execute/{toolSlug}',
          requiresApproval: true,
        },
      }),
      baseManifest({
        id: 'nango',
        label: 'Nango',
        summary: 'OAuth and integration connection layer for external APIs, proxy, syncs and actions.',
        docsUrl: 'https://nango.dev/docs',
        env: {
          apiKey: 'NANGO_SECRET_KEY',
          baseUrl: 'NANGO_BASE_URL',
          executeUrl: 'NANGO_ACTION_EXECUTE_URL',
        },
        defaultBaseUrl: 'https://api.nango.dev',
        capabilities: ['oauth', 'sync', 'proxy', 'actions'],
        toolDiscovery: {
          supported: true,
          endpoint: '/connections',
          summary: 'Lists configured Nango connections without exposing credentials.',
        },
        toolExecution: {
          supported: true,
          endpointTemplate: null,
          requiresApproval: true,
        },
      }),
      baseManifest({
        id: 'pipedream',
        label: 'Pipedream',
        summary: 'Workflow and API integration broker for event-driven automation.',
        docsUrl: 'https://pipedream.com/docs',
        env: {
          apiKey: 'PIPEDREAM_API_KEY',
          baseUrl: 'PIPEDREAM_BASE_URL',
          healthUrl: 'PIPEDREAM_HEALTH_URL',
          executeUrl: 'PIPEDREAM_EXECUTE_URL',
        },
        defaultBaseUrl: null,
        capabilities: ['workflows', 'actions', 'oauth'],
        toolDiscovery: {
          supported: false,
          endpoint: null,
          summary: 'Use a configured health URL or MCP/server adapter for live discovery.',
        },
        toolExecution: {
          supported: true,
          endpointTemplate: null,
          requiresApproval: true,
        },
      }),
      baseManifest({
        id: 'zapier',
        label: 'Zapier',
        summary: 'Large app-action catalog and automation bridge for non-code workflows.',
        docsUrl: 'https://zapier.com/platform',
        env: {
          apiKey: 'ZAPIER_API_KEY',
          baseUrl: 'ZAPIER_BASE_URL',
          healthUrl: 'ZAPIER_HEALTH_URL',
          executeUrl: 'ZAPIER_EXECUTE_URL',
        },
        defaultBaseUrl: null,
        capabilities: ['actions', 'workflows', 'mcp'],
        toolDiscovery: {
          supported: false,
          endpoint: null,
          summary: 'Use a configured MCP/action endpoint for live discovery.',
        },
        toolExecution: {
          supported: true,
          endpointTemplate: null,
          requiresApproval: true,
        },
      }),
      baseManifest({
        id: 'n8n',
        label: 'n8n',
        summary: 'Self-hostable workflow automation bridge for local and private automations.',
        docsUrl: 'https://docs.n8n.io/',
        env: {
          apiKey: 'N8N_API_KEY',
          baseUrl: 'N8N_BASE_URL',
          healthUrl: 'N8N_HEALTH_URL',
          executeUrl: 'N8N_EXECUTE_URL',
        },
        defaultBaseUrl: null,
        capabilities: ['workflows', 'actions'],
        toolDiscovery: {
          supported: false,
          endpoint: null,
          summary: 'Use N8N_BASE_URL plus N8N_HEALTH_URL for a runtime-specific readiness probe.',
        },
        toolExecution: {
          supported: true,
          endpointTemplate: null,
          requiresApproval: true,
        },
      }),
      baseManifest({
        id: 'workato',
        label: 'Workato',
        summary: 'Enterprise integration and automation broker for governed business workflows.',
        docsUrl: 'https://www.workato.com/',
        env: {
          apiKey: 'WORKATO_API_TOKEN',
          baseUrl: 'WORKATO_BASE_URL',
          healthUrl: 'WORKATO_HEALTH_URL',
          executeUrl: 'WORKATO_EXECUTE_URL',
        },
        defaultBaseUrl: null,
        capabilities: ['workflows', 'actions', 'sync'],
        toolDiscovery: {
          supported: false,
          endpoint: null,
          summary: 'Use a configured health URL or enterprise adapter route for live discovery.',
        },
        toolExecution: {
          supported: true,
          endpointTemplate: null,
          requiresApproval: true,
        },
      }),
    ];
  }

  public getManifest(connectorId: unknown): IntegrationConnectorManifest | null {
    const id = normalizeId(connectorId);
    return this.listManifests().find((manifest) => manifest.id === id) || null;
  }

  public async snapshot(): Promise<IntegrationConnectorSnapshot> {
    const manifests = this.listManifests();
    const doctors = await Promise.all(manifests.map((manifest) => this.doctor(manifest.id)));
    return {
      contractVersion: 'integration-connector-mesh/1',
      generatedAt: this.now().toISOString(),
      manifests,
      doctors,
      summary: {
        total: manifests.length,
        configured: doctors.filter((doctor) => doctor.configured).length,
        ready: doctors.filter((doctor) => doctor.status === 'ready').length,
      },
    };
  }

  public async doctor(connectorId: unknown): Promise<IntegrationConnectorDoctor> {
    const manifest = this.getManifest(connectorId);
    if (!manifest) {
      throw new Error(`Unknown integration connector: ${String(connectorId || '<missing>')}`);
    }

    const apiKey = this.resolveApiKey(manifest);
    const baseUrl = this.resolveBaseUrl(manifest);
    const checkedTarget = this.resolveProbeTarget(manifest, baseUrl);
    const executionTarget = this.resolveConfiguredExecutionTarget(manifest);
    const configured = Boolean((apiKey && baseUrl) || (checkedTarget && (apiKey || this.hasConfiguredHealthUrl(manifest))) || executionTarget);

    if (!configured) {
      return this.doctorSnapshot(manifest, {
        status: 'missing_config',
        configured: false,
        baseUrl,
        checkedTarget,
        httpStatus: null,
        latencyMs: null,
        summary: `${manifest.label} is not configured yet.`,
        nextAction: this.missingConfigHint(manifest),
      });
    }

    if (!checkedTarget) {
      return this.doctorSnapshot(manifest, {
        status: 'unsupported_probe',
        configured: true,
        baseUrl,
        checkedTarget: null,
        httpStatus: null,
        latencyMs: null,
        summary: executionTarget
          ? `${manifest.label} execution endpoint is configured; no non-mutating readiness probe is configured.`
          : `${manifest.label} credentials are present; no standard probe target is configured.`,
        nextAction: manifest.env.healthUrl
          ? `Set ${manifest.env.healthUrl} to enable live readiness.`
          : 'Use a non-mutating health URL to enable live readiness.',
      });
    }

    return this.runHttpProbe(manifest, checkedTarget, apiKey);
  }

  public buildExecutePreview(input: {
    connectorId: unknown;
    toolSlug: unknown;
    input?: Record<string, unknown> | null;
  }): IntegrationConnectorExecutePreview {
    const manifest = this.getManifest(input.connectorId);
    if (!manifest) {
      throw new Error(`Unknown integration connector: ${String(input.connectorId || '<missing>')}`);
    }
    const toolSlug = this.resolveToolSlug(manifest, input.toolSlug);
    if (!manifest.toolExecution.supported) {
      throw new Error(`${manifest.label} does not expose direct tool execution through this Zavorth adapter.`);
    }
    const target = this.resolveExecutionTarget(manifest, toolSlug);
    if (!target) {
      throw new Error(`${manifest.label} needs ${manifest.env.executeUrl || manifest.env.baseUrl || 'an execution URL'} before execution.`);
    }
    return {
      connectorId: manifest.id,
      toolSlug,
      method: 'POST',
      target: this.redactExecutionTarget(manifest, target),
      inputPreview: redactSecrets(input.input || {}) as Record<string, unknown>,
      requiresApproval: true,
      secretsSerialized: false,
    };
  }

  public async executeTool(input: {
    connectorId: unknown;
    toolSlug: unknown;
    input?: Record<string, unknown> | null;
  }): Promise<{
    ok: boolean;
    connectorId: IntegrationConnectorId;
    toolSlug: string;
    httpStatus: number | null;
    data: unknown;
    summary: string;
  }> {
    const preview = this.buildExecutePreview(input);
    const manifest = this.getManifest(preview.connectorId);
    if (!manifest) {
      throw new Error(`Unknown integration connector: ${String(input.connectorId || '<missing>')}`);
    }
    const apiKey = this.resolveApiKey(manifest);
    if (!apiKey && this.requiresApiKeyForExecution(manifest)) {
      throw new Error(`${manifest.label} needs ${manifest.env.apiKey || 'an API key'} before execution.`);
    }
    const target = this.resolveExecutionTarget(manifest, preview.toolSlug);
    if (!target) {
      throw new Error(`${manifest.label} needs ${manifest.env.executeUrl || manifest.env.baseUrl || 'an execution URL'} before execution.`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(target, {
        method: preview.method,
        headers: this.authHeaders(manifest, apiKey, true),
        body: JSON.stringify(input.input || {}),
        signal: controller.signal,
      });
      const data = await this.readResponse(response);
      return {
        ok: response.ok,
        connectorId: preview.connectorId,
        toolSlug: preview.toolSlug,
        httpStatus: response.status,
        data: redactSecrets(data),
        summary: response.ok
          ? `${manifest.label} tool executed through the governed connector mesh.`
          : `${manifest.label} tool execution returned HTTP ${response.status}.`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private resolveApiKey(manifest: IntegrationConnectorManifest): string {
    return normalizeText(manifest.env.apiKey ? this.env[manifest.env.apiKey] : '');
  }

  private resolveBaseUrl(manifest: IntegrationConnectorManifest): string | null {
    const configured = normalizeText(manifest.env.baseUrl ? this.env[manifest.env.baseUrl] : '');
    const url = normalizeHttpUrl(configured, true);
    if (configured && !url) {
      return null;
    }
    return url || manifest.defaultBaseUrl;
  }

  private resolveProbeTarget(manifest: IntegrationConnectorManifest, baseUrl: string | null): string | null {
    const healthUrl = normalizeText(manifest.env.healthUrl ? this.env[manifest.env.healthUrl] : '');
    if (healthUrl) {
      return normalizeHttpUrl(healthUrl);
    }
    if (!baseUrl || !manifest.toolDiscovery.supported || !manifest.toolDiscovery.endpoint) {
      return null;
    }
    return joinUrl(baseUrl, manifest.toolDiscovery.endpoint);
  }

  private hasConfiguredHealthUrl(manifest: IntegrationConnectorManifest): boolean {
    return Boolean(normalizeHttpUrl(manifest.env.healthUrl ? this.env[manifest.env.healthUrl] : ''));
  }

  private resolveExecutionTarget(manifest: IntegrationConnectorManifest, toolSlug: string | null): string | null {
    const configured = this.resolveConfiguredExecutionTarget(manifest);
    if (configured) {
      return configured;
    }
    const baseUrl = this.resolveBaseUrl(manifest);
    if (!baseUrl || !manifest.toolExecution.endpointTemplate) {
      return null;
    }
    const slug = this.resolveToolSlug(manifest, toolSlug);
    return joinUrl(baseUrl, manifest.toolExecution.endpointTemplate.replace('{toolSlug}', encodeURIComponent(slug)));
  }

  private resolveConfiguredExecutionTarget(manifest: IntegrationConnectorManifest): string | null {
    return normalizeHttpUrl(manifest.env.executeUrl ? this.env[manifest.env.executeUrl] : '');
  }

  private resolveToolSlug(manifest: IntegrationConnectorManifest, value: unknown): string {
    const toolSlug = normalizeText(value);
    if (toolSlug) return toolSlug;
    if (manifest.toolExecution.endpointTemplate?.includes('{toolSlug}')) {
      throw new Error('toolSlug is required for connector execution.');
    }
    return 'default';
  }

  private requiresApiKeyForExecution(manifest: IntegrationConnectorManifest): boolean {
    if (manifest.id === 'composio') {
      return true;
    }
    return !this.resolveExecutionTarget(manifest, null);
  }

  private redactExecutionTarget(manifest: IntegrationConnectorManifest, target: string): string {
    const configuredExecuteUrl = normalizeText(manifest.env.executeUrl ? this.env[manifest.env.executeUrl] : '');
    if (!configuredExecuteUrl) {
      return String(redactSecrets(target));
    }
    try {
      const url = new URL(target);
      return `${url.origin}/[${manifest.env.executeUrl}]`;
    } catch {
      return `[${manifest.env.executeUrl}]`;
    }
  }

  private missingConfigHint(manifest: IntegrationConnectorManifest): string {
    const keys = [
      manifest.env.executeUrl,
      manifest.env.healthUrl,
      manifest.env.apiKey,
      manifest.env.baseUrl,
    ].filter(Boolean);
    return keys.length
      ? `Set ${keys.join(' or ')}.`
      : 'Configure a connector execution or readiness endpoint.';
  }

  private async runHttpProbe(
    manifest: IntegrationConnectorManifest,
    checkedTarget: string,
    apiKey: string | null,
  ): Promise<IntegrationConnectorDoctor> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(checkedTarget, {
        method: 'GET',
        headers: this.authHeaders(manifest, apiKey, false),
        signal: controller.signal,
      });
      const latencyMs = Math.max(1, Date.now() - startedAt);
      if (response.ok) {
        return this.doctorSnapshot(manifest, {
          status: 'ready',
          configured: true,
          baseUrl: this.resolveBaseUrl(manifest),
          checkedTarget,
          httpStatus: response.status,
          latencyMs,
          summary: `${manifest.label} answered the connector readiness probe.`,
          nextAction: 'Expose selected connector tools through zavorth_action preview/apply.',
        });
      }
      return this.doctorSnapshot(manifest, {
        status: 'failed',
        configured: true,
        baseUrl: this.resolveBaseUrl(manifest),
        checkedTarget,
        httpStatus: response.status,
        latencyMs,
        summary: `${manifest.label} probe returned HTTP ${response.status}.`,
        nextAction: 'Review connector API key, scopes, base URL and account status.',
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return this.doctorSnapshot(manifest, {
        status: 'failed',
        configured: true,
        baseUrl: this.resolveBaseUrl(manifest),
        checkedTarget,
        httpStatus: null,
        latencyMs: Math.max(1, Date.now() - startedAt),
        summary: aborted
          ? `${manifest.label} probe timed out.`
          : `${manifest.label} probe failed: ${error instanceof Error ? error.message : String(error)}`,
        nextAction: 'Review connector network access and configured base URL.',
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private authHeaders(
    manifest: IntegrationConnectorManifest,
    apiKey: string | null,
    includeJson: boolean,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (includeJson) {
      headers['Content-Type'] = 'application/json';
    }
    if (!apiKey) {
      return headers;
    }
    if (manifest.id === 'composio') {
      headers['x-api-key'] = apiKey;
      return headers;
    }
    if (manifest.id === 'n8n') {
      headers['X-N8N-API-KEY'] = apiKey;
      return headers;
    }
    headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  private async readResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }
    try {
      return (await response.text()).slice(0, 1000);
    } catch {
      return null;
    }
  }

  private doctorSnapshot(
    manifest: IntegrationConnectorManifest,
    input: Omit<IntegrationConnectorDoctor, 'generatedAt' | 'id' | 'label' | 'safety'>,
  ): IntegrationConnectorDoctor {
    return {
      generatedAt: this.now().toISOString(),
      id: manifest.id,
      label: manifest.label,
      ...input,
      summary: String(redactSecrets(input.summary)),
      nextAction: String(redactSecrets(input.nextAction)),
      safety: {
        secretsRedacted: true,
        actionHarnessRequired: true,
        externalExecutionApprovalGated: true,
      },
    };
  }
}
