import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  SkillImportAuditReference,
} from './SkillCatalogContract.js';
import type {
  SkillImportDetailedPreview,
  SkillImportDetailedPreviewEntry,
} from './SkillImportPreviewService.js';

export type SkillImportAuditEvent = {
  id: string;
  kind: 'preview' | 'import';
  recordedAt: string;
  sourceId: string;
  sourceLabel: string;
  targetSourceId: string;
  targetRootPath: string;
  totalCandidates: number;
  allowedCount: number;
  blockedCount: number;
  safeCount: number;
  importedCount: number | null;
  skippedCount: number | null;
  skillNames: string[];
  allowedSkillNames: string[];
  blockedSkillNames: string[];
  governance: {
    highestRiskLevel: SkillImportDetailedPreviewEntry['risk']['level'];
    highestRiskScore: number;
    reviewRequiredCount: number;
    blockedByLicenseCount: number;
    licenseLabels: string[];
  };
  entries: Array<{
    skillName: string;
    allowed: boolean;
    license: string | null;
    licensePolicyLabel: SkillImportDetailedPreviewEntry['licensePolicy']['label'];
    riskLevel: SkillImportDetailedPreviewEntry['risk']['level'];
    riskScore: number;
  }>;
};

type SkillImportAuditTrailDocument = {
  version: number;
  updatedAt: string | null;
  events: SkillImportAuditEvent[];
};

type ImportAuditTrailRuntime = {
  now?: () => Date;
  projectRoot?: string;
  trailFilePath?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

export class ImportAuditTrailService {
  private readonly now: () => Date;
  private readonly trailFilePath: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;

  constructor(runtime: ImportAuditTrailRuntime = {}) {
    const projectRoot = runtime.projectRoot || config.projectRoot;
    this.now = runtime.now || (() => new Date());
    this.trailFilePath = runtime.trailFilePath
      || path.join(projectRoot, 'skill-library', 'imported', '.zavorth-import-audit.json');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public getTrailFilePath(): string {
    return this.trailFilePath;
  }

  public recordPreview(preview: SkillImportDetailedPreview): SkillImportAuditReference {
    return this.appendEvent('preview', preview, null, null);
  }

  public recordImport(
    preview: SkillImportDetailedPreview,
    importedCount: number,
    skippedCount: number,
  ): SkillImportAuditReference {
    return this.appendEvent('import', preview, importedCount, skippedCount);
  }

  public readHistory(): SkillImportAuditEvent[] {
    return this.readDocument().events.slice();
  }

  private appendEvent(
    kind: SkillImportAuditEvent['kind'],
    preview: SkillImportDetailedPreview,
    importedCount: number | null,
    skippedCount: number | null,
  ): SkillImportAuditReference {
    const recordedAt = this.now().toISOString();
    const document = this.readDocument();
    const event: SkillImportAuditEvent = {
      id: `${kind}-${recordedAt.replace(/[^0-9]/g, '').slice(0, 14)}-${document.events.length + 1}`,
      kind,
      recordedAt,
      sourceId: preview.sourceId,
      sourceLabel: preview.sourceLabel,
      targetSourceId: preview.targetSourceId,
      targetRootPath: preview.targetRootPath,
      totalCandidates: preview.totalCandidates,
      allowedCount: preview.allowedCount,
      blockedCount: preview.blockedCount,
      safeCount: preview.safeCount,
      importedCount,
      skippedCount,
      skillNames: preview.entries.map((entry) => entry.skillName),
      allowedSkillNames: preview.entries.filter((entry) => entry.allowed).map((entry) => entry.skillName),
      blockedSkillNames: preview.entries.filter((entry) => !entry.allowed).map((entry) => entry.skillName),
      governance: {
        highestRiskLevel: this.resolveHighestRiskLevel(preview.entries),
        highestRiskScore: preview.entries.reduce((max, entry) => Math.max(max, entry.risk.score), 0),
        reviewRequiredCount: preview.entries.filter((entry) => entry.risk.reviewRequired).length,
        blockedByLicenseCount: preview.entries.filter((entry) => !entry.licensePolicy.allowImport).length,
        licenseLabels: Array.from(new Set(preview.entries.map((entry) => entry.licensePolicy.label))).sort(),
      },
      entries: preview.entries.map((entry) => ({
        skillName: entry.skillName,
        allowed: entry.allowed,
        license: entry.license,
        licensePolicyLabel: entry.licensePolicy.label,
        riskLevel: entry.risk.level,
        riskScore: entry.risk.score,
      })),
    };

    const nextDocument: SkillImportAuditTrailDocument = {
      version: 1,
      updatedAt: recordedAt,
      events: [...document.events, event],
    };

    this.mkdirSyncImpl(path.dirname(this.trailFilePath), { recursive: true });
    this.writeFileSyncImpl(this.trailFilePath, JSON.stringify(nextDocument, null, 2), 'utf8');

    return {
      lastEventId: event.id,
      trailFilePath: this.trailFilePath,
      lastAction: kind,
      lastRecordedAt: recordedAt,
    };
  }

  private readDocument(): SkillImportAuditTrailDocument {
    try {
      if (!this.existsSyncImpl(this.trailFilePath)) {
        return {
          version: 1,
          updatedAt: null,
          events: [],
        };
      }

      const parsed = JSON.parse(this.readFileSyncImpl(this.trailFilePath, 'utf8')) as Partial<SkillImportAuditTrailDocument>;
      return {
        version: Number.isFinite(parsed.version) ? Number(parsed.version) : 1,
        updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim()
          ? parsed.updatedAt.trim()
          : null,
        events: Array.isArray(parsed.events) ? parsed.events as SkillImportAuditEvent[] : [],
      };
    } catch (error: any) { const err = error; const e = error;
      return {
        version: 1,
        updatedAt: null,
        events: [],
      };
    }
  }

  private resolveHighestRiskLevel(
    entries: SkillImportDetailedPreviewEntry[],
  ): SkillImportAuditEvent['governance']['highestRiskLevel'] {
    if (entries.some((entry) => entry.risk.level === 'blocked')) {
      return 'blocked';
    }
    if (entries.some((entry) => entry.risk.level === 'high')) {
      return 'high';
    }
    if (entries.some((entry) => entry.risk.level === 'medium')) {
      return 'medium';
    }
    return 'low';
  }
}
