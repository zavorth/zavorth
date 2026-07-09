import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { logger } from '../logger.js';

export type VendorReleaseIsolation = 'core-safe' | 'vendor-isolated';
export type VendorCoreCopyPolicy = 'allow-with-attribution' | 'isolated-vendor-only';

export type VendorReleaseContract = {
  id: string;
  displayName: string;
  license: string;
  upstream: string;
  localSource: string;
  absoluteLocalSource: string;
  worktreeDir: string;
  absoluteWorktreeDir: string;
  mirrorDir: string;
  absoluteMirrorDir: string;
  integrationMode: string;
  defaultBaseUrl: string | null;
  syncStrategy: 'mirror+worktree';
  releaseIsolation: VendorReleaseIsolation;
  coreCopyPolicy: VendorCoreCopyPolicy;
  reviewRequired: boolean;
  rationale: string;
  recommendedAction: string;
};

export type VendorReleaseContractSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    isolated: number;
    coreSafe: number;
    reviewRequired: number;
  };
  contracts: VendorReleaseContract[];
};

type VendorSourceRawEntry = {
  id?: string;
  displayName?: string;
  license?: string;
  upstream?: string;
  localSource?: string;
  worktreeDir?: string;
  mirrorDir?: string;
  integrationMode?: string;
  defaultBaseUrl?: string;
};

type VendorSourceRawDocument = {
  sources?: VendorSourceRawEntry[];
};

type VendorReleaseContractRuntime = {
  projectRoot?: string;
  manifestFile?: string;
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class VendorReleaseContractService {
  private readonly projectRoot: string;
  private readonly manifestFile: string;
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: VendorReleaseContractRuntime = {}) {
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.manifestFile = runtime.manifestFile || path.join(this.projectRoot, 'config', 'third-party-sources.json');
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public readContracts(): VendorReleaseContract[] {
    const manifest = this.readManifest();
    return (manifest.sources || []).map((entry) => this.normalizeContract(entry));
  }

  public getContract(vendorId: string | null | undefined): VendorReleaseContract | null {
    const normalizedId = this.normalizeId(vendorId);
    if (!normalizedId) {
      return null;
    }
    return this.readContracts().find((entry) => entry.id === normalizedId) || null;
  }

  public buildSnapshot(): VendorReleaseContractSnapshot {
    const contracts = this.readContracts();
    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: contracts.length,
        isolated: contracts.filter((entry) => entry.releaseIsolation === 'vendor-isolated').length,
        coreSafe: contracts.filter((entry) => entry.releaseIsolation === 'core-safe').length,
        reviewRequired: contracts.filter((entry) => entry.reviewRequired).length,
      },
      contracts,
    };
  }

  private readManifest(): VendorSourceRawDocument {
    try {
      if (!this.existsSyncImpl(this.manifestFile)) {
        return { sources: [] };
      }
      return JSON.parse(this.readFileSyncImpl(this.manifestFile, 'utf8')) as VendorSourceRawDocument;
    } catch (error: unknown) {logger.warn('[Vendor Release Contract] JSON parse failed', error);
    return { sources: [] };
  }
  }

  private normalizeContract(entry: VendorSourceRawEntry): VendorReleaseContract {
    const id = this.normalizeId(entry.id);
    const displayName = String(entry.displayName || id).trim() || id;
    const license = String(entry.license || 'unknown').trim() || 'unknown';
    const governance = this.classifyLicense(license);

    return {
      id,
      displayName,
      license,
      upstream: String(entry.upstream || '').trim(),
      localSource: String(entry.localSource || '').trim(),
      absoluteLocalSource: this.resolveProjectPath(String(entry.localSource || '').trim()),
      worktreeDir: String(entry.worktreeDir || '').trim(),
      absoluteWorktreeDir: this.resolveProjectPath(String(entry.worktreeDir || '').trim()),
      mirrorDir: String(entry.mirrorDir || '').trim(),
      absoluteMirrorDir: this.resolveProjectPath(String(entry.mirrorDir || '').trim()),
      integrationMode: String(entry.integrationMode || 'unknown').trim() || 'unknown',
      defaultBaseUrl: this.normalizeNullableString(entry.defaultBaseUrl),
      syncStrategy: 'mirror+worktree',
      releaseIsolation: governance.releaseIsolation,
      coreCopyPolicy: governance.coreCopyPolicy,
      reviewRequired: governance.reviewRequired,
      rationale: governance.rationale,
      recommendedAction: governance.recommendedAction,
    };
  }

  private classifyLicense(license: string): {
    releaseIsolation: VendorReleaseIsolation;
    coreCopyPolicy: VendorCoreCopyPolicy;
    reviewRequired: boolean;
    rationale: string;
    recommendedAction: string;
  } {
    const normalizedLicense = license.trim().toLowerCase();

    if (/(^|[^a-z])(gpl|agpl|lgpl)(-|[^a-z]|$)/i.test(normalizedLicense)) {
      return {
        releaseIsolation: 'vendor-isolated',
        coreCopyPolicy: 'isolated-vendor-only',
        reviewRequired: true,
        rationale: `Licenca ${license} exige isolamento de vendor e revisao antes de qualquer absorcao arquitetural.`,
        recommendedAction: 'Sincronizar mirror/worktree e reaproveitar apenas contratos e ideias, sem copiar para o core.',
      };
    }

    return {
      releaseIsolation: 'core-safe',
      coreCopyPolicy: 'allow-with-attribution',
      reviewRequired: false,
      rationale: `Licenca ${license} permite governanca como vendor sincronizavel com atribuicao e auditoria.`,
      recommendedAction: 'Permitir sync normal de vendor, mantendo trilha de versao e atribuicao.',
    };
  }

  private resolveProjectPath(relativeOrAbsolutePath: string): string {
    if (!relativeOrAbsolutePath) {
      return this.projectRoot;
    }

    return path.isAbsolute(relativeOrAbsolutePath)
      ? path.resolve(relativeOrAbsolutePath)
      : path.resolve(this.projectRoot, relativeOrAbsolutePath);
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-:/]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeNullableString(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }
}
