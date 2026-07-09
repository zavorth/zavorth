import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { ZavorthLearningArtifact } from '../contracts/ZavorthMutationPlaneContract.js';
import type { ZavorthEvalDatasetManifest } from './ZavorthEvalControlPlaneService.js';
import { logger } from '../logger.js';

export type ReplayLearningKind =
  | 'preference'
  | 'procedure'
  | 'debug-pattern'
  | 'coding-style'
  | 'skill-candidate';

export type ReplayLearningStatus =
  | 'suggest_only'
  | 'waiting_approval'
  | 'approved'
  | 'revoked'
  | 'blocked';

export type ReplayLearningRecord = {
  id: string;
  kind: ReplayLearningKind;
  status: ReplayLearningStatus;
  createdAt: string;
  updatedAt: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  replayRef: string;
  summary: string;
  redactedEvidence: string;
  confidence: number;
  uses: string[];
  expiresAt: string | null;
  mutationPlanId: string | null;
  permissionId: string | null;
  artifact: ZavorthLearningArtifact;
  evalManifest: ZavorthEvalDatasetManifest;
  linkedSkillDraftId: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type DigitalTwinProfile = {
  version: 1;
  mode: 'suggest-only';
  updatedAt: string | null;
  localOnly: true;
  exportable: true;
  expiresAt: string | null;
  approvedRecordIds: string[];
  revokedRecordIds: string[];
  preferences: Array<{ id: string; summary: string; confidence: number; expiresAt: string | null }>;
  procedures: Array<{ id: string; summary: string; confidence: number; expiresAt: string | null }>;
  debugPatterns: Array<{ id: string; summary: string; confidence: number; expiresAt: string | null }>;
  codingStyle: Array<{ id: string; summary: string; confidence: number; expiresAt: string | null }>;
  skillCandidates: Array<{ id: string; summary: string; confidence: number; expiresAt: string | null }>;
  notes: string[];
};

export type ReplayLearningRegistryDocument = {
  version: 1;
  updatedAt: string | null;
  records: ReplayLearningRecord[];
  profile: DigitalTwinProfile;
};

type ReplayLearningRegistryRuntime = {
  registryFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthReplayLearningRegistryService {
  private readonly registryFile: string;
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: ReplayLearningRegistryRuntime = {}) {
    this.registryFile = runtime.registryFile || path.join(config.projectRoot, 'data', 'runtime', 'replay-learning', 'registry.json');
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readRegistry(): ReplayLearningRegistryDocument {
    try {
      if (!this.existsSyncImpl(this.registryFile)) {
        return this.emptyRegistry();
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.registryFile, 'utf8')) as Partial<ReplayLearningRegistryDocument>;
      return {
        version: 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        records: Array.isArray(parsed.records) ? parsed.records.map((entry) => this.normalizeRecord(entry)) : [],
        profile: this.normalizeProfile(parsed.profile),
      };
    } catch (error: any) {
    logger.warn('[Zavorth Replay Learning Registry] filesystem operation failed', error);
    return this.emptyRegistry();
  }
  }

  public listRecords(options: { limit?: number; includeRevoked?: boolean } = {}): ReplayLearningRecord[] {
    const limit = Math.max(1, Math.min(options.limit || 50, 200));
    return this.readRegistry().records
      .filter((entry) => options.includeRevoked === true || entry.status !== 'revoked')
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
      .slice(0, limit);
  }

  public readProfile(): DigitalTwinProfile {
    return this.readRegistry().profile;
  }

  public getRecord(id: string): ReplayLearningRecord | null {
    const normalized = this.normalizeToken(id);
    return this.readRegistry().records.find((entry) => entry.id === normalized) || null;
  }

  public upsertRecord(record: ReplayLearningRecord): ReplayLearningRecord {
    const registry = this.readRegistry();
    const normalized = this.normalizeRecord({
      ...record,
      updatedAt: this.now().toISOString(),
    });
    this.writeRegistry({
      version: 1,
      updatedAt: this.now().toISOString(),
      records: [...registry.records.filter((entry) => entry.id !== normalized.id), normalized],
      profile: registry.profile,
    });
    return normalized;
  }

  public updateRecord(id: string, update: (record: ReplayLearningRecord) => ReplayLearningRecord): ReplayLearningRecord {
    const current = this.getRecord(id);
    if (!current) {
      throw new Error(`Aprendizado nao encontrado: ${id || 'n/d'}.`);
    }
    return this.upsertRecord(update(current));
  }

  public saveProfile(profile: DigitalTwinProfile): DigitalTwinProfile {
    const registry = this.readRegistry();
    const normalized = this.normalizeProfile({
      ...profile,
      updatedAt: this.now().toISOString(),
    });
    this.writeRegistry({
      version: 1,
      updatedAt: this.now().toISOString(),
      records: registry.records,
      profile: normalized,
    });
    return normalized;
  }

  public deleteRecord(id: string, reason: string | null = null): ReplayLearningRecord {
    return this.updateRecord(id, (record) => ({
      ...record,
      status: 'revoked',
      revokedAt: this.now().toISOString(),
      revokedReason: reason || 'Revogado pelo operador.',
      artifact: {
        ...record.artifact,
        status: 'revoked',
        updatedAt: this.now().toISOString(),
      },
    }));
  }

  private writeRegistry(registry: ReplayLearningRegistryDocument): void {
    this.mkdirSyncImpl(path.dirname(this.registryFile), { recursive: true });
    this.writeFileSyncImpl(this.registryFile, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  }

  private emptyRegistry(): ReplayLearningRegistryDocument {
    return {
      version: 1,
      updatedAt: null,
      records: [],
      profile: this.normalizeProfile(null),
    };
  }

  private normalizeRecord(record: ReplayLearningRecord): ReplayLearningRecord {
    const now = this.now().toISOString();
    return {
      ...record,
      id: this.normalizeToken(record.id),
      kind: this.normalizeKind(record.kind),
      status: this.normalizeStatus(record.status),
      createdAt: String(record.createdAt || now),
      updatedAt: String(record.updatedAt || now),
      requestedBy: this.nullableText(record.requestedBy),
      sourceSurface: this.nullableText(record.sourceSurface),
      replayRef: String(record.replayRef || '').trim(),
      summary: String(record.summary || '').trim(),
      redactedEvidence: String(record.redactedEvidence || '').trim(),
      confidence: Math.max(0, Math.min(Number(record.confidence || 0), 1)),
      uses: Array.isArray(record.uses) ? record.uses.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
      expiresAt: this.nullableText(record.expiresAt),
      mutationPlanId: this.nullableText(record.mutationPlanId),
      permissionId: this.nullableText(record.permissionId),
      linkedSkillDraftId: this.nullableText(record.linkedSkillDraftId),
      revokedAt: this.nullableText(record.revokedAt),
      revokedReason: this.nullableText(record.revokedReason),
    };
  }

  private normalizeProfile(profile: Partial<DigitalTwinProfile> | null | undefined): DigitalTwinProfile {
    return {
      version: 1,
      mode: 'suggest-only',
      updatedAt: typeof profile?.updatedAt === 'string' ? profile.updatedAt : null,
      localOnly: true,
      exportable: true,
      expiresAt: this.nullableText(profile?.expiresAt),
      approvedRecordIds: this.stringList(profile?.approvedRecordIds),
      revokedRecordIds: this.stringList(profile?.revokedRecordIds),
      preferences: this.profileEntries(profile?.preferences),
      procedures: this.profileEntries(profile?.procedures),
      debugPatterns: this.profileEntries(profile?.debugPatterns),
      codingStyle: this.profileEntries(profile?.codingStyle),
      skillCandidates: this.profileEntries(profile?.skillCandidates),
      notes: this.stringList(profile?.notes),
    };
  }

  private profileEntries(value: unknown): DigitalTwinProfile['preferences'] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry: any) => ({
      id: this.normalizeToken(entry?.id),
      summary: String(entry?.summary || '').trim(),
      confidence: Math.max(0, Math.min(Number(entry?.confidence || 0), 1)),
      expiresAt: this.nullableText(entry?.expiresAt),
    })).filter((entry) => entry.id && entry.summary);
  }

  private normalizeKind(value: unknown): ReplayLearningKind {
    const normalized = String(value || '').trim();
    if (
      normalized === 'preference'
      || normalized === 'procedure'
      || normalized === 'debug-pattern'
      || normalized === 'coding-style'
      || normalized === 'skill-candidate'
    ) {
      return normalized;
    }
    return 'procedure';
  }

  private normalizeStatus(value: unknown): ReplayLearningStatus {
    const normalized = String(value || '').trim();
    if (
      normalized === 'suggest_only'
      || normalized === 'waiting_approval'
      || normalized === 'approved'
      || normalized === 'revoked'
      || normalized === 'blocked'
    ) {
      return normalized;
    }
    return 'suggest_only';
  }

  private stringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  private normalizeToken(value: unknown): string {
    return String(value || '').trim().replace(/[^a-zA-Z0-9_.:-]/g, '');
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
