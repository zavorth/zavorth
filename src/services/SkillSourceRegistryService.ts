import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type SkillSourceKind = 'workspace' | 'repository' | 'catalog' | 'vendor';
export type SkillSourceTrust = 'trusted' | 'review' | 'blocked';
export type SkillSourceIngestionMode = 'local-scan' | 'allowlist-import' | 'manual';

export type SkillSourceRegistryEntry = {
  id: string;
  label: string;
  kind: SkillSourceKind;
  trust: SkillSourceTrust;
  enabled: boolean;
  ingestionMode: SkillSourceIngestionMode;
  path: string;
  absolutePath: string;
  createIfMissing: boolean;
  ownership: string;
  registrySource: string | null;
  upstream: string | null;
  pinnedRevision: string | null;
  license: string | null;
  notes: string[];
  profileScoped?: boolean;
  allowedExternalSupportPaths: string[];
  absoluteAllowedExternalSupportPaths: string[];
};

export type SkillSourceRegistryDocument = {
  version: number;
  updatedAt: string | null;
  sources: SkillSourceRegistryEntry[];
};

type SkillSourceRegistryRawEntry = Partial<
  Omit<SkillSourceRegistryEntry, 'absolutePath' | 'absoluteAllowedExternalSupportPaths'>
>;

type SkillSourceRegistryRawDocument = {
  version?: number;
  updatedAt?: string | null;
  sources?: SkillSourceRegistryRawEntry[];
};

type SkillSourceRegistryRuntime = {
  projectRoot?: string;
  profileRoot?: string;
  configFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

const DEFAULT_SOURCE_REGISTRY: SkillSourceRegistryRawDocument = {
  version: 1,
  updatedAt: null,
  sources: [
    {
      id: 'zavorth-native',
      label: 'Zavorth native curated shortlist',
      kind: 'workspace',
      trust: 'review',
      enabled: false,
      ingestionMode: 'local-scan',
      path: 'skill-library/native',
      createIfMissing: false,
      ownership: 'zavorth-native',
      registrySource: 'zavorth:native-intelligence-pack',
      license: 'Zavorth-Internal',
      notes: [
        'Small curated Zavorth-native shortlist only; bulk third-party imports must not live here.',
        'Disabled and review-gated by default until explicitly enabled by owner policy.',
      ],
    },
    {
      id: 'workspace-agents',
      label: 'Workspace .agents skills',
      kind: 'workspace',
      trust: 'trusted',
      enabled: true,
      ingestionMode: 'local-scan',
      path: '.agents/skills',
      createIfMissing: true,
      ownership: 'workspace',
      registrySource: 'zavorth:local-workspace',
    },
    {
      id: 'workspace-library',
      label: 'Workspace skill library',
      kind: 'workspace',
      trust: 'trusted',
      enabled: true,
      ingestionMode: 'local-scan',
      path: 'skill-library',
      createIfMissing: true,
      ownership: 'workspace',
      registrySource: 'zavorth:local-workspace',
    },
    {
      id: 'workspace-imported-library',
      label: 'Workspace imported skill library',
      kind: 'workspace',
      trust: 'review',
      enabled: false,
      ingestionMode: 'local-scan',
      path: 'skill-library/imported',
      createIfMissing: false,
      ownership: 'curated-import',
      registrySource: 'zavorth:curated-import',
    },
  ],
};

export class SkillSourceRegistryService {
  private readonly projectRoot: string;
  private readonly profileRoot: string;
  private readonly configFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: SkillSourceRegistryRuntime = {}) {
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.profileRoot = path.resolve(runtime.profileRoot || process.env.ZAVORTH_SKILL_PROFILE_ROOT || path.join(this.projectRoot, '.zavorth', 'profiles', 'default'));
    this.configFile = runtime.configFile || path.join(this.projectRoot, 'config', 'skill-sources.json');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public readConfig(): SkillSourceRegistryDocument {
    return this.normalizeDocument(this.readRawConfig());
  }

  public listSources(options: { includeDisabled?: boolean } = {}): SkillSourceRegistryEntry[] {
    const includeDisabled = options.includeDisabled === true;
    return this.readConfig().sources.filter((entry) => includeDisabled || entry.enabled);
  }

  public listSearchSources(): SkillSourceRegistryEntry[] {
    return this.listSources().filter((entry) => entry.ingestionMode === 'local-scan');
  }

  public getSource(
    sourceId: string | null | undefined,
    options: { includeDisabled?: boolean } = {},
  ): SkillSourceRegistryEntry | null {
    const normalizedId = this.normalizeId(sourceId);
    if (!normalizedId) {
      return null;
    }

    const source = this.readConfig().sources.find((entry) => entry.id === normalizedId) || null;
    if (!source) {
      return null;
    }
    if (!source.enabled && options.includeDisabled !== true) {
      return null;
    }
    return source;
  }

  private readRawConfig(): SkillSourceRegistryRawDocument {
    try {
      if (!this.existsSyncImpl(this.configFile)) {
        return DEFAULT_SOURCE_REGISTRY;
      }
      return JSON.parse(this.readFileSyncImpl(this.configFile, 'utf8')) as SkillSourceRegistryRawDocument;
    } catch (err) {
      logger.warn('Failed to read skill source registry config, falling back to defaults', {
        err,
        configFile: this.configFile,
      });
      return DEFAULT_SOURCE_REGISTRY;
    }
  }

  private normalizeDocument(raw: SkillSourceRegistryRawDocument): SkillSourceRegistryDocument {
    const rawSources = Array.isArray(raw.sources) && raw.sources.length > 0
      ? raw.sources
      : DEFAULT_SOURCE_REGISTRY.sources || [];
    const sourceMap = new Map<string, SkillSourceRegistryEntry>();

    rawSources.forEach((entry, index) => {
      const normalized = this.normalizeEntry(entry, index);
      sourceMap.set(normalized.id, normalized);
    });

    return {
      version: Number.isFinite(raw.version) ? Number(raw.version) : 1,
      updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
        ? raw.updatedAt.trim()
        : null,
      sources: Array.from(sourceMap.values()),
    };
  }

  private normalizeEntry(raw: SkillSourceRegistryRawEntry, index: number): SkillSourceRegistryEntry {
    const id = this.normalizeId(raw.id || `skill-source-${index + 1}`);
    const kind = this.normalizeKind(raw.kind);
    const ingestionMode = this.normalizeIngestionMode(raw.ingestionMode);
    const pathValue = this.normalizePath(raw.path || this.defaultPathFor(id));
    const allowedExternalSupportPaths = this.normalizePathList(raw.allowedExternalSupportPaths);
    const profileScoped = raw.profileScoped === true;

    return {
      id,
      label: String(raw.label || id).trim() || id,
      kind,
      trust: this.normalizeTrust(raw.trust),
      enabled: raw.enabled !== false,
      ingestionMode,
      path: pathValue,
      absolutePath: this.resolveSourcePath(pathValue, profileScoped),
      createIfMissing: typeof raw.createIfMissing === 'boolean'
        ? raw.createIfMissing
        : (kind === 'workspace' && ingestionMode === 'local-scan'),
      ownership: String(raw.ownership || (kind === 'workspace' ? 'workspace' : 'external')).trim() || 'external',
      registrySource: this.normalizeNullableString(raw.registrySource),
      upstream: this.normalizeNullableString(raw.upstream),
      pinnedRevision: this.normalizeNullableString(raw.pinnedRevision),
      license: this.normalizeNullableString(raw.license),
      notes: this.normalizeStringList(raw.notes),
      profileScoped,
      allowedExternalSupportPaths,
      absoluteAllowedExternalSupportPaths: allowedExternalSupportPaths.map((entry) => this.resolveSourcePath(entry, profileScoped)),
    };
  }

  private normalizeKind(value: unknown): SkillSourceKind {
    return value === 'workspace' || value === 'repository' || value === 'catalog' || value === 'vendor'
      ? value
      : 'workspace';
  }

  private normalizeTrust(value: unknown): SkillSourceTrust {
    return value === 'trusted' || value === 'review' || value === 'blocked'
      ? value
      : 'review';
  }

  private normalizeIngestionMode(value: unknown): SkillSourceIngestionMode {
    return value === 'local-scan' || value === 'allowlist-import' || value === 'manual'
      ? value
      : 'local-scan';
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-:/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizePath(value: string | null | undefined): string {
    return String(value || '').trim().replace(/\\/g, '/');
  }

  private normalizePathList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => this.normalizePath(typeof entry === 'string' ? entry : ''))
      .filter(Boolean);
  }

  private normalizeStringList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return [];
    }
    return values
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private resolveSourcePath(relativeOrAbsolutePath: string, profileScoped: boolean): string {
    if (!relativeOrAbsolutePath) {
      return profileScoped ? this.profileRoot : this.projectRoot;
    }

    return path.isAbsolute(relativeOrAbsolutePath)
      ? path.resolve(relativeOrAbsolutePath)
      : path.resolve(profileScoped ? this.profileRoot : this.projectRoot, relativeOrAbsolutePath);
  }

  private defaultPathFor(sourceId: string): string {
    if (sourceId === 'workspace-library') {
      return 'skill-library';
    }
    if (sourceId === 'workspace-imported-library') {
      return 'skill-library/imported';
    }
    return '.agents/skills';
  }
}
