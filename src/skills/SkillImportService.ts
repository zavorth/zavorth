import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { config } from '../config/index.js';
import {
  SkillSourceRegistryService,
  type SkillSourceRegistryEntry,
} from '../services/SkillSourceRegistryService.js';
import { SkillTrustPolicyService } from '../services/SkillTrustPolicyService.js';
import { SkillLicenseClassifierService } from './SkillLicenseClassifierService.js';

import type { SkillOriginDocument } from './SkillCatalogContract.js';
import {
  SkillImportPreviewService,
  type SkillImportDetailedPreview,
  type SkillImportDetailedPreviewEntry,
} from './SkillImportPreviewService.js';

import { ImportAuditTrailService } from './ImportAuditTrailService.js';
import type { SkillImportAuditReference } from './SkillCatalogContract.js';type SkillImportServiceRuntime = {
  now?: () => Date;
  sourceRegistryService?: Pick<SkillSourceRegistryService, 'getSource'>;
  skillTrustPolicyService?: Pick<SkillTrustPolicyService, 'evaluateSource' | 'evaluateSkill'>;
  skillImportPreviewService?: Pick<SkillImportPreviewService, 'buildPreview'>;
  skillLicenseClassifierService?: Pick<SkillLicenseClassifierService, 'classifySkillDirectory'>;
  importAuditTrailService?: Pick<ImportAuditTrailService, 'recordPreview' | 'recordImport' | 'getTrailFilePath'>;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  lstatSync?: typeof fs.lstatSync;
  mkdirSync?: typeof fs.mkdirSync;
  rmSync?: typeof fs.rmSync;
  cpSync?: typeof fs.cpSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

export type SkillImportPreviewEntry = SkillImportDetailedPreviewEntry;
export type SkillImportPreview = SkillImportDetailedPreview;

export type SkillImportResult = SkillImportPreview & {
  importedCount: number;
  skippedCount: number;
  importedSkillNames: string[];
  importAudit: SkillImportAuditReference | null;
};

type SkillImportInput = {
  sourceId: string;
  destinationSourceId?: string;
  skillNames?: string[];
  overwrite?: boolean;
  sourceRootOverride?: string | null;
  sourceSurface?: 'skills' | 'skills_omni' | null;
};

export class SkillImportService {
  private readonly now: () => Date;
  private readonly sourceRegistry: Pick<SkillSourceRegistryService, 'getSource'>;
  private readonly trustPolicy: Pick<SkillTrustPolicyService, 'evaluateSource' | 'evaluateSkill'>;
  private readonly previewService: Pick<SkillImportPreviewService, 'buildPreview'>;
  private readonly licenseClassifier: Pick<SkillLicenseClassifierService, 'classifySkillDirectory'>;
  private readonly importAuditTrail: Pick<ImportAuditTrailService, 'recordPreview' | 'recordImport' | 'getTrailFilePath'>;
  private readonly projectRoot: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;
  private readonly statSyncImpl: typeof fs.statSync;
  private readonly lstatSyncImpl: typeof fs.lstatSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly rmSyncImpl: typeof fs.rmSync;
  private readonly cpSyncImpl: typeof fs.cpSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: SkillImportServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRegistry = runtime.sourceRegistryService || new SkillSourceRegistryService();
    this.trustPolicy = runtime.skillTrustPolicyService || new SkillTrustPolicyService();
    this.licenseClassifier = runtime.skillLicenseClassifierService || new SkillLicenseClassifierService();
    this.previewService = runtime.skillImportPreviewService || new SkillImportPreviewService({
      sourceRegistryService: this.sourceRegistry,
      skillTrustPolicyService: this.trustPolicy,
      skillLicenseClassifierService: this.licenseClassifier,
    });
    this.importAuditTrail = runtime.importAuditTrailService || new ImportAuditTrailService({
      now: this.now,
      projectRoot: runtime.projectRoot || config.projectRoot,
    });
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.statSyncImpl = runtime.statSync || fs.statSync.bind(fs);
    this.lstatSyncImpl = runtime.lstatSync || fs.lstatSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.rmSyncImpl = runtime.rmSync || fs.rmSync.bind(fs);
    this.cpSyncImpl = runtime.cpSync || fs.cpSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public previewImport(input: SkillImportInput): SkillImportPreview {
    const source = this.resolveSource(input.sourceId, input.sourceRootOverride, input.sourceSurface);
    const targetSource = this.requireDestinationSource(input.destinationSourceId || 'workspace-imported-library');
    const sourceDecision = this.trustPolicy.evaluateSource(source.id);

    if (!sourceDecision.allowed) {
      throw new Error(sourceDecision.reason);
    }

    const sourceSkillDirPaths = this.listSourceSkillDirs(source.absolutePath, input.skillNames);
    const preview = this.previewService.buildPreview({
      source,
      targetSource,
      sourceSkillDirPaths,
    });
    const previewAudit = this.importAuditTrail.recordPreview(preview);

    return {
      ...preview,
      entries: preview.entries.map((entry) => ({
        ...entry,
        alreadyImported: this.existsSyncImpl(entry.targetSkillDirPath),
      })),
      previewAudit,
    };
  }

  public importAllowedSkills(input: SkillImportInput): SkillImportResult {
    const preview = this.previewImport(input);
    const source = this.resolveSource(input.sourceId, input.sourceRootOverride, input.sourceSurface);
    const overwrite = input.overwrite === true;
    let importedCount = 0;
    let skippedCount = 0;
    const importedSkillNames: string[] = [];
    let importAudit: SkillImportAuditReference | null = null;

    this.mkdirSyncImpl(preview.targetRootPath, { recursive: true });

    for (const entry of preview.entries) {
      if (!entry.allowed) {
        skippedCount += 1;
        continue;
      }

      if (entry.alreadyImported && !overwrite) {
        skippedCount += 1;
        continue;
      }

      this.rmSyncImpl(entry.targetSkillDirPath, { recursive: true, force: true });
      this.mkdirSyncImpl(entry.targetSkillDirPath, { recursive: true });

      for (const relativePath of entry.importableFiles) {
        const sourceFilePath = path.join(entry.sourceSkillDirPath, relativePath);
        const targetFilePath = path.join(entry.targetSkillDirPath, relativePath);
        if (!this.isImportSourceFileAllowed(entry.sourceSkillDirPath, sourceFilePath)) {
          continue;
        }
        this.mkdirSyncImpl(path.dirname(targetFilePath), { recursive: true });
        this.cpSyncImpl(sourceFilePath, targetFilePath, { force: true });
      }

      this.writeOriginFiles(source, entry, {
        lastEventId: null,
        trailFilePath: this.importAuditTrail.getTrailFilePath(),
        lastAction: 'import',
        lastRecordedAt: this.now().toISOString(),
      });
      importedCount += 1;
      importedSkillNames.push(entry.skillName);
    }

    importAudit = this.importAuditTrail.recordImport(preview, importedCount, skippedCount);

    if (importAudit.lastEventId) {
      for (const entry of preview.entries) {
        if (!entry.allowed) {
          continue;
        }
        if (entry.alreadyImported && !overwrite) {
          continue;
        }
        this.writeOriginFiles(source, entry, importAudit);
      }
    }

    return {
      ...preview,
      importedCount,
      skippedCount,
      importedSkillNames,
      importAudit,
    };
  }

  private resolveSource(
    sourceId: string,
    sourceRootOverride?: string | null,
    sourceSurface?: 'skills' | 'skills_omni' | null,
  ): SkillSourceRegistryEntry {
    const source = this.requireSource(sourceId);
    this.assertSourceEnabled(source);
    const overrideRoot = String(sourceRootOverride || '').trim();
    const surface = sourceSurface || null;
    const absolutePath = overrideRoot
      ? path.resolve(overrideRoot)
      : this.resolveSourceAbsolutePath(source, surface);

    return {
      ...source,
      absolutePath,
    };
  }

  private resolveSourceAbsolutePath(
    source: SkillSourceRegistryEntry,
    sourceSurface: 'skills' | 'skills_omni' | null,
  ): string {
    if (this.existsSyncImpl(source.absolutePath)) {
      return sourceSurface ? path.join(source.absolutePath, sourceSurface) : source.absolutePath;
    }

    const candidates = [path.resolve(this.projectRoot, source.path)];

    for (const candidate of candidates) {
      const finalCandidate = sourceSurface ? path.join(candidate, sourceSurface) : candidate;
      if (this.existsSyncImpl(finalCandidate)) {
        return finalCandidate;
      }
    }

    return sourceSurface ? path.join(source.absolutePath, sourceSurface) : source.absolutePath;
  }

  private assertSourceEnabled(source: SkillSourceRegistryEntry): void {
    if (!source.enabled) {
      throw new Error(`Skill source ${source.id} is disabled and cannot be used for import.`);
    }

    if (source.kind !== 'workspace' && !source.pinnedRevision) {
      throw new Error(`External source ${source.id} must declare pinnedRevision before importing skills.`);
    }
  }

  private listSourceSkillDirs(sourceRootPath: string, requestedSkillNames: string[] | undefined): string[] {
    if (!this.existsSyncImpl(sourceRootPath)) {
      return [];
    }

    const requested = new Set(
      Array.isArray(requestedSkillNames)
        ? requestedSkillNames.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [],
    );

    return this.readdirSyncImpl(sourceRootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(sourceRootPath, entry.name))
      .filter((entryPath) => this.readSkillHeader(entryPath))
      .filter((entryPath) => requested.size === 0 || requested.has(path.basename(entryPath)))
      .sort((left, right) => path.basename(left).localeCompare(path.basename(right), 'en-US'));
  }

  private writeOriginFiles(
    source: SkillSourceRegistryEntry,
    previewEntry: SkillImportDetailedPreviewEntry,
    audit: SkillImportAuditReference | null,
  ): void {
    const importedAt = this.now().toISOString();
    const copiedFiles = this.collectCopiedFiles(previewEntry.targetSkillDirPath);
    const license = previewEntry.license || this.licenseClassifier.classifySkillDirectory(previewEntry.sourceSkillDirPath, source).license;
    const originRelativePath = this.buildOriginRelativePath(source.absolutePath, previewEntry.sourceSkillDirPath);
    const origin: SkillOriginDocument = {
      version: 1,
      importedAt,
      importMode: source.ingestionMode === 'allowlist-import' ? 'allowlist-import' : 'manual',
      skillName: previewEntry.skillName,
      source: {
        id: source.id,
        label: source.label,
        kind: source.kind,
        trust: source.trust,
        registrySource: source.registrySource,
        upstream: source.upstream,
        pinnedRevision: source.pinnedRevision,
        license,
        ownership: source.ownership,
      },
      originalSkillPath: originRelativePath,
      originalRelativePath: originRelativePath,
      copiedFiles,
      governance: {
        risk: previewEntry.risk,
        licensePolicy: previewEntry.licensePolicy,
        audit,
      },
    };

    this.writeFileSyncImpl(
      path.join(previewEntry.targetSkillDirPath, 'ORIGIN.json'),
      JSON.stringify(origin, null, 2),
      'utf8',
    );

    const upstreamAttribution = this.readOptionalTextFile(path.join(previewEntry.sourceSkillDirPath, 'ATTRIBUTION.md'));
    const upstreamOrigin = this.readOptionalTextFile(path.join(previewEntry.sourceSkillDirPath, 'ORIGIN.md'));
    this.writeFileSyncImpl(
      path.join(previewEntry.targetSkillDirPath, 'ATTRIBUTION.md'),
      [
        '# Attribution',
        '',
        'Imported by Zavorth from a curated external source.',
        '',
        `- Source: ${source.label} (\`${source.id}\`)`,
        `- Registry source: ${source.registrySource || 'n/a'}`,
        `- Upstream repository: ${source.upstream || 'n/a'}`,
        `- Pinned revision: ${source.pinnedRevision || 'n/a'}`,
        `- Classified license: ${license || 'n/a'}`,
        `- License policy: ${previewEntry.licensePolicy.label}`,
        `- Risk: ${previewEntry.risk.level} (${previewEntry.risk.score})`,
        `- Audit event: ${audit?.lastEventId || 'n/a'}`,
        `- Original skill path: ${originRelativePath}`,
        `- Imported at: ${importedAt}`,
        '',
        '## Upstream attribution',
        '',
        upstreamAttribution || upstreamOrigin || 'No upstream attribution was found in the source directory.',
      ].join('\n'),
      'utf8',
    );
  }

  private collectCopiedFiles(skillDirPath: string): string[] {
    const collected: string[] = [];
    const entries = this.readdirSyncImpl(skillDirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(skillDirPath, entry.name);
      if (entry.isDirectory()) {
        for (const nested of this.collectCopiedFiles(entryPath)) {
          collected.push(path.join(entry.name, nested).replace(/\\/g, '/'));
        }
        continue;
      }

      collected.push(entry.name);
    }

    return collected
      .filter((entry) => entry !== 'ORIGIN.json')
      .sort((left, right) => left.localeCompare(right, 'en-US'));
  }

  private isImportSourceFileAllowed(skillDirPath: string, sourceFilePath: string): boolean {
    const normalizedRoot = path.resolve(skillDirPath);
    const normalizedFile = path.resolve(sourceFilePath);
    const relative = path.relative(normalizedRoot, normalizedFile);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return false;
    }
    try {
      return this.lstatSyncImpl(normalizedFile).isFile();
    } catch (error: unknown) {return false;
    }
  }

  private buildOriginRelativePath(sourceRootPath: string, sourceSkillDirPath: string): string {
    const relative = path.relative(sourceRootPath, sourceSkillDirPath).replace(/\\/g, '/');
    const sourceRootName = path.basename(sourceRootPath);
    return relative ? `${sourceRootName}/${relative}` : sourceRootName;
  }

  private readOptionalTextFile(filePath: string): string {
    try {
      if (!this.existsSyncImpl(filePath)) {
        return '';
      }
      return this.readFileSyncImpl(filePath, 'utf8').trim();
    } catch (error: unknown) {return '';
    }
  }

  private readSkillHeader(skillDirPath: string): { name: string; description: string } | null {
    const skillFilePath = path.join(skillDirPath, 'SKILL.md');
    if (!this.existsSyncImpl(skillFilePath)) {
      return null;
    }

    const raw = this.readFileSyncImpl(skillFilePath, 'utf8').replace(/^\uFEFF/, '');
    const frontmatter = this.readFrontmatterFields(raw);
    if (!frontmatter) {
      return null;
    }
    if (!frontmatter?.name || !frontmatter?.description) {
      return null;
    }

    return {
      name: String(frontmatter.name).trim(),
      description: String(frontmatter.description).trim(),
    };
  }

  private readFrontmatterFields(raw: string): Record<string, string> | null {
    const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      return null;
    }

    const frontmatterBlock = match[1];
    try {
      const parsed = yaml.load(frontmatterBlock);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([key, value]) => [key, String(value ?? '').trim()]),
        );
      }
    } catch (error: unknown) {// fallback abaixo
    }

    const fields: Record<string, string> = {};
    for (const line of frontmatterBlock.split(/\r?\n/)) {
      const fieldMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
      if (!fieldMatch) {
        continue;
      }
      fields[fieldMatch[1]] = this.normalizeFrontmatterValue(fieldMatch[2]);
    }
    return fields;
  }

  private normalizeFrontmatterValue(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return '';
    }
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
    ) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, '\'').trim();
    }
    return trimmed.replace(/\\"/g, '"').replace(/\\'/g, '\'').trim();
  }

  private requireSource(sourceId: string): SkillSourceRegistryEntry {
    const source = this.sourceRegistry.getSource(sourceId);
    if (!source) {
      throw new Error(`Skill source not found: ${sourceId}`);
    }
    return source;
  }

  private requireDestinationSource(sourceId: string): SkillSourceRegistryEntry {
    const source = this.sourceRegistry.getSource(sourceId);
    if (!source) {
      return {
        id: sourceId,
        label: 'Workspace imported library',
        kind: 'workspace',
        trust: 'review',
        enabled: true,
        ingestionMode: 'local-scan',
        path: 'skill-library/imported',
        absolutePath: path.join(this.projectRoot, 'skill-library', 'imported'),
        createIfMissing: true,
        ownership: 'curated-import',
        registrySource: 'zavorth:curated-import',
        upstream: null,
        pinnedRevision: null,
        license: null,
        notes: [],
        allowedExternalSupportPaths: [],
        absoluteAllowedExternalSupportPaths: [],
      };
    }
    return source;
  }
}
