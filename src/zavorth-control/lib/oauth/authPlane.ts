import { ZAVORTH_OAUTH_LEGACY_ENV_ALIASES } from "./compat/legacyEnvAliases";

export type ZavorthOAuthFlowType =
  | "authorization_code"
  | "authorization_code_pkce"
  | "device_code";

export interface ZavorthProviderAuthHandler {
  config: Record<string, unknown>;
  flowType: ZavorthOAuthFlowType | string;
  fixedPort?: number;
  callbackPath?: string;
  buildAuthUrl?: (...args: any[]) => string;
  exchangeToken?: (...args: any[]) => Promise<Record<string, unknown>>;
  requestDeviceCode?: (...args: any[]) => Promise<Record<string, unknown>>;
  pollToken?: (...args: any[]) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
  postExchange?: (...args: any[]) => Promise<Record<string, unknown>>;
  mapTokens: (...args: any[]) => Record<string, unknown>;
}

export interface ZavorthProviderAuthDescriptor {
  name: string;
  flowType: ZavorthOAuthFlowType | string;
  callbackPath: string;
  fixedPort?: number;
  supportsBrowserRedirect: boolean;
  supportsDeviceCode: boolean;
}

export interface ZavorthOAuthServerCredentials {
  server: string;
  token: string;
  userId: string;
}

export const ZAVORTH_OAUTH_ENV = {
  server: ["ZAVORTH_OAUTH_SERVER", "ZAVORTH_SERVER", ...ZAVORTH_OAUTH_LEGACY_ENV_ALIASES.server],
  token: ["ZAVORTH_OAUTH_TOKEN", "ZAVORTH_TOKEN", ...ZAVORTH_OAUTH_LEGACY_ENV_ALIASES.token],
  userId: ["ZAVORTH_OAUTH_USER_ID", "ZAVORTH_USER_ID", ...ZAVORTH_OAUTH_LEGACY_ENV_ALIASES.userId],
} as const;

function firstEnvValue(names: readonly string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return null;
}

function describeProvider(name: string, provider: ZavorthProviderAuthHandler): ZavorthProviderAuthDescriptor {
  return {
    name,
    flowType: provider.flowType,
    callbackPath: provider.callbackPath || "/callback",
    fixedPort: provider.fixedPort,
    supportsBrowserRedirect: provider.flowType !== "device_code",
    supportsDeviceCode: provider.flowType === "device_code",
  };
}

export function createZavorthProviderAuthPlane(
  providers: Record<string, ZavorthProviderAuthHandler>
) {
  const descriptors = new Map(
    Object.entries(providers).map(([name, provider]) => [name, describeProvider(name, provider)])
  );

  return {
    getProvider(name: string): ZavorthProviderAuthHandler {
      const provider = providers[name];
      if (!provider) {
        throw new Error(`Unknown provider: ${name}`);
      }
      return provider;
    },
    getProviderNames(): string[] {
      return Object.keys(providers);
    },
    describeProvider(name: string): ZavorthProviderAuthDescriptor {
      const descriptor = descriptors.get(name);
      if (!descriptor) {
        throw new Error(`Unknown provider: ${name}`);
      }
      return descriptor;
    },
    describeAllProviders(): ZavorthProviderAuthDescriptor[] {
      return Array.from(descriptors.values());
    },
  };
}

export function getZavorthOAuthServerCredentials(
  defaultServer: string
): ZavorthOAuthServerCredentials {
  return {
    server: firstEnvValue(ZAVORTH_OAUTH_ENV.server) || defaultServer,
    token: firstEnvValue(ZAVORTH_OAUTH_ENV.token) || "",
    userId: firstEnvValue(ZAVORTH_OAUTH_ENV.userId) || "cli",
  };
}
