import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthMarketplaceCategory,
  ZavorthMarketplaceIndexDocument,
  ZavorthMarketplaceInstallInput,
  ZavorthMarketplaceInstallResult,
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
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  constructor(runtime?: ZavorthSkillMarketplaceRuntime) {
    this.projectRoot = runtime?.projectRoot ?? config.projectRoot;
    this.existsSync = runtime?.existsSync ?? fs.existsSync;
    this.readFileSync = runtime?.readFileSync ?? fs.readFileSync;
    this.readdirSync = runtime?.readdirSync ?? fs.readdirSync;
    this.statSync = runtime?.statSync ?? fs.statSync;
    this.writeFileSync = runtime?.writeFileSync ?? fs.writeFileSync;
    this.mkdirSync = runtime?.mkdirSync ?? fs.mkdirSync;
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

  private readIndex(): ZavorthMarketplaceIndexDocument {
    if (!this.existsSync(this.marketplaceIndexPath)) {
      return { schemaVersion: 'zavorth.marketplace-index/v1', categories: [], remoteRegistry: null };
    }
    try {
      const raw = this.readFileSync(this.marketplaceIndexPath, 'utf8');
      return JSON.parse(raw) as ZavorthMarketplaceIndexDocument;
    } catch {
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
    } catch {
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
    } catch {
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

    if (this.existsSync(targetDir)) {
      warnings.push(`Skill already exists at imported location: ${skill.id}`);
      return { installed: true, skillPath: path.relative(this.projectRoot, targetDir), warnings };
    }

    try {
      this.mkdirSync(targetDir, { recursive: true });
      this.copyDirectory(sourceDir, targetDir);
      return { installed: true, skillPath: path.relative(this.projectRoot, targetDir), warnings };
    } catch (error) {
      return {
        installed: false,
        skillPath: '',
        warnings: [`Installation failed: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private copyDirectory(source: string, target: string): void {
    const entries = this.readdirSync(source, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);
      if (entry.isDirectory()) {
        this.mkdirSync(targetPath, { recursive: true });
        this.copyDirectory(sourcePath, targetPath);
      } else {
        const content = this.readFileSync(sourcePath);
        this.writeFileSync(targetPath, content);
      }
    }
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

