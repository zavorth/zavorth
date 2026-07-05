import fs from 'node:fs';
import path from 'node:path';
import type { ExperienceSurface } from './ExperienceContracts.js';
import { logger } from '../../logger.js';

type PreferenceState = {
  contractVersion: 'ExperienceProfileSelectionPreferences/v1';
  updatedAt: string;
  preferences: Record<string, {
    profileId: string;
    updatedAt: string;
    source: string;
  }>;
};

export type ProfileSelectionPreferenceRuntime = {
  now?: () => Date;
  storePath?: string;
};

export class ProfileSelectionPreferenceService {
  private readonly now: () => Date;
  private readonly storePath: string;

  constructor(runtime: ProfileSelectionPreferenceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.storePath = runtime.storePath || path.join(process.cwd(), 'data', 'runtime', 'experience-profiles.json');
  }

  public get(input: {
    surface: ExperienceSurface;
    userId?: string | null;
  }): string | null {
    const state = this.readState();
    return state.preferences[this.key(input)]?.profileId || null;
  }

  public set(input: {
    surface: ExperienceSurface;
    userId?: string | null;
    profileId: string | null | undefined;
    source?: string | null;
  }): string | null {
    const profileId = normalizeProfileId(input.profileId);
    if (!profileId) return null;
    const state = this.readState();
    const updatedAt = this.now().toISOString();
    state.preferences[this.key(input)] = {
      profileId,
      updatedAt,
      source: String(input.source || 'experience-core'),
    };
    state.updatedAt = updatedAt;
    this.writeState(state);
    return profileId;
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
    return `${normalizeKey(input.userId, 'local-user')}::${normalizeKey(input.surface, 'unknown')}`;
  }

  private readState(): PreferenceState {
    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw) as PreferenceState;
      if (parsed?.contractVersion === 'ExperienceProfileSelectionPreferences/v1' && parsed.preferences && typeof parsed.preferences === 'object') {
        return parsed;
      }
    } catch (error) { // Missing or invalid state should not block profile selection. logger.warn('[Profile Selection Preference] JSON parse failed', error); }
    return {
      contractVersion: 'ExperienceProfileSelectionPreferences/v1',
      updatedAt: this.now().toISOString(),
      preferences: {},
    };
  }

  private writeState(state: PreferenceState): void {
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function normalizeProfileId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function normalizeKey(value: unknown, fallback: string): string {
  const text = normalizeProfileId(value);
  return text || fallback;
}
