import fs from 'fs';
import { readZavorthEnv } from '../config/configHelpers.js';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthProfile = 'core' | 'ops' | 'full';
export type ZavorthCapabilityPolicy = 'ask-on-demand';
export type ZavorthSelfmodPolicy = 'owner_trusted';

export function normalizeZavorthProfile(rawValue: string | null | undefined): ZavorthProfile {
  const normalized = String(rawValue || '')
    .trim()
    .toLowerCase();
  if (normalized === 'ops' || normalized === 'full') {
    return normalized;
  }
  return 'core';
}

type RuntimeProfileServiceOptions = {
  stateFilePath?: string | null;
};

function resolvePersistedProfile(stateFilePath?: string | null): ZavorthProfile | null {
  const resolvedStateFilePath =
    String(stateFilePath || '').trim() ||
    String(process.env.ZAVORTH_CAPABILITY_LIFECYCLE_STATE_FILE || '').trim() ||
    config.capabilityLifecycleStateFile;
  try {
    if (!resolvedStateFilePath || !fs.existsSync(resolvedStateFilePath)) {
      return null;
    }
    const raw = fs.readFileSync(resolvedStateFilePath, 'utf8');
    const trimmed = raw.trim();
    // Empty/missing state is common in tests and fresh runtimes — not corruption.
    if (!trimmed) {
      logger.debug('[Runtime Profile] empty state file; using defaults');
      return null;
    }
    const parsed = JSON.parse(trimmed) as { profile?: string | null };
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return normalizeZavorthProfile(parsed.profile);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Truncated empty payloads still look like "Unexpected end of JSON input".
    if (/Unexpected end of JSON input/i.test(message)) {
      logger.debug('[Runtime Profile] empty or truncated JSON; using defaults', error);
    } else {
      logger.warn('[Runtime Profile] JSON parse failed', error);
    }
    return null;
  }
}

function resolveBootstrapProfile(
  explicitProfile?: string | null,
  options: RuntimeProfileServiceOptions = {},
): ZavorthProfile {
  const normalizedExplicit = String(explicitProfile || '').trim();
  if (normalizedExplicit) {
    return normalizeZavorthProfile(normalizedExplicit);
  }

  const normalizedEnv = readZavorthEnv('ZAVORTH_PROFILE');
  if (normalizedEnv) {
    return normalizeZavorthProfile(normalizedEnv);
  }

  return resolvePersistedProfile(options.stateFilePath) || normalizeZavorthProfile(config.zavorthProfile);
}

export class RuntimeProfileService {
  private profile: ZavorthProfile;

  constructor(profile?: string | null, options: RuntimeProfileServiceOptions = {}) {
    this.profile = resolveBootstrapProfile(profile, options);
  }

  public getProfile(): ZavorthProfile {
    return this.profile;
  }

  public setProfile(profile: string | null | undefined): ZavorthProfile {
    this.profile = normalizeZavorthProfile(profile);
    return this.profile;
  }

  public isCore(): boolean {
    return this.profile === 'core';
  }

  public isOps(): boolean {
    return this.profile === 'ops';
  }

  public isFull(): boolean {
    return this.profile === 'full';
  }

  public supportsRecurringAutomation(): boolean {
    return this.profile === 'ops' || this.profile === 'full';
  }

  public supportsDailyReport(): boolean {
    return this.profile === 'ops' || this.profile === 'full';
  }

  public supportsAdvancedRuntime(): boolean {
    return this.profile === 'full';
  }

  public supportsRemoteSidecars(): boolean {
    return this.profile === 'full';
  }

  public supportsAdvancedWatchers(): boolean {
    return this.profile === 'full';
  }

  public supportsOptionalChannelBoot(): boolean {
    return this.profile === 'full';
  }

  public supportsPublicTunnelBoot(): boolean {
    return this.profile === 'full';
  }
}
