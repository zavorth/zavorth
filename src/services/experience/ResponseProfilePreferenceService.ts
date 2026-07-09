import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../logger.js';
import type {
ExperienceResponseProfileId,
  ExperienceSurface,
} from './ExperienceContracts.js';

type PreferenceState = {
  contractVersion: 'ExperienceResponseProfilePreferences/v1';
  updatedAt: string;
  preferences: Record<string, {
    profile: ExperienceResponseProfileId;
    updatedAt: string;
    source: string;
  }>;
};

export type ResponseProfilePreferenceRuntime = {
  now?: () => Date;
  storePath?: string;
};

const VALID_PROFILES = new Set<ExperienceResponseProfileId>(['short', 'dev', 'executive', 'mentor']);

function normalizeId(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-');
  return text || fallback;
}

export class ResponseProfilePreferenceService {
  private readonly now: () => Date;
  private readonly storePath: string;

  constructor(runtime: ResponseProfilePreferenceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.storePath = runtime.storePath || path.join(process.cwd(), 'data', 'runtime', 'experience-response-profiles.json');
  }

  public get(input: {
    surface: ExperienceSurface;
    userId?: string | null;
  }): ExperienceResponseProfileId | null {
    const state = this.readState();
    return state.preferences[this.key(input)]?.profile || null;
  }

  public set(input: {
    surface: ExperienceSurface;
    userId?: string | null;
    profile: ExperienceResponseProfileId | null | undefined;
    source?: string | null;
  }): ExperienceResponseProfileId | null {
    if (!input.profile || !VALID_PROFILES.has(input.profile)) return null;
    const state = this.readState();
    const updatedAt = this.now().toISOString();
    state.preferences[this.key(input)] = {
      profile: input.profile,
      updatedAt,
      source: String(input.source || 'experience-core'),
    };
    state.updatedAt = updatedAt;
    this.writeState(state);
    return input.profile;
  }

  public reset(input: {
    surface: ExperienceSurface;
    userId?: string | null;
  }): boolean {
    const state = this.readState();
    const key = this.key(input);
    if (!state.preferences[key]) return false;
    delete state.preferences[key];
    state.updatedAt = this.now().toISOString();
    this.writeState(state);
    return true;
  }

  private key(input: { surface: ExperienceSurface; userId?: string | null }): string {
    return `${normalizeId(input.userId, 'local-user')}::${normalizeId(input.surface, 'unknown')}`;
  }

  private readState(): PreferenceState {
    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as PreferenceState;
      if (parsed?.contractVersion === 'ExperienceResponseProfilePreferences/v1' && parsed.preferences && typeof parsed.preferences === 'object') {
        return parsed;
      }
    } catch (error: unknown) {// Missing or invalid state should not block Experience Core.
      logger.warn('[Response Profile Preference] JSON parse failed', error);
    }
    return {
      contractVersion: 'ExperienceResponseProfilePreferences/v1',
      updatedAt: this.now().toISOString(),
      preferences: {},
    };
  }

  private writeState(state: PreferenceState): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}
