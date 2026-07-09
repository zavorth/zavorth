import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
ZavorthLearningArtifact,
  ZavorthMutationRiskLevel,
} from '../contracts/ZavorthMutationPlaneContract.js';

export type ZavorthEvolvedSkillStatus =
  | 'draft'
  | 'sandbox_tested'
  | 'waiting_approval'
  | 'trusted_local'
  | 'blocked'
  | 'procedure_only'
  | 'rolled_back';

export type ZavorthEvolvedSkillRecord = {
  id: string;
  skillName: string;
  version: string;
  status: ZavorthEvolvedSkillStatus;
  kind: 'skill-draft' | 'procedure';
  createdAt: string;
  updatedAt: string;
  requestedBy: string | null;
  sourceSurface: string | null;
  intentHash: string;
  draftDirPath: string;
  targetDirPath: string | null;
  skillFilePath: string | null;
  riskLevel: ZavorthMutationRiskLevel;
  mutationPlanId: string | null;
  permissionId: string | null;
  sandboxEvidenceId: string | null;
  evalGateStatus: string | null;
  artifact: ZavorthLearningArtifact;
  rollback: {
    installedAt: string | null;
    targetDirPath: string | null;
    backupDirPath: string | null;
    policySnapshotBefore: Record<string, unknown> | null;
    policySnapshotAfter: Record<string, unknown> | null;
    rolledBackAt: string | null;
  };
  notes: string[];
};

export type ZavorthSkillEvolutionRegistryDocument = {
  version: 1;
  updatedAt: string | null;
  records: ZavorthEvolvedSkillRecord[];
};

type SkillEvolutionRegistryRuntime = {
  registryFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ZavorthSkillEvolutionRegistryService {
  private readonly registryFile: string;
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: SkillEvolutionRegistryRuntime = {}) {
    this.registryFile = runtime.registryFile || path.join(config.projectRoot, 'data', 'runtime', 'skill-evolution', 'registry.json');
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public readRegistry(): ZavorthSkillEvolutionRegistryDocument {
    try {
      if (!this.existsSyncImpl(this.registryFile)) {
        return { version: 1, updatedAt: null, records: [] };
      }
      const parsed = JSON.parse(this.readFileSyncImpl(this.registryFile, 'utf8')) as Partial<ZavorthSkillEvolutionRegistryDocument>;
      return {
        version: 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
        records: Array.isArray(parsed.records) ? parsed.records.map((entry) => this.normalizeRecord(entry)) : [],
      };
    } catch (error: unknown) {logger.warn('[Zavorth Skill Evolution Registry] JSON parse failed', error);
    return { version: 1, updatedAt: null, records: [] };
  }
  }

  public listRecords(options: { limit?: number } = {}): ZavorthEvolvedSkillRecord[] {
    const limit = Math.max(1, Math.min(options.limit || 50, 200));
    return this.readRegistry().records
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
      .slice(0, limit);
  }

  public getRecord(id: string): ZavorthEvolvedSkillRecord | null {
    const normalized = this.normalizeToken(id);
    return this.readRegistry().records.find((entry) => entry.id === normalized) || null;
  }

  public upsertRecord(record: ZavorthEvolvedSkillRecord): ZavorthEvolvedSkillRecord {
    const registry = this.readRegistry();
    const normalized = this.normalizeRecord({
      ...record,
      updatedAt: this.now().toISOString(),
    });
    const records = registry.records.filter((entry) => entry.id !== normalized.id);
    records.push(normalized);
    this.writeRegistry({
      version: 1,
      updatedAt: this.now().toISOString(),
      records,
    });
    return normalized;
  }

  public updateRecord(
    id: string,
    update: (record: ZavorthEvolvedSkillRecord) => ZavorthEvolvedSkillRecord,
  ): ZavorthEvolvedSkillRecord {
    const current = this.getRecord(id);
    if (!current) {
      throw new Error(`Skill evolution record nao encontrado: ${id || 'n/d'}.`);
    }
    return this.upsertRecord(update(current));
  }

  private writeRegistry(registry: ZavorthSkillEvolutionRegistryDocument): void {
    this.mkdirSyncImpl(path.dirname(this.registryFile), { recursive: true });
    this.writeFileSyncImpl(this.registryFile, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  }

  private normalizeRecord(record: ZavorthEvolvedSkillRecord): ZavorthEvolvedSkillRecord {
    const now = this.now().toISOString();
    return {
      ...record,
      id: this.normalizeToken(record.id),
      skillName: this.normalizeSkillName(record.skillName),
      version: String(record.version || '0.1.0').trim() || '0.1.0',
      status: this.normalizeStatus(record.status),
      kind: record.kind === 'procedure' ? 'procedure' : 'skill-draft',
      createdAt: String(record.createdAt || now),
      updatedAt: String(record.updatedAt || now),
      requestedBy: this.nullableText(record.requestedBy),
      sourceSurface: this.nullableText(record.sourceSurface),
      intentHash: String(record.intentHash || '').trim(),
      draftDirPath: String(record.draftDirPath || '').trim(),
      targetDirPath: this.nullableText(record.targetDirPath),
      skillFilePath: this.nullableText(record.skillFilePath),
      riskLevel: this.normalizeRisk(record.riskLevel),
      mutationPlanId: this.nullableText(record.mutationPlanId),
      permissionId: this.nullableText(record.permissionId),
      sandboxEvidenceId: this.nullableText(record.sandboxEvidenceId),
      evalGateStatus: this.nullableText(record.evalGateStatus),
      rollback: {
        installedAt: this.nullableText(record.rollback?.installedAt),
        targetDirPath: this.nullableText(record.rollback?.targetDirPath),
        backupDirPath: this.nullableText(record.rollback?.backupDirPath),
        policySnapshotBefore: record.rollback?.policySnapshotBefore || null,
        policySnapshotAfter: record.rollback?.policySnapshotAfter || null,
        rolledBackAt: this.nullableText(record.rollback?.rolledBackAt),
      },
      notes: Array.isArray(record.notes) ? record.notes.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
    };
  }

  private normalizeStatus(value: unknown): ZavorthEvolvedSkillStatus {
    const normalized = String(value || '').trim();
    if (
      normalized === 'draft'
      || normalized === 'sandbox_tested'
      || normalized === 'waiting_approval'
      || normalized === 'trusted_local'
      || normalized === 'blocked'
      || normalized === 'procedure_only'
      || normalized === 'rolled_back'
    ) {
      return normalized;
    }
    return 'draft';
  }

  private normalizeRisk(value: unknown): ZavorthMutationRiskLevel {
    const normalized = String(value || '').trim();
    if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
      return normalized;
    }
    return 'medium';
  }

  private normalizeSkillName(value: unknown): string {
    return String(value || 'learned-skill')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'learned-skill';
  }

  private normalizeToken(value: unknown): string {
    return String(value || '')
      .trim()
      .replace(/[^a-zA-Z0-9_.:-]/g, '');
  }

  private nullableText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
