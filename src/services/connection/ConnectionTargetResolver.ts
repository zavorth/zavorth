/**
 * Connection Target Resolver.
 * Deterministically resolves connection targets to their connection descriptors
 * and UI card descriptors across Plugin Manifests, Built-in OAuth providers,
 * Built-in Service Integrations, and Model Context Protocol (MCP) servers.
 *
 * Strict Clean Code: English-first, zero `any`, no rigid heuristics, fully typed.
 */

import type {
  PluginConnectionDescriptor,
  ConnectionCardDescriptor,
} from '../../contracts/connection/index.js';
import {
  CLAUDE_CONFIG,
  CODEX_CONFIG,
  GEMINI_CONFIG,
  GITHUB_CONFIG,
  QWEN_CONFIG,
  QODER_CONFIG,
  KIMI_CODING_CONFIG,
  CLINE_CONFIG,
  ZAVORTH_BRIDGE_CONFIG,
} from '../../ai-gateway/lib/oauth/constants/oauth.js';

export type ConnectionResolutionSource =
  | 'manifest'
  | 'builtin-oauth'
  | 'builtin-service'
  | 'mcp-server'
  | 'unknown';

export interface ConnectionResolution {
  source: ConnectionResolutionSource;
  descriptor?: PluginConnectionDescriptor;
  cardDescriptor?: ConnectionCardDescriptor;
  error?: string;
}

export interface ConnectionPluginRegistryPort {
  listEntries(): Array<{
    manifest: {
      id: string;
      label: string;
      description?: string;
      connection?: PluginConnectionDescriptor;
    };
  }>;
}

export interface ConnectionMcpClientPort {
  listServers(): Array<{
    id: string;
    name: string;
    transport?: string;
    command?: string;
  }>;
}

export interface BuiltinOAuthProviderInfo {
  id: string;
  displayName: string;
  icon: string;
  flowType: 'authorization_code' | 'authorization_code_pkce' | 'device_code';
  usePkce: boolean;
  authorizationUrl?: string;
  tokenUrl: string;
  scopes: string[];
  supportsDeviceCode: boolean;
  deviceCodeUrl?: string;
}

export interface ConnectionOAuthCatalogPort {
  listProviders(): BuiltinOAuthProviderInfo[];
  getProvider(id: string): BuiltinOAuthProviderInfo | null;
}

export interface BuiltinServiceInfo {
  id: string;
  displayName: string;
  icon: string;
  descriptor: PluginConnectionDescriptor;
}

class DefaultBuiltinOAuthCatalog implements ConnectionOAuthCatalogPort {
  private readonly providers = new Map<string, BuiltinOAuthProviderInfo>();

  constructor() {
    this.register({
      id: 'github',
      displayName: 'GitHub',
      icon: 'github',
      flowType: 'device_code',
      usePkce: false,
      tokenUrl: GITHUB_CONFIG.tokenUrl,
      scopes: Array.isArray(GITHUB_CONFIG.scopes) ? GITHUB_CONFIG.scopes : [],
      supportsDeviceCode: true,
      deviceCodeUrl: GITHUB_CONFIG.deviceCodeUrl,
    });

    this.register({
      id: 'claude',
      displayName: 'Claude (Anthropic)',
      icon: 'bot',
      flowType: 'authorization_code_pkce',
      usePkce: true,
      authorizationUrl: CLAUDE_CONFIG.authorizeUrl,
      tokenUrl: CLAUDE_CONFIG.tokenUrl,
      scopes: Array.isArray(CLAUDE_CONFIG.scopes) ? CLAUDE_CONFIG.scopes : [],
      supportsDeviceCode: false,
    });

    this.register({
      id: 'codex',
      displayName: 'Codex (OpenAI)',
      icon: 'sparkles',
      flowType: 'authorization_code_pkce',
      usePkce: true,
      authorizationUrl: CODEX_CONFIG.authorizeUrl,
      tokenUrl: CODEX_CONFIG.tokenUrl,
      scopes: typeof CODEX_CONFIG.scope === 'string' ? CODEX_CONFIG.scope.split(' ') : [],
      supportsDeviceCode: false,
    });

    this.register({
      id: 'gemini-cli',
      displayName: 'Gemini CLI (Google)',
      icon: 'sparkles',
      flowType: 'authorization_code',
      usePkce: false,
      authorizationUrl: GEMINI_CONFIG.authorizeUrl,
      tokenUrl: GEMINI_CONFIG.tokenUrl,
      scopes: Array.isArray(GEMINI_CONFIG.scopes) ? GEMINI_CONFIG.scopes : [],
      supportsDeviceCode: false,
    });

    this.register({
      id: 'qwen',
      displayName: 'Qwen (Alibaba)',
      icon: 'cpu',
      flowType: 'device_code',
      usePkce: true,
      tokenUrl: QWEN_CONFIG.tokenUrl,
      scopes: typeof QWEN_CONFIG.scope === 'string' ? QWEN_CONFIG.scope.split(' ') : [],
      supportsDeviceCode: true,
      deviceCodeUrl: QWEN_CONFIG.deviceCodeUrl,
    });

    this.register({
      id: 'qoder',
      displayName: 'Qoder',
      icon: 'code',
      flowType: 'authorization_code',
      usePkce: false,
      authorizationUrl: QODER_CONFIG.authorizeUrl,
      tokenUrl: QODER_CONFIG.tokenUrl,
      scopes: [],
      supportsDeviceCode: false,
    });

    this.register({
      id: 'kimi-coding',
      displayName: 'Kimi Coding (Moonshot)',
      icon: 'moon',
      flowType: 'device_code',
      usePkce: false,
      tokenUrl: KIMI_CODING_CONFIG.tokenUrl,
      scopes: [],
      supportsDeviceCode: true,
      deviceCodeUrl: KIMI_CODING_CONFIG.deviceCodeUrl,
    });

    this.register({
      id: 'cline',
      displayName: 'Cline',
      icon: 'terminal',
      flowType: 'authorization_code',
      usePkce: false,
      authorizationUrl: CLINE_CONFIG.authorizeUrl,
      tokenUrl: CLINE_CONFIG.tokenExchangeUrl,
      scopes: [],
      supportsDeviceCode: false,
    });

    this.register({
      id: 'zavorthbridge',
      displayName: 'Zavorth Bridge',
      icon: 'cpu',
      flowType: 'authorization_code',
      usePkce: false,
      authorizationUrl: ZAVORTH_BRIDGE_CONFIG.authorizeUrl,
      tokenUrl: ZAVORTH_BRIDGE_CONFIG.tokenUrl,
      scopes: Array.isArray(ZAVORTH_BRIDGE_CONFIG.scopes) ? ZAVORTH_BRIDGE_CONFIG.scopes : [],
      supportsDeviceCode: false,
    });
  }

  private register(info: BuiltinOAuthProviderInfo): void {
    this.providers.set(info.id.toLowerCase(), info);
  }

  public listProviders(): BuiltinOAuthProviderInfo[] {
    return Array.from(this.providers.values());
  }

  public getProvider(id: string): BuiltinOAuthProviderInfo | null {
    return this.providers.get(id.toLowerCase()) || null;
  }
}

class DefaultBuiltinServicesCatalog {
  private readonly services = new Map<string, BuiltinServiceInfo>();

  constructor() {
    this.register({
      id: 'stripe',
      displayName: 'Stripe Payments',
      icon: 'credit-card',
      descriptor: {
        authType: 'api_key',
        usePkce: false,
        apiKey: {
          label: 'Stripe Secret Key',
          placeholder: 'sk_live_...',
          helpUrl: 'https://dashboard.stripe.com/apikeys',
        },
      },
    });

    this.register({
      id: 'obsidian',
      displayName: 'Obsidian Vault',
      icon: 'book',
      descriptor: {
        authType: 'local_path',
        usePkce: false,
        localPath: {
          kind: 'directory',
          label: 'Obsidian Vault Directory',
        },
      },
    });

    this.register({
      id: 'notion',
      displayName: 'Notion Workspace',
      icon: 'file-text',
      descriptor: {
        authType: 'api_key',
        usePkce: false,
        apiKey: {
          label: 'Internal Integration Secret',
          placeholder: 'secret_...',
          helpUrl: 'https://www.notion.so/my-integrations',
        },
      },
    });
  }

  private register(info: BuiltinServiceInfo): void {
    this.services.set(info.id.toLowerCase(), info);
  }

  public listServices(): BuiltinServiceInfo[] {
    return Array.from(this.services.values());
  }

  public getService(id: string): BuiltinServiceInfo | null {
    return this.services.get(id.toLowerCase()) || null;
  }
}

export interface ConnectionTargetResolverOptions {
  pluginRegistry: ConnectionPluginRegistryPort;
  mcpClient?: ConnectionMcpClientPort;
  oauthCatalog?: ConnectionOAuthCatalogPort;
}

export class ConnectionTargetResolver {
  private readonly pluginRegistry: ConnectionPluginRegistryPort;
  private readonly mcpClient?: ConnectionMcpClientPort;
  private readonly oauthCatalog: ConnectionOAuthCatalogPort;
  private readonly builtinServices: DefaultBuiltinServicesCatalog;

  constructor(options: ConnectionTargetResolverOptions) {
    this.pluginRegistry = options.pluginRegistry;
    this.mcpClient = options.mcpClient;
    this.oauthCatalog = options.oauthCatalog || new DefaultBuiltinOAuthCatalog();
    this.builtinServices = new DefaultBuiltinServicesCatalog();
  }

  /**
   * Resolves a target identifier to its connection and card descriptors.
   * Priority:
   * 1. Plugin manifests with declared connection descriptors
   * 2. Built-in OAuth provider catalog
   * 3. Built-in Service Integrations (Stripe, Obsidian, Notion)
   * 4. Model Context Protocol (MCP) servers
   * 5. Deterministic error for unrecognized targets
   */
  public async resolve(target: string): Promise<ConnectionResolution> {
    const rawTarget = String(target || '').trim();
    if (!rawTarget) {
      return {
        source: 'unknown',
        error: "Target '' is not recognized. Use /connections catalog to view supported targets.",
      };
    }

    const normalized = rawTarget.toLowerCase();

    // 1. Plugin Manifests
    const manifestResult = this.resolveFromPluginManifests(normalized);
    if (manifestResult) {
      return manifestResult;
    }

    // 2. Built-in OAuth Providers
    const builtinResult = this.resolveFromBuiltinOAuth(normalized);
    if (builtinResult) {
      return builtinResult;
    }

    // 3. Built-in Service Integrations
    const serviceResult = this.resolveFromBuiltinServices(normalized);
    if (serviceResult) {
      return serviceResult;
    }

    // 4. MCP Servers
    const mcpResult = this.resolveFromMcpServers(normalized);
    if (mcpResult) {
      return mcpResult;
    }

    // 5. Deterministic Fallback Error
    return {
      source: 'unknown',
      error: `Target '${rawTarget}' is not recognized. Use /connections catalog to view supported targets.`,
    };
  }

  /**
   * Lists all available connection target names across all sources.
   */
  public listSupportedTargets(): string[] {
    const targets = new Set<string>();

    // 1. Plugin manifests
    for (const entry of this.pluginRegistry.listEntries()) {
      if (entry.manifest.connection) {
        targets.add(entry.manifest.id);
      }
    }

    // 2. Built-in OAuth providers
    for (const provider of this.oauthCatalog.listProviders()) {
      targets.add(provider.id);
    }

    // 3. Built-in Service Integrations
    for (const service of this.builtinServices.listServices()) {
      targets.add(service.id);
    }

    // 4. MCP servers
    if (this.mcpClient) {
      for (const server of this.mcpClient.listServers()) {
        targets.add(server.id);
      }
    }

    return Array.from(targets).sort();
  }

  private resolveFromPluginManifests(normalized: string): ConnectionResolution | null {
    const entries = this.pluginRegistry.listEntries();
    for (const entry of entries) {
      const manifest = entry.manifest;
      if (!manifest.connection) {
        continue;
      }

      const idMatch = manifest.id.toLowerCase() === normalized;
      const labelMatch = manifest.label.toLowerCase() === normalized;

      if (idMatch || labelMatch) {
        const descriptor = manifest.connection;
        return {
          source: 'manifest',
          descriptor,
          cardDescriptor: this.buildCardDescriptor(manifest.id, manifest.label, descriptor),
        };
      }
    }

    return null;
  }

  private resolveFromBuiltinOAuth(normalized: string): ConnectionResolution | null {
    for (const provider of this.oauthCatalog.listProviders()) {
      const idMatch = provider.id.toLowerCase() === normalized;
      const nameMatch = provider.displayName.toLowerCase() === normalized;

      if (idMatch || nameMatch) {
        const descriptor: PluginConnectionDescriptor = {
          authType: 'oauth2',
          usePkce: provider.usePkce,
          oauth: {
            authorizationUrl: provider.authorizationUrl,
            tokenUrl: provider.tokenUrl,
            scopes: provider.scopes,
            supportsDeviceCode: provider.supportsDeviceCode,
            deviceCodeUrl: provider.deviceCodeUrl,
          },
        };

        const cardDescriptor: ConnectionCardDescriptor = {
          targetId: provider.id,
          displayName: provider.displayName,
          icon: provider.icon,
          authType: 'oauth2',
          status: 'disconnected',
          actionUrl: descriptor.oauth?.authorizationUrl,
          deviceCodeVerificationUrl: provider.supportsDeviceCode
            ? provider.deviceCodeUrl || 'https://github.com/login/device'
            : undefined,
        };

        return {
          source: 'builtin-oauth',
          descriptor,
          cardDescriptor,
        };
      }
    }

    return null;
  }

  private resolveFromBuiltinServices(normalized: string): ConnectionResolution | null {
    for (const service of this.builtinServices.listServices()) {
      const idMatch = service.id.toLowerCase() === normalized;
      const nameMatch = service.displayName.toLowerCase() === normalized;

      if (idMatch || nameMatch) {
        return {
          source: 'builtin-service',
          descriptor: service.descriptor,
          cardDescriptor: this.buildCardDescriptor(
            service.id,
            service.displayName,
            service.descriptor
          ),
        };
      }
    }

    return null;
  }

  private resolveFromMcpServers(normalized: string): ConnectionResolution | null {
    if (!this.mcpClient) {
      return null;
    }

    for (const server of this.mcpClient.listServers()) {
      if (server.id.toLowerCase() === normalized || server.name.toLowerCase() === normalized) {
        const descriptor: PluginConnectionDescriptor = {
          authType: 'custom',
          usePkce: false,
        };

        const cardDescriptor: ConnectionCardDescriptor = {
          targetId: server.id,
          displayName: server.name,
          icon: 'server',
          authType: 'custom',
          status: 'disconnected',
        };

        return {
          source: 'mcp-server',
          descriptor,
          cardDescriptor,
        };
      }
    }

    return null;
  }

  private buildCardDescriptor(
    targetId: string,
    displayName: string,
    descriptor: PluginConnectionDescriptor
  ): ConnectionCardDescriptor {
    return {
      targetId,
      displayName,
      icon: this.getIconForTarget(targetId),
      authType: descriptor.authType,
      status: 'disconnected',
      actionUrl: descriptor.oauth?.authorizationUrl,
      inputPrompt: descriptor.apiKey
        ? {
            label: descriptor.apiKey.label,
            placeholder: descriptor.apiKey.placeholder,
            helpUrl: descriptor.apiKey.helpUrl,
          }
        : undefined,
    };
  }

  private getIconForTarget(targetId: string): string {
    const knownIcons: Record<string, string> = {
      github: 'github',
      claude: 'bot',
      codex: 'sparkles',
      'gemini-cli': 'sparkles',
      qwen: 'cpu',
      stripe: 'credit-card',
      obsidian: 'book',
      notion: 'file-text',
    };

    return knownIcons[targetId.toLowerCase()] || 'plug';
  }
}
