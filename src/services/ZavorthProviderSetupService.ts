import type { ZavorthRuntimeProviderConnection } from '../contracts/ZavorthRuntimeStateBusContract.js';
import { logger } from '../logger.js';

export type ZavorthProviderSetupInput = {
  providerId: string;
  label?: string | null;
  targetHost?: string | null;
  credentialRef?: string | null;
  credentialPresent?: boolean | null;
  allowDefaultRoute?: boolean | null;
};

export type ZavorthProviderSetupPreview = {
  providerId: string;
  label: string;
  status: ZavorthRuntimeProviderConnection['status'];
  targetHost: string | null;
  localLoopback: boolean;
  defaultRouteAllowed: boolean;
  blockReason: string | null;
  selectableModelIds: string[];
  readiness: 'ready' | 'needs-setup' | 'blocked';
  receiptSummary: string;
};

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['openai:gpt-4.1', 'openai:gpt-4.1-mini'],
  anthropic: ['anthropic:claude-3.7-sonnet', 'anthropic:claude-3.5-haiku'],
  google: ['google:gemini-2.5-pro', 'google:gemini-2.5-flash'],
  ollama: ['ollama:llama3.1', 'ollama:qwen2.5-coder'],
  local: ['local:default'],
};

const PRIVATE_HOST_PATTERN = /^(?:(?:10|127)(?:\.|$)|localhost$|(?:172\.(?:1[6-9]|2\d|3[0-1]))\.|192\.168\.|169\.254\.|0\.0\.0\.0$|::1$)/i;

export class ZavorthProviderSetupService {
  public preview(input: ZavorthProviderSetupInput): ZavorthProviderSetupPreview {
    const providerId = safeId(input.providerId) || 'custom';
    const label = clean(input.label) || formatLabel(providerId);
    const targetHost = clean(input.targetHost);
    const canonicalHost = canonicalHostname(targetHost);
    const localLoopback = Boolean(canonicalHost && PRIVATE_HOST_PATTERN.test(canonicalHost));
    const credentialReady = input.credentialPresent === true || Boolean(clean(input.credentialRef));
    const localProvider = providerId === 'ollama' || providerId === 'local';
    const blocked = Boolean(targetHost && localLoopback && !localProvider);
    const status: ZavorthRuntimeProviderConnection['status'] = blocked ? 'blocked'
      : credentialReady || localProvider ? 'configured'
        : 'needs-setup';
    return {
      providerId,
      label,
      status,
      targetHost,
      localLoopback,
      defaultRouteAllowed: status === 'configured' && input.allowDefaultRoute !== false,
      blockReason: blocked ? 'private_network_provider_requires_explicit_local_provider' : null,
      selectableModelIds: status === 'configured' ? modelsFor(providerId) : [],
      readiness: status === 'configured' ? 'ready' : status,
      receiptSummary: status === 'configured'
        ? `${label} is configured with governed readiness.`
        : status === 'blocked'
          ? `${label} is blocked by network trust policy.`
          : `${label} needs credentials or a local endpoint before it can be selected.`,
    };
  }

  public toRuntimeConnection(input: ZavorthProviderSetupInput): ZavorthRuntimeProviderConnection {
    const preview = this.preview(input);
    return {
      id: preview.providerId,
      label: preview.label,
      status: preview.status,
      targetHost: preview.targetHost,
      localLoopback: preview.localLoopback,
      defaultRouteAllowed: preview.defaultRouteAllowed,
      blockReason: preview.blockReason,
      updatedAt: new Date().toISOString(),
    };
  }
}

function canonicalHostname(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const parseCandidates = [
    trimmed,
    /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`,
  ];
  for (const candidate of parseCandidates) {
    try {
      const hostname = new URL(candidate).hostname
        .replace(/^\[|\]$/g, '')
        .toLowerCase();
      if (hostname) return hostname;
    } catch (error: unknown) {// Try next candidate.
      logger.warn('[Zavorth  Setup] network request failed', error);
    }
  }
  return trimmed
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/^[^@/]+@/, '')
    .replace(/^\[|\]$/g, '')
    .split(/[/:]/)[0]
    .toLowerCase() || null;
}

function modelsFor(providerId: string): string[] {
  return PROVIDER_MODELS[providerId] || [`${providerId}:default`];
}

function clean(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function safeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function formatLabel(value: string): string {
  return value.replace(/[-_:]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}
