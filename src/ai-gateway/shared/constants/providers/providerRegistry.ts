import { APIKEY_PROVIDERS } from "./apiKeyProviders";
import { FREE_PROVIDERS } from "./freeProviders";
import { OAUTH_PROVIDERS } from "./oauthProviders";

export const OPENAI_COMPATIBLE_PREFIX = "openai-compatible-";
export const ANTHROPIC_COMPATIBLE_PREFIX = "anthropic-compatible-";
export const CLAUDE_CODE_COMPATIBLE_PREFIX = "anthropic-compatible-cc-";

export function isOpenAICompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
}

export function isAnthropicCompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX);
}

export const UPSTREAM_PROXY_PROVIDERS = {
  cliproxyapi: {
    id: "cliproxyapi",
    alias: "cpa",
    name: "CLIProxyAPI",
    icon: "proxy",
    color: "#6366F1",
    textIcon: "CPA",
    website: "https://github.com/router-for-me/CLIProxyAPI",
    defaultPort: 8317,
    healthEndpoint: "/v1/models",
    managementPrefix: "/v0/management",
    configDir: "~/.cli-proxy-api",
    binaryName: "cli-proxy-api",
    githubRepo: "router-for-me/CLIProxyAPI",
  },
};

export function isClaudeCodeCompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(CLAUDE_CODE_COMPATIBLE_PREFIX);
}

export const AI_PROVIDERS = {
  ...FREE_PROVIDERS,
  ...OAUTH_PROVIDERS,
  ...APIKEY_PROVIDERS,
  ...UPSTREAM_PROXY_PROVIDERS,
};

export const AUTH_METHODS = {
  oauth: { id: "oauth", name: "OAuth", icon: "lock" },
  apikey: { id: "apikey", name: "API Key", icon: "key" },
};

export function getProviderByAlias(alias) {
  for (const provider of Object.values(AI_PROVIDERS)) {
    if (provider.alias === alias || provider.id === alias) {
      return provider;
    }
  }
  return null;
}

export function resolveProviderId(aliasOrId) {
  const provider = getProviderByAlias(aliasOrId);
  return provider?.id || aliasOrId;
}

export function getProviderAlias(providerId) {
  const provider = AI_PROVIDERS[providerId];
  return provider?.alias || providerId;
}

export const ALIAS_TO_ID = Object.values(AI_PROVIDERS).reduce((acc, p) => {
  if (p.alias) acc[p.alias] = p.id;
  return acc;
}, {});

export const ID_TO_ALIAS = Object.values(AI_PROVIDERS).reduce((acc, p) => {
  acc[p.id] = p.alias || p.id;
  return acc;
}, {});

export const USAGE_SUPPORTED_PROVIDERS = [
  "zavorthBridge",
  "gemini-cli",
  "kiro",
  "github",
  "codex",
  "claude",
  "kimi-coding",
  "glm",
];
