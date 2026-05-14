import fs from 'fs';
import path from 'path';
import type { SkillSourceRegistryEntry } from '../services/SkillSourceRegistryService.js';
import type {
  SkillImportAuditReference,
  SkillLicensePolicyDecision,
  SkillOriginDocument,
  SkillProvenanceMetadata,
  SkillRiskAssessment,
} from './SkillCatalogContract.js';

type SkillProvenanceRuntime = {
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class SkillProvenanceService {
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: SkillProvenanceRuntime = {}) {
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public buildProvenance(
    source: SkillSourceRegistryEntry,
    skillDirPath: string,
  ): SkillProvenanceMetadata {
    const originDocumentPath = path.join(skillDirPath, 'ORIGIN.json');
    const origin = this.readOriginDocument(originDocumentPath);
    const attributionFilePath = this.resolveAttributionFilePath(skillDirPath);
    const imported = Boolean(origin);

    return {
      sourceId: source.id || null,
      sourceLabel: source.label || null,
      sourceKind: source.kind || null,
      sourceTrust: source.trust || null,
      registrySource: source.registrySource || null,
      ownership: source.ownership || null,
      license: origin?.source.license || source.license || null,
      importMode: imported ? 'imported-copy' : source.ingestionMode || 'unknown',
      imported,
      importedAt: origin?.importedAt || null,
      originDocumentPath: imported ? originDocumentPath : null,
      attributionFilePath,
      upstreamSourceId: origin?.source.id || null,
      upstreamSourceLabel: origin?.source.label || null,
      upstreamSourceKind: origin?.source.kind || null,
      upstreamSourceTrust: origin?.source.trust || null,
      upstreamRegistrySource: origin?.source.registrySource || null,
      upstreamRepository: origin?.source.upstream || null,
      upstreamLicense: origin?.source.license || null,
      upstreamSkillPath: origin?.originalSkillPath || null,
      upstreamRelativePath: origin?.originalRelativePath || null,
      risk: this.normalizeRisk(origin?.governance?.risk),
      licensePolicy: this.normalizeLicensePolicy(origin?.governance?.licensePolicy),
      audit: this.normalizeAudit(origin?.governance?.audit),
    };
  }

  public readOriginDocument(originFilePath: string): SkillOriginDocument | null {
    try {
      if (!this.existsSyncImpl(originFilePath)) {
        return null;
      }

      const raw = JSON.parse(this.readFileSyncImpl(originFilePath, 'utf8')) as Partial<SkillOriginDocument>;
      if (!raw || typeof raw !== 'object' || !raw.source || typeof raw.source !== 'object') {
        return null;
      }

      const source = raw.source;
      const kind = source.kind === 'workspace'
        || source.kind === 'repository'
        || source.kind === 'catalog'
        || source.kind === 'vendor'
        ? source.kind
        : 'repository';
      const trust = source.trust === 'trusted'
        || source.trust === 'review'
        || source.trust === 'blocked'
        ? source.trust
        : 'review';
      const importMode = raw.importMode === 'allowlist-import' || raw.importMode === 'manual'
        ? raw.importMode
        : 'manual';

      return {
        version: Number.isFinite(raw.version) ? Number(raw.version) : 1,
        importedAt: typeof raw.importedAt === 'string' && raw.importedAt.trim()
          ? raw.importedAt.trim()
          : null,
        importMode,
        skillName: typeof raw.skillName === 'string' && raw.skillName.trim()
          ? raw.skillName.trim()
          : '',
        source: {
          id: typeof source.id === 'string' ? source.id.trim() : '',
          label: typeof source.label === 'string' ? source.label.trim() : '',
          kind,
          trust,
          registrySource: typeof source.registrySource === 'string' && source.registrySource.trim()
            ? source.registrySource.trim()
            : null,
          upstream: typeof source.upstream === 'string' && source.upstream.trim()
            ? source.upstream.trim()
            : null,
          pinnedRevision: typeof source.pinnedRevision === 'string' && source.pinnedRevision.trim()
            ? source.pinnedRevision.trim()
            : null,
          license: typeof source.license === 'string' && source.license.trim()
            ? source.license.trim()
            : null,
          ownership: typeof source.ownership === 'string' && source.ownership.trim()
            ? source.ownership.trim()
            : null,
        },
        originalSkillPath: typeof raw.originalSkillPath === 'string' && raw.originalSkillPath.trim()
          ? raw.originalSkillPath.trim()
          : null,
        originalRelativePath: typeof raw.originalRelativePath === 'string' && raw.originalRelativePath.trim()
          ? raw.originalRelativePath.trim()
          : null,
        copiedFiles: Array.isArray(raw.copiedFiles)
          ? raw.copiedFiles
              .map((entry) => String(entry || '').trim())
              .filter(Boolean)
          : [],
        governance: {
          risk: this.normalizeRisk(raw.governance?.risk),
          licensePolicy: this.normalizeLicensePolicy(raw.governance?.licensePolicy),
          audit: this.normalizeAudit(raw.governance?.audit),
        },
      };
    } catch {
      return null;
    }
  }

  private normalizeRisk(value: unknown): SkillRiskAssessment | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SkillRiskAssessment>;
    const level = candidate.level === 'low'
      || candidate.level === 'medium'
      || candidate.level === 'high'
      || candidate.level === 'blocked'
      ? candidate.level
      : null;
    if (!level) {
      return null;
    }

    return {
      score: Number.isFinite(candidate.score) ? Number(candidate.score) : 0,
      level,
      reviewRequired: candidate.reviewRequired === true,
      reasons: Array.isArray(candidate.reasons)
        ? candidate.reasons.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [],
    };
  }

  private normalizeLicensePolicy(value: unknown): SkillLicensePolicyDecision | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SkillLicensePolicyDecision>;
    const label = candidate.label === 'permissive'
      || candidate.label === 'attribution'
      || candidate.label === 'reciprocal'
      || candidate.label === 'review'
      || candidate.label === 'restricted'
      || candidate.label === 'unknown'
      ? candidate.label
      : null;
    if (!label) {
      return null;
    }

    return {
      label,
      allowImport: candidate.allowImport !== false,
      allowRuntimeUse: candidate.allowRuntimeUse !== false,
      allowCoreCopy: candidate.allowCoreCopy === true,
      reviewRequired: candidate.reviewRequired === true,
      summary: typeof candidate.summary === 'string' ? candidate.summary.trim() : '',
    };
  }

  private normalizeAudit(value: unknown): SkillImportAuditReference | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const candidate = value as Partial<SkillImportAuditReference>;
    return {
      lastEventId: typeof candidate.lastEventId === 'string' && candidate.lastEventId.trim()
        ? candidate.lastEventId.trim()
        : null,
      trailFilePath: typeof candidate.trailFilePath === 'string' && candidate.trailFilePath.trim()
        ? candidate.trailFilePath.trim()
        : null,
      lastAction: candidate.lastAction === 'preview' || candidate.lastAction === 'import'
        ? candidate.lastAction
        : null,
      lastRecordedAt: typeof candidate.lastRecordedAt === 'string' && candidate.lastRecordedAt.trim()
        ? candidate.lastRecordedAt.trim()
        : null,
    };
  }

  private resolveAttributionFilePath(skillDirPath: string): string | null {
    const candidates = ['ATTRIBUTION.md', 'ATTRIBUTION.txt'];
    for (const fileName of candidates) {
      const filePath = path.join(skillDirPath, fileName);
      if (this.existsSyncImpl(filePath)) {
        return filePath;
      }
    }
    return null;
  }
}
