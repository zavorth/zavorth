import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type ZavorthLocalProfilePreferenceValue =
  | boolean
  | string
  | number
  | null
  | string[]
  | Record<string, boolean | string | number | null>;

export type ZavorthLocalProfilePreferenceRecord = {
  namespace: string;
  key: string;
  value: ZavorthLocalProfilePreferenceValue;
  valueType: 'boolean' | 'string' | 'number' | 'null' | 'string-array' | 'object';
  updatedAt: string;
  updatedBy: string;
};

export type ZavorthLocalProfilePreferenceScope = {
  userId: string;
  profileId: string;
  profileKey: string;
};

export type ZavorthLocalProfilePreferenceReadResult<T extends ZavorthLocalProfilePreferenceValue = ZavorthLocalProfilePreferenceValue> =
  ZavorthLocalProfilePreferenceScope & {
    namespace: string;
    key: string;
    value: T;
    exists: boolean;
    updatedAt: string;
    updatedBy: string;
    source: 'backend-preferences';
    receipts: string[];
  };

export type ZavorthLocalProfilePreferenceInput = {
  userId?: string | null;
  profileId?: string | null;
  namespace: string;
  key: string;
};

export type ZavorthLocalProfilePreferenceWriteInput = ZavorthLocalProfilePreferenceInput & {
  value: ZavorthLocalProfilePreferenceValue;
  updatedBy?: string | null;
};

export type ZavorthLocalProfilePreferenceRuntime = {
  stateFilePath?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type ZavorthLocalProfilePreferenceScopeState = ZavorthLocalProfilePreferenceScope & {
  updatedAt: string;
  preferences: Record<string, ZavorthLocalProfilePreferenceRecord>;
};

type ZavorthLocalProfilePreferenceStateFile = {
  version: 1;
  updatedAt: string;
  scopes: Record<string, ZavorthLocalProfilePreferenceScopeState>;
};

const STATE_FILE_VERSION = 1;
const DEFAULT_STATE_FILE_NAME = 'local-profile-preferences.json';

export class ZavorthLocalProfilePreferenceService {
  private readonly stateFilePath: string;
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  public constructor(runtime: ZavorthLocalProfilePreferenceRuntime = {}) {
    this.stateFilePath = runtime.stateFilePath
      || process.env.ZAVORTH_LOCAL_PROFILE_PREFERENCES_STATE_FILE
      || path.resolve(config.projectRoot, 'data', 'runtime', DEFAULT_STATE_FILE_NAME);
    this.now = runtime.now || (() => new Date());
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readBoolean(input: ZavorthLocalProfilePreferenceInput & { defaultValue?: boolean }): ZavorthLocalProfilePreferenceReadResult<boolean> {
    const result = this.readPreference<boolean>({
      ...input,
      defaultValue: input.defaultValue ?? false,
      isExpectedValue: (value): value is boolean => typeof value === 'boolean',
    });
    return result;
  }

  public setBoolean(input: Omit<ZavorthLocalProfilePreferenceWriteInput, 'value'> & { value: boolean }): ZavorthLocalProfilePreferenceReadResult<boolean> {
    return this.setPreference({
      ...input,
      value: input.value,
    }) as ZavorthLocalProfilePreferenceReadResult<boolean>;
  }

  public readPreference<T extends ZavorthLocalProfilePreferenceValue>(input: ZavorthLocalProfilePreferenceInput & {
    defaultValue: T;
    isExpectedValue?: (value: ZavorthLocalProfilePreferenceValue) => value is T;
  }): ZavorthLocalProfilePreferenceReadResult<T> {
    const scope = this.resolveScope(input);
    const preferenceId = this.preferenceId(input.namespace, input.key);
    const state = this.readState();
    const record = state.scopes[scope.profileKey]?.preferences[preferenceId] || null;
    const expected = record && (!input.isExpectedValue || input.isExpectedValue(record.value));
    const now = this.now().toISOString();
    return {
      ...scope,
      namespace: this.cleanRequired(input.namespace, 'preferences'),
      key: this.cleanRequired(input.key, 'unknown'),
      value: expected ? record.value as T : input.defaultValue,
      exists: Boolean(expected),
      updatedAt: expected ? record.updatedAt : now,
      updatedBy: expected ? record.updatedBy : 'default',
      source: 'backend-preferences',
      receipts: [
        'local-profile-preference-read-from-backend-state',
        'local-profile-preferences-do-not-store-secrets',
      ],
    };
  }

  public setPreference(input: ZavorthLocalProfilePreferenceWriteInput): ZavorthLocalProfilePreferenceReadResult {
    if (containsSecretLikeMaterial(input.value)) {
      throw new Error('Local profile preferences cannot store secret-looking values.');
    }
    const scope = this.resolveScope(input);
    const namespace = this.cleanRequired(input.namespace, 'preferences');
    const key = this.cleanRequired(input.key, 'unknown');
    const preferenceId = this.preferenceId(namespace, key);
    const state = this.readState();
    const updatedAt = this.now().toISOString();
    const scopeState = state.scopes[scope.profileKey] || {
      ...scope,
      updatedAt,
      preferences: {},
    };
    scopeState.preferences[preferenceId] = {
      namespace,
      key,
      value: input.value,
      valueType: valueType(input.value),
      updatedAt,
      updatedBy: this.clean(input.updatedBy) || 'zavorthControl',
    };
    scopeState.updatedAt = updatedAt;
    state.scopes[scope.profileKey] = scopeState;
    state.updatedAt = updatedAt;
    this.writeState(state);
    return this.readPreference({
      ...input,
      defaultValue: input.value,
    });
  }

  public resolveScope(input: { userId?: string | null; profileId?: string | null }): ZavorthLocalProfilePreferenceScope {
    const userId = this.clean(input.userId) || 'local-owner';
    const profileId = this.clean(input.profileId) || config.zavorthProductMode || 'default';
    return {
      userId,
      profileId,
      profileKey: `${this.slug(userId)}::${this.slug(profileId)}`,
    };
  }

  private preferenceId(namespace: string, key: string): string {
    return `${this.slug(this.cleanRequired(namespace, 'preferences'))}.${this.slug(this.cleanRequired(key, 'unknown'))}`;
  }

  private readState(): ZavorthLocalProfilePreferenceStateFile {
    if (!this.existsSync(this.stateFilePath)) {
      return this.emptyState();
    }
    try {
      const parsed = JSON.parse(this.readFileSync(this.stateFilePath, 'utf8') as string) as Partial<ZavorthLocalProfilePreferenceStateFile>;
      const scopes = parsed && typeof parsed === 'object' && parsed.scopes && typeof parsed.scopes === 'object'
        ? parsed.scopes as Record<string, ZavorthLocalProfilePreferenceScopeState>
        : {};
      return {
        version: STATE_FILE_VERSION,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : this.now().toISOString(),
        scopes: this.normalizeScopes(scopes),
      };
    } catch (error: unknown) {logger.warn('[Zavorth Local Profile Preference] parsing failed', error);
    return this.emptyState();
  }
  }

  private normalizeScopes(scopes: Record<string, ZavorthLocalProfilePreferenceScopeState>): Record<string, ZavorthLocalProfilePreferenceScopeState> {
    const normalized: Record<string, ZavorthLocalProfilePreferenceScopeState> = {};
    for (const [scopeKey, scope] of Object.entries(scopes)) {
      if (!scope || typeof scope !== 'object') {
        continue;
      }
      const userId = this.clean(scope.userId) || 'local-owner';
      const profileId = this.clean(scope.profileId) || 'default';
      const profileKey = this.clean(scope.profileKey) || scopeKey;
      normalized[profileKey] = {
        userId,
        profileId,
        profileKey,
        updatedAt: this.clean(scope.updatedAt) || this.now().toISOString(),
        preferences: this.normalizePreferences(scope.preferences || {}),
      };
    }
    return normalized;
  }

  private normalizePreferences(records: Record<string, ZavorthLocalProfilePreferenceRecord>): Record<string, ZavorthLocalProfilePreferenceRecord> {
    const normalized: Record<string, ZavorthLocalProfilePreferenceRecord> = {};
    for (const [id, record] of Object.entries(records)) {
      if (!record || typeof record !== 'object' || containsSecretLikeMaterial(record.value)) {
        continue;
      }
      const namespace = this.clean(record.namespace) || 'preferences';
      const key = this.clean(record.key) || id;
      normalized[this.preferenceId(namespace, key)] = {
        namespace,
        key,
        value: normalizeValue(record.value),
        valueType: valueType(record.value),
        updatedAt: this.clean(record.updatedAt) || this.now().toISOString(),
        updatedBy: this.clean(record.updatedBy) || 'unknown',
      };
    }
    return normalized;
  }

  private writeState(state: ZavorthLocalProfilePreferenceStateFile): void {
    this.mkdirSync(path.dirname(this.stateFilePath), { recursive: true });
    this.writeFileSync(this.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }

  private emptyState(): ZavorthLocalProfilePreferenceStateFile {
    return {
      version: STATE_FILE_VERSION,
      updatedAt: this.now().toISOString(),
      scopes: {},
    };
  }

  private cleanRequired(value: unknown, fallback: string): string {
    return this.clean(value) || fallback;
  }

  private clean(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private slug(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'default';
  }
}

function normalizeValue(value: ZavorthLocalProfilePreferenceValue): ZavorthLocalProfilePreferenceValue {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string').slice(0, 50);
  }
  if (value && typeof value === 'object') {
    const output: Record<string, boolean | string | number | null> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (typeof entry === 'boolean' || typeof entry === 'string' || typeof entry === 'number' || entry === null) {
        output[key] = typeof entry === 'string' ? entry.slice(0, 500) : entry;
      }
    }
    return output;
  }
  if (typeof value === 'string') {
    return value.slice(0, 1_000);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function valueType(value: ZavorthLocalProfilePreferenceValue): ZavorthLocalProfilePreferenceRecord['valueType'] {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'string-array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'string') {
    return 'string';
  }
  return 'null';
}

function containsSecretLikeMaterial(value: ZavorthLocalProfilePreferenceValue): boolean {
  const text = JSON.stringify(value).toLowerCase();
  return /\b(secret|password|api[_-]?key|access[_-]?token|refresh[_-]?token|bearer)\b/.test(text)
    || /\b(sk-[a-z0-9_-]{12,}|ghp_[a-z0-9_]{12,}|xox[baprs]-[a-z0-9-]{12,})\b/i.test(text);
}
