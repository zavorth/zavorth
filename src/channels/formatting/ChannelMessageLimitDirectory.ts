import { config } from '../../config/index.js';

/**
 * Cross-module registry of outbound message size limits declared and
 * negotiated by channel adapters. GatewayRuntime feeds it during channel
 * registration (declaration + API negotiation), and the shared formatting
 * pipeline consumes it when no explicit char-limit override is provided.
 *
 * Resolution precedence: workspace configuration override, then the
 * adapter-negotiated API limit, then the adapter-declared static limit;
 * returning undefined falls through to the built-in platform table.
 */
class ChannelMessageLimitDirectory {
  private readonly declaredLimits = new Map<string, number>();
  private readonly negotiatedLimits = new Map<string, number>();

  public recordDeclaredLimit(platform: string, limit: number | null | undefined): void {
    const key = normalizePlatformKey(platform);
    if (!key) {
      return;
    }
    if (isPositiveFiniteNumber(limit)) {
      this.declaredLimits.set(key, Math.floor(limit));
      return;
    }
    this.declaredLimits.delete(key);
  }

  /**
   * Records the result of an adapter API negotiation. Null/undefined keeps
   * whatever was previously declared (negotiation declined a custom limit).
   */
  public recordNegotiatedLimit(platform: string, limit: number | null | undefined): void {
    const key = normalizePlatformKey(platform);
    if (!key) {
      return;
    }
    if (isPositiveFiniteNumber(limit)) {
      this.negotiatedLimits.set(key, Math.floor(limit));
      return;
    }
    this.negotiatedLimits.delete(key);
  }

  public getDeclaredLimit(platform: string): number | undefined {
    return this.declaredLimits.get(normalizePlatformKey(platform));
  }

  public getNegotiatedLimit(platform: string): number | undefined {
    return this.negotiatedLimits.get(normalizePlatformKey(platform));
  }

  /** Clears every recorded declaration/negotiation (test isolation helper). */
  public resetForTests(): void {
    this.declaredLimits.clear();
    this.negotiatedLimits.clear();
  }
}

const globalForChannelMessageLimitDirectory = globalThis as unknown as {
  zavorthChannelMessageLimitDirectory?: ChannelMessageLimitDirectory;
};

export function getChannelMessageLimitDirectory(): ChannelMessageLimitDirectory {
  globalForChannelMessageLimitDirectory.zavorthChannelMessageLimitDirectory ??=
    new ChannelMessageLimitDirectory();
  return globalForChannelMessageLimitDirectory.zavorthChannelMessageLimitDirectory;
}

/**
 * Default resolution consumed wherever no explicit override is provided:
 * workspace configuration override > negotiated API limit > declared
 * adapter limit. Undefined means "use the built-in platform table".
 */
export function resolveOutboundCharLimitOverride(
  platform: string,
  workspaceOverrides?: Record<string, number>,
): number | undefined {
  const key = normalizePlatformKey(platform);
  if (!key) {
    return undefined;
  }
  const overrides = workspaceOverrides ?? loadWorkspaceCharLimitOverrides();
  const fromConfig = overrides[key];
  if (isPositiveFiniteNumber(fromConfig)) {
    return Math.floor(fromConfig);
  }
  const directory = getChannelMessageLimitDirectory();
  const negotiated = directory.getNegotiatedLimit(key);
  if (negotiated !== undefined) {
    return negotiated;
  }
  return directory.getDeclaredLimit(key);
}

let cachedWorkspaceOverrides: Record<string, number> | null = null;

/** Reads the workspace-level overrides from config exactly once per process. */
function loadWorkspaceCharLimitOverrides(): Record<string, number> {
  cachedWorkspaceOverrides ??= sanitizeWorkspaceOverrides(config.messageCharLimitOverrides);
  return cachedWorkspaceOverrides;
}

function sanitizeWorkspaceOverrides(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const sanitized: Record<string, number> = {};
  for (const [platform, limit] of Object.entries(raw as Record<string, unknown>)) {
    const key = normalizePlatformKey(platform);
    if (key && isPositiveFiniteNumber(limit)) {
      sanitized[key] = Math.floor(limit);
    }
  }
  return sanitized;
}

function normalizePlatformKey(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
