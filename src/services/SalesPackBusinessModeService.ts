import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import {
ZavorthLocalProfilePreferenceService,
  type ZavorthLocalProfilePreferenceRuntime,
} from './ZavorthLocalProfilePreferenceService.js';

export type SalesPackBusinessModeRecord = {
  profileKey: string;
  userId: string;
  profileId: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type SalesPackBusinessModeSnapshot = SalesPackBusinessModeRecord & {
  generatedAt: string;
  source: 'backend';
  receipts: string[];
};

type SalesPackBusinessModeRuntime = ZavorthLocalProfilePreferenceRuntime & {
  preferenceService?: ZavorthLocalProfilePreferenceService;
  legacyStateFilePath?: string;
};

type SalesPackBusinessModeInput = {
  userId?: string | null;
  profileId?: string | null;
};

type SalesPackBusinessModeUpdateInput = SalesPackBusinessModeInput & {
  enabled: boolean;
  updatedBy?: string | null;
};

type SalesPackBusinessModeLegacyStateFile = {
  version: 1;
  updatedAt: string;
  records: Record<string, SalesPackBusinessModeRecord>;
};

const BUSINESS_MODE_NAMESPACE = 'sales-pack';
const BUSINESS_MODE_KEY = 'business-mode.enabled';
const LEGACY_STATE_FILE_NAME = 'sales-pack-business-mode-state.json';

export class SalesPackBusinessModeService {
  private readonly preferences: ZavorthLocalProfilePreferenceService;
  private readonly legacyStateFilePath: string;
  private readonly now: () => Date;

  public constructor(runtime: SalesPackBusinessModeRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.preferences = runtime.preferenceService || new ZavorthLocalProfilePreferenceService({
      ...runtime,
      stateFilePath: runtime.stateFilePath,
      now: this.now,
    });
    this.legacyStateFilePath = runtime.legacyStateFilePath
      || process.env.ZAVORTH_SALES_PACK_BUSINESS_MODE_STATE_FILE
      || path.resolve(config.projectRoot, 'data', 'runtime', LEGACY_STATE_FILE_NAME);
  }

  public readSnapshot(input: SalesPackBusinessModeInput = {}): SalesPackBusinessModeSnapshot {
    const preference = this.preferences.readBoolean({
      ...input,
      namespace: BUSINESS_MODE_NAMESPACE,
      key: BUSINESS_MODE_KEY,
      defaultValue: false,
    });
    const legacy = preference.exists ? null : this.readLegacyRecord(preference.profileKey);
    const enabled = preference.exists ? preference.value : legacy?.enabled === true;
    return {
      profileKey: preference.profileKey,
      userId: preference.userId,
      profileId: preference.profileId,
      enabled,
      updatedAt: preference.exists ? preference.updatedAt : legacy?.updatedAt || preference.updatedAt,
      updatedBy: preference.exists ? preference.updatedBy : legacy?.updatedBy || 'default',
      generatedAt: this.now().toISOString(),
      source: 'backend',
      receipts: [
        ...preference.receipts,
        'business-mode-preference-read-from-unified-local-profile-store',
        'business-mode-does-not-store-secrets',
        ...(legacy && !preference.exists ? ['business-mode-legacy-state-read-only-compatible'] : []),
      ],
    };
  }

  public setEnabled(input: SalesPackBusinessModeUpdateInput): SalesPackBusinessModeSnapshot {
    const preference = this.preferences.setBoolean({
      ...input,
      namespace: BUSINESS_MODE_NAMESPACE,
      key: BUSINESS_MODE_KEY,
      value: input.enabled,
      updatedBy: this.clean(input.updatedBy) || 'zavorthControl',
    });
    return {
      profileKey: preference.profileKey,
      userId: preference.userId,
      profileId: preference.profileId,
      enabled: preference.value,
      updatedAt: preference.updatedAt,
      updatedBy: preference.updatedBy,
      generatedAt: this.now().toISOString(),
      source: 'backend',
      receipts: [
        ...preference.receipts,
        'business-mode-preference-persisted-in-unified-local-profile-store',
        'business-mode-does-not-store-secrets',
      ],
    };
  }

  private readLegacyRecord(profileKey: string): SalesPackBusinessModeRecord | null {
    try {
      if (!fs.existsSync(this.legacyStateFilePath)) {
        return null;
      }
      const parsed = JSON.parse(fs.readFileSync(this.legacyStateFilePath, 'utf8')) as Partial<SalesPackBusinessModeLegacyStateFile>;
      const record = parsed.records?.[profileKey];
      if (!record || typeof record !== 'object') {
        return null;
      }
      return {
        profileKey: this.clean(record.profileKey) || profileKey,
        userId: this.clean(record.userId) || 'local-owner',
        profileId: this.clean(record.profileId) || 'default',
        enabled: record.enabled === true,
        updatedAt: this.clean(record.updatedAt) || this.now().toISOString(),
        updatedBy: this.clean(record.updatedBy) || 'legacy',
      };
    } catch (error: unknown) {logger.warn('[Sales Pack Business Mode] operation failed', error); return null; }
  }

  private clean(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
