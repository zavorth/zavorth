import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { config } from '../config/index.js';
import { logger } from '../logger.js';
import { SkillHubGuardService } from '../skills/SkillHubGuardService.js';
import type {
  ZavorthMarketplaceCategory,
  ZavorthMarketplaceIndexDocument,
  ZavorthMarketplaceInstallInput,
  ZavorthMarketplaceInstallResult,
  ZavorthMarketplaceRemoteRegistryDocument,
  ZavorthMarketplaceRemoteRegistryVerification,
  ZavorthMarketplaceRemoteSkillEntry,
  ZavorthMarketplaceSearchInput,
  ZavorthMarketplaceSearchResult,
  ZavorthMarketplaceSkillEntry,
  ZavorthMarketplaceSortMode,
  ZavorthMarketplaceStats,
} from '../contracts/ZavorthSkillMarketplaceContract.js';

type NativeSkillManifest = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  trust?: string;
  native?: boolean;
  curatedBy?: string;
  contractVersion?: string;
  updatedAt?: string;
  source?: string;
  permissionProfileId?: string;
  riskLevel?: string;
  capabilityTags?: string[];
  presets?: string[];
  safeMetadataApply?: boolean;
  noExecutionByDefault?: boolean;
  requiresPolicyBroker?: boolean;
  receiptsRequired?: boolean;
};

type ZavorthSkillMarketplaceRuntime = {
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  readdirSync?: typeof fs.readdirSync;
  statSync?: typeof fs.statSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  skillHubGuardService?: Pick<SkillHubGuardService, 'evaluateSkillDirectory'>;
  now?: () => Date;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashObject(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeHash(value: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('sha256:') ? normalized : `sha256:${normalized}`;
}

export class ZavorthSkillMarketplaceService {
  private static readonly CATEGORY_ALIASES: Record<string, string[]> = {
    development: ['development', 'engineering', 'workspace', 'reasoning'],
    research: ['research', 'ai', 'ai-safety'],
    productivity: ['productivity', 'onboarding', 'memory'],
    media: ['media', 'design', 'creative'],
    security: ['security'],
    devops: ['devops', 'operations', 'cloud', 'monitoring', 'orchestration', 'edge-computing', 'providers'],
    communication: ['communication', 'channels', 'marketing'],
    data: ['data', 'data-engineering', 'data-science', 'database', 'big-data', 'ml', 'finance', 'blockchain', 'smart-home', 'physical-ai'],
  };

  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly statSync: typeof fs.statSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly guard: Pick<SkillHubGuardService, 'evaluateSkillDirectory'>;
  private readonly now: () => Date;
  private readonly trustedPublisherIds: Set<string>;

  constructor(runtime?: ZavorthSkillMarketplaceRuntime) {
    this.projectRoot = runtime?.projectRoot ?? config.projectRoot;
    this.existsSync = runtime?.existsSync ?? fs.existsSync;
    this.readFileSync = runtime?.readFileSync ?? fs.readFileSync;
    this.readdirSync = runtime?.readdirSync ?? fs.readdirSync;
    this.statSync = runtime?.statSync ?? fs.statSync;
    this.writeFileSync = runtime?.writeFileSync ?? fs.writeFileSync;
    this.mkdirSync = runtime?.mkdirSync ?? fs.mkdirSync;
    this.guard = runtime?.skillHubGuardService ?? new SkillHubGuardService();
    this.now = runtime?.now ?? (() => new Date());
    this.trustedPublisherIds = new Set(['@zavorth-official', 'registry:zavorth']);
  }

  private get nativeSkillsDir(): string {
    return path.join(this.projectRoot, 'skill-library', 'native');
  }

  private get marketplaceIndexPath(): string {
    return path.join(this.projectRoot, 'config', 'marketplace-index.json');
  }

  private get ratingsPath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'marketplace-ratings.json');
  }

  private get lockPath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'marketplace-lock.json');
  }

  private get auditPath(): string {
    return path.join(this.projectRoot, 'data', 'runtime', 'marketplace-audit.log');
  }

  private readIndex(): ZavorthMarketplaceIndexDocument {
    if (!this.existsSync(this.marketplaceIndexPath)) {
      return { schemaVersion: 'zavorth.marketplace-index/v1', categories: [], remoteRegistry: null };
    }
    try {
      const raw = this.readFileSync(this.marketplaceIndexPath, 'utf8');
      return JSON.parse(raw) as ZavorthMarketplaceIndexDocument;
    } catch (error: unknown) {logger.warn('[Marketplace] Failed to parse marketplace index, returning defaults', { error });
      return { schemaVersion: 'zavorth.marketplace-index/v1', categories: [], remoteRegistry: null };
    }
  }

  private readRatings(): Record<string, { total: number; count: number }> {
    if (!this.existsSync(this.ratingsPath)) {
      return {};
    }
    try {
      const raw = this.readFileSync(this.ratingsPath, 'utf8');
      return JSON.parse(raw) as Record<string, { total: number; count: number }>;
    } catch (error: unknown) {logger.warn('[Marketplace] Failed to parse ratings file, returning empty ratings', { error });
      return {};
    }
  }

  private writeRatings(ratings: Record<string, { total: number; count: number }>): void {
    const dir = path.dirname(this.ratingsPath);
    if (!this.existsSync(dir)) {
      this.mkdirSync(dir, { recursive: true });
    }
    this.writeFileSync(this.ratingsPath, JSON.stringify(ratings, null, 2), 'utf8');
  }

  private readNativeSkillManifest(skillDir: string): NativeSkillManifest | null {
    const manifestPath = path.join(skillDir, 'ZAVORTH_NATIVE_SKILL.json');
    if (!this.existsSync(manifestPath)) {
      return null;
    }
    try {
      const raw = this.readFileSync(manifestPath, 'utf8');
      return JSON.parse(raw) as NativeSkillManifest;
    } catch (error: unknown) {logger.warn(`[Marketplace] Failed to parse native skill manifest at ${manifestPath}`, { error });
      return null;
    }
  }

  private discoverNativeSkills(): ZavorthMarketplaceSkillEntry[] {
    if (!this.existsSync(this.nativeSkillsDir)) {
      return [];
    }

    const entries = this.readdirSync(this.nativeSkillsDir, { withFileTypes: true });
    const ratings = this.readRatings();
    const skills: ZavorthMarketplaceSkillEntry[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillDir = path.join(this.nativeSkillsDir, entry.name);
      const manifest = this.readNativeSkillManifest(skillDir);
      if (!manifest) continue;

      const id = manifest.id || entry.name;
      const ratingData = ratings[id];
      const averageRating = ratingData ? Math.round((ratingData.total / ratingData.count) * 10) / 10 : 0;

      const updatedAt = manifest.updatedAt || new Date().toISOString();

      skills.push({
        id,
        name: manifest.title || manifest.name || entry.name,
        description: manifest.description || '',
        author: manifest.curatedBy || 'zavorth',
        version: manifest.contractVersion || '1.0.0',
        license: manifest.trust === 'trusted' ? 'Zavorth-Internal' : 'Unknown',
        category: manifest.category || 'uncategorized',
        tags: manifest.tags || [],
        downloads: 0,
        rating: averageRating,
        updatedAt: updatedAt || new Date().toISOString(),
        sourceUrl: null,
        skillPath: path.relative(this.projectRoot, skillDir),
      });
    }

    return skills;
  }

  private sortEntries(entries: ZavorthMarketplaceSkillEntry[], sort: ZavorthMarketplaceSortMode): ZavorthMarketplaceSkillEntry[] {
    const sorted = [...entries];
    switch (sort) {
      case 'popular':
        sorted.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'recent':
        sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
    }
    return sorted;
  }

  listCategories(): ZavorthMarketplaceCategory[] {
    const index = this.readIndex();
    const skills = this.discoverNativeSkills();

    return index.categories.map((cat) => ({
      ...cat,
      skillCount: this.countSkillsForCategory(skills, cat.id) || cat.skillCount || 0,
    }));
  }

  search(input: ZavorthMarketplaceSearchInput): ZavorthMarketplaceSearchResult {
    const pageSize = input.limit || 20;
    let entries = this.discoverNativeSkills();

    if (input.query) {
      const pattern = new RegExp(escapeRegExp(input.query), 'i');
      entries = entries.filter(
        (entry) =>
          pattern.test(entry.name) ||
          pattern.test(entry.description) ||
          pattern.test(entry.id) ||
          entry.tags.some((tag) => pattern.test(tag)),
      );
    }

    if (input.category) {
      const categoryAliases = new Set(this.resolveMarketplaceCategoryAliases(input.category));
      entries = entries.filter((entry) => categoryAliases.has(entry.category));
    }

    if (input.tags && input.tags.length > 0) {
      entries = entries.filter((entry) =>
        input.tags!.some((tag) => entry.tags.includes(tag)),
      );
    }

    const sortMode = input.sort || 'popular';
    entries = this.sortEntries(entries, sortMode);

    return {
      entries: entries.slice(0, pageSize),
      total: entries.length,
      page: 1,
      pageSize,
    };
  }

  private countSkillsForCategory(skills: ZavorthMarketplaceSkillEntry[], categoryId: string): number {
    const categoryAliases = new Set(this.resolveMarketplaceCategoryAliases(categoryId));
    return skills.filter((skill) => categoryAliases.has(skill.category)).length;
  }

  private resolveMarketplaceCategoryAliases(categoryId: string): string[] {
    const normalized = String(categoryId || '').trim();
    if (!normalized) {
      return [];
    }

    return ZavorthSkillMarketplaceService.CATEGORY_ALIASES[normalized] || [normalized];
  }

  getSkill(id: string): ZavorthMarketplaceSkillEntry | null {
    const skills = this.discoverNativeSkills();
    return skills.find((entry) => entry.id === id) || null;
  }

  buildRemoteEntrySignature(entry: Pick<ZavorthMarketplaceRemoteSkillEntry, 'id' | 'version' | 'publisherId' | 'sourceUrl' | 'packageHash'>): string {
    return `sha256:${hashObject({
      id: entry.id,
      version: entry.version,
      publisherId: entry.publisherId,
      sourceUrl: entry.sourceUrl,
      packageHash: normalizeHash(entry.packageHash),
    })}`;
  }

  verifyRemoteRegistry(document: ZavorthMarketplaceRemoteRegistryDocument): ZavorthMarketplaceRemoteRegistryVerification {
    const revoked = new Set((document.revokedVersions || []).map((entry) => `${entry.skillId}@${entry.version}`));
    const issues: ZavorthMarketplaceRemoteRegistryVerification['issues'] = [];

    for (const entry of document.entries || []) {
      const skillId = entry.id || 'unknown-skill';
      if (!this.trustedPublisherIds.has(entry.publisherId) && entry.trustLevel !== 'community') {
        issues.push({
          skillId,
          severity: 'error',
          code: 'untrusted-publisher',
          message: `Publisher ${entry.publisherId || 'unknown'} is not trusted.`,
        });
      }
      if (!entry.signature) {
        issues.push({ skillId, severity: 'error', code: 'unsigned', message: 'Remote skill entry is unsigned.' });
      }
      if (!/^sha256:[a-f0-9]{64}$/i.test(entry.packageHash || '')) {
        issues.push({ skillId, severity: 'error', code: 'invalid-hash', message: 'Remote skill entry must include a sha256 package hash.' });
      }
      if (entry.sourceUrl && !/^https:\/\//i.test(entry.sourceUrl)) {
        issues.push({ skillId, severity: 'error', code: 'insecure-source-url', message: 'Remote skill packages must use HTTPS URLs.' });
      }
      if (entry.signature && entry.signature !== this.buildRemoteEntrySignature(entry)) {
        issues.push({ skillId, severity: 'error', code: 'invalid-signature', message: 'Remote skill signature does not match the signed manifest payload.' });
      }
      if (revoked.has(`${entry.id}@${entry.version}`)) {
        issues.push({ skillId, severity: 'error', code: 'revoked-version', message: `Remote skill version ${entry.version} has been revoked.` });
      }
      if (entry.trustLevel === 'community') {
        issues.push({ skillId, severity: 'warn', code: 'untrusted-publisher', message: 'Community skill must remain quarantined until reviewed.' });
      }
    }

    const blockedSkillIds = new Set(issues.filter((issue) => issue.severity === 'error').map((issue) => issue.skillId));
    return {
      trusted: blockedSkillIds.size === 0,
      totalEntries: document.entries.length,
      trustedEntries: document.entries.length - blockedSkillIds.size,
      blockedEntries: blockedSkillIds.size,
      issues,
    };
  }

  installSkill(input: ZavorthMarketplaceInstallInput): ZavorthMarketplaceInstallResult {
    const skill = this.getSkill(input.skillId);
    if (!skill) {
      return { installed: false, skillPath: '', warnings: [`Skill not found: ${input.skillId}`] };
    }

    const sourceDir = path.join(this.projectRoot, skill.skillPath);
    if (!this.existsSync(sourceDir)) {
      return { installed: false, skillPath: '', warnings: [`Skill directory not found: ${skill.skillPath}`] };
    }

    const targetDir = path.join(this.projectRoot, 'skill-library', 'imported', skill.id);
    const warnings: string[] = [];
    const guard = this.guard.evaluateSkillDirectory({
      skillDirPath: sourceDir,
      sourceTrust: 'trusted',
    });

    if (guard.decision === 'block') {
      this.recordMarketplaceAudit({
        action: 'install',
        skillId: skill.id,
        installed: false,
        sourcePath: path.relative(this.projectRoot, sourceDir),
        targetPath: path.relative(this.projectRoot, targetDir),
        guardDecision: guard.decision,
        guardVerdict: guard.verdict,
        importableFiles: guard.scan.importableFiles,
        skippedFiles: guard.scan.skippedFiles,
        warnings: guard.reasons,
      });
      return {
        installed: false,
        skillPath: '',
        warnings: [`Skill blocked by marketplace guard: ${guard.reasons.join(' ')}`],
      };
    }

    if (guard.decision === 'review') {
      warnings.push(`Skill installed selectively after guard review: ${guard.reasons.join(' ')}`);
    }

    if (this.existsSync(targetDir)) {
      warnings.push(`Skill already exists at imported location: ${skill.id}`);
      return { installed: true, skillPath: path.relative(this.projectRoot, targetDir), warnings };
    }

    try {
      this.mkdirSync(targetDir, { recursive: true });
      this.copySelectedFiles(sourceDir, targetDir, guard.scan.importableFiles);
      this.writeMarketplaceLock({
        skillId: skill.id,
        sourcePath: path.relative(this.projectRoot, sourceDir),
        targetPath: path.relative(this.projectRoot, targetDir),
        copiedFiles: guard.scan.importableFiles,
        skippedFiles: guard.scan.skippedFiles,
        guardDecision: guard.decision,
        guardVerdict: guard.verdict,
      });
      this.recordMarketplaceAudit({
        action: 'install',
        skillId: skill.id,
        installed: true,
        sourcePath: path.relative(this.projectRoot, sourceDir),
        targetPath: path.relative(this.projectRoot, targetDir),
        guardDecision: guard.decision,
        guardVerdict: guard.verdict,
        importableFiles: guard.scan.importableFiles,
        skippedFiles: guard.scan.skippedFiles,
        warnings,
      });
      return { installed: true, skillPath: path.relative(this.projectRoot, targetDir), warnings };
    } catch (error: unknown) {
      logger.warn('[Zavorth Skill Marketplace] operation failed', error);
    return {
        installed: false,
        skillPath: '',
        warnings: [`Installation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
  }
  }

  private copySelectedFiles(source: string, target: string, relativeFiles: string[]): void {
    for (const relativeFile of relativeFiles) {
      const normalized = relativeFile.replace(/\\/g, '/');
      const sourcePath = path.join(source, normalized);
      const targetPath = path.join(target, normalized);
      this.mkdirSync(path.dirname(targetPath), { recursive: true });
      this.writeFileSync(targetPath, this.readFileSync(sourcePath));
    }
  }

  private writeMarketplaceLock(entry: {
    skillId: string;
    sourcePath: string;
    targetPath: string;
    copiedFiles: string[];
    skippedFiles: string[];
    guardDecision: string;
    guardVerdict: string;
  }): void {
    const dir = path.dirname(this.lockPath);
    if (!this.existsSync(dir)) {
      this.mkdirSync(dir, { recursive: true });
    }
    const current = this.readMarketplaceLock();
    current[entry.skillId] = {
      ...entry,
      installedAt: this.now().toISOString(),
      contentHash: hashObject({
        sourcePath: entry.sourcePath,
        copiedFiles: entry.copiedFiles,
        skippedFiles: entry.skippedFiles,
      }),
    };
    this.writeFileSync(this.lockPath, JSON.stringify(current, null, 2), 'utf8');
  }

  private readMarketplaceLock(): Record<string, unknown> {
    if (!this.existsSync(this.lockPath)) {
      return {};
    }
    try {
      return JSON.parse(this.readFileSync(this.lockPath, 'utf8')) as Record<string, unknown>;
    } catch (error: unknown) {logger.warn('[Marketplace] Failed to parse lock file, returning empty lock', { error });
      return {};
    }
  }

  private recordMarketplaceAudit(entry: {
    action: 'install';
    skillId: string;
    installed: boolean;
    sourcePath: string;
    targetPath: string;
    guardDecision: string;
    guardVerdict: string;
    importableFiles: string[];
    skippedFiles: string[];
    warnings: string[];
  }): void {
    const dir = path.dirname(this.auditPath);
    if (!this.existsSync(dir)) {
      this.mkdirSync(dir, { recursive: true });
    }
    const event = {
      ...entry,
      recordedAt: this.now().toISOString(),
      receiptId: `marketplace-${hashObject(entry).slice(0, 16)}`,
      noExecutionPerformed: true,
      selectiveImportOnly: true,
    };
    const existing = this.existsSync(this.auditPath) ? this.readFileSync(this.auditPath, 'utf8') : '';
    this.writeFileSync(this.auditPath, `${existing}${JSON.stringify(event)}\n`, 'utf8');
  }

  rateSkill(id: string, rating: number): boolean {
    if (rating < 1 || rating > 5) return false;
    const skill = this.getSkill(id);
    if (!skill) return false;

    const ratings = this.readRatings();
    const existing = ratings[id] || { total: 0, count: 0 };
    ratings[id] = { total: existing.total + rating, count: existing.count + 1 };
    this.writeRatings(ratings);
    return true;
  }

  getStats(): ZavorthMarketplaceStats {
    const skills = this.discoverNativeSkills();
    const ratings = this.readRatings();
    const index = this.readIndex();

    const totalDownloads = skills.reduce((sum, entry) => sum + entry.downloads, 0);
    const ratedSkills = skills.filter((entry) => entry.rating > 0);
    const averageRating =
      ratedSkills.length > 0
        ? Math.round((ratedSkills.reduce((sum, entry) => sum + entry.rating, 0) / ratedSkills.length) * 10) / 10
        : 0;

    const lastUpdated =
      skills.length > 0
        ? skills.reduce((latest, entry) => (entry.updatedAt > latest ? entry.updatedAt : latest), skills[0].updatedAt)
        : new Date().toISOString();

    return {
      totalSkills: skills.length,
      totalCategories: index.categories.length,
      totalDownloads,
      averageRating,
      lastUpdated,
    };
  }
}
