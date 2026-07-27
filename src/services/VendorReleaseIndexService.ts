import { SidecarStatusService, type SidecarStatusCard } from './SidecarStatusService.js';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { config } from '../config/index.js';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import type {
  VendorDiffSummary,
  VendorLicenseDecision,
  VendorReleaseIndexEntry,
  VendorReleaseIndexSnapshot,
} from '../contracts/VendorPlaneContract.js';

import { VendorDiffSummaryService } from './VendorDiffSummaryService.js';
import { VendorLicenseGuardService } from './VendorLicenseGuardService.js';
import { logger } from '../logger.js';

type VendorManifestEntry = {
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

type VendorManifestDocument = {
  sources?: VendorManifestEntry[];
};

type VendorLockEntry = {
  id?: string;
  displayName?: string;
  license?: string;
  upstream?: string;
  resolvedSourceType?: string;
  resolvedSource?: string;
  mirrorDir?: string;
  worktreeDir?: string;
  integrationMode?: string;
  lockedCommit?: string;
};

type VendorLockDocument = {
  sources?: VendorLockEntry[];
};

type VendorHistoryReportItem = {
  id?: string;
  trimmed?: string | null;
};

type VendorHistoryEntry = {
  type?: string;
  createdAt?: string;
  report?: VendorHistoryReportItem[];
  restoredLock?: { sources?: Array<{ id?: string }> };
};

type VendorHistoryDocument = {
  entries?: VendorHistoryEntry[];
};

type VendorReleaseIndexRuntime = {
  now?: () => Date;
  projectRoot?: string;
  manifestFile?: string;
  lockFile?: string;
  historyFile?: string;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  runGit?: (args: string[], cwd: string) => string;
  sidecarStatusService?: Pick<SidecarStatusService, 'readSummary'>;
  diffService?: Pick<VendorDiffSummaryService, 'buildSummary'>;
  licenseGuardService?: Pick<VendorLicenseGuardService, 'getDecision'>;
};

export class VendorReleaseIndexService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly manifestFile: string;
  private readonly lockFile: string;
  private readonly historyFile: string;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly runGitImpl: (args: string[], cwd: string) => string;
  private readonly sidecarStatusService: Pick<SidecarStatusService, 'readSummary'>;
  private readonly diffService: Pick<VendorDiffSummaryService, 'buildSummary'>;
  private readonly licenseGuardService: Pick<VendorLicenseGuardService, 'getDecision'>;

  constructor(runtime: VendorReleaseIndexRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.manifestFile = runtime.manifestFile || path.join(this.projectRoot, 'config', 'third-party-sources.json');
    this.lockFile = runtime.lockFile || path.join(this.projectRoot, 'data', 'vendor-lock.json');
    this.historyFile = runtime.historyFile || path.join(this.projectRoot, 'data', 'vendor-history', 'history.json');
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.runGitImpl = runtime.runGit || this.runGit;
    this.sidecarStatusService = runtime.sidecarStatusService || new SidecarStatusService();
    this.diffService = runtime.diffService || new VendorDiffSummaryService();
    this.licenseGuardService = runtime.licenseGuardService || new VendorLicenseGuardService();
  }

  public buildSnapshot(): VendorReleaseIndexSnapshot {
    const entries = this.buildEntries();
    return {
      generatedAt: this.now().toISOString(),
      summary: {
        total: entries.length,
        updateAvailable: entries.filter((entry) => entry.updateAvailable).length,
        live: entries.filter((entry) => entry.live).length,
        ready: entries.filter((entry) => entry.ready).length,
        reviewRequired: entries.filter((entry) => entry.licenseDecision.reviewRequired).length,
        blockedForCoreCopy: entries.filter((entry) => !entry.licenseDecision.allowCoreCopy).length,
      },
      entries,
    };
  }

  public getEntry(vendorId: string | null | undefined): VendorReleaseIndexEntry | null {
    const normalizedId = this.normalizeId(vendorId);
    if (!normalizedId) {
      return null;
    }
    return this.buildEntries().find((entry) => entry.vendorId === normalizedId) || null;
  }

  public getDiffSummary(vendorId: string | null | undefined): VendorDiffSummary | null {
    return this.getEntry(vendorId)?.diff || null;
  }

  public getLicenseDecision(vendorId: string | null | undefined): VendorLicenseDecision | null {
    return this.getEntry(vendorId)?.licenseDecision || null;
  }

  private buildEntries(): VendorReleaseIndexEntry[] {
    const manifest = this.readJsonFile<VendorManifestDocument>(this.manifestFile, { sources: [] });
    const lock = this.readJsonFile<VendorLockDocument>(this.lockFile, { sources: [] });
    const history = this.readJsonFile<VendorHistoryDocument>(this.historyFile, { entries: [] });
    const sidecars = this.sidecarStatusService.readSummary();

    return (manifest.sources || []).map((entry) => {
      const vendorId = this.normalizeId(entry.id);
      const displayName = String(entry.displayName || vendorId).trim() || vendorId;
      const lockEntry = (lock.sources || []).find((item) => this.normalizeId(item.id) === vendorId) || null;
      const source = this.resolvePreferredSource(entry);
      const worktreeDir = this.resolveProjectPath(String(entry.worktreeDir || lockEntry?.worktreeDir || '').trim());
      const mirrorDir = this.resolveProjectPath(String(entry.mirrorDir || lockEntry?.mirrorDir || '').trim());
      const sourceHead = source.type === 'local'
        ? this.readHead(source.value)
        : this.readHead(mirrorDir);
      const worktreeCommit = this.readHead(worktreeDir);
      const mirrorHead = this.readHead(mirrorDir);
      const lockedCommit = this.normalizeNullableString(lockEntry?.lockedCommit);
      const lastAction = this.resolveLastAction(history, vendorId);
      const diff = this.diffService.buildSummary({
        vendorId,
        displayName,
        lockedCommit,
        worktreeCommit,
        sourceHead,
        lastActionType: lastAction.type,
        lastActionAt: lastAction.createdAt,
        trimmed: lastAction.trimmed,
      });
      const licenseDecision = this.licenseGuardService.getDecision(vendorId) || {
        vendorId,
        displayName,
        license: String(entry.license || lockEntry?.license || 'unknown').trim() || 'unknown',
        releaseIsolation: 'vendor-isolated',
        coreCopyPolicy: 'isolated-vendor-only',
        reviewRequired: true,
        allowVendorSync: true,
        allowCoreCopy: false,
        rationale: 'Could not read the release contract for this vendor.',
        recommendedAction: 'review the vendor manifest before promoting any change.',
        summary: 'Vendor without known policy; trate como isolado ate review.',
      };
      const sidecar = this.resolveSidecarCard(vendorId, sidecars);
      const syncStatusFile = this.resolveSyncStatusFile(vendorId);
      const syncReport = this.readJsonFile<any>(syncStatusFile, null);
      const healthFile = this.resolveHealthFile(vendorId);
      const healthReport = this.readJsonFile<any>(healthFile, null);

      return {
        vendorId,
        displayName,
        license: String(entry.license || lockEntry?.license || 'unknown').trim() || 'unknown',
        integrationMode: String(entry.integrationMode || lockEntry?.integrationMode || 'unknown').trim() || 'unknown',
        upstream: String(entry.upstream || lockEntry?.upstream || '').trim(),
        resolvedSourceType: source.type,
        resolvedSource: source.value,
        mirrorDir,
        worktreeDir,
        lockedCommit,
        sourceHead,
        mirrorHead,
        worktreeCommit,
        status: diff.status,
        updateAvailable: diff.status === 'update_available',
        live: Boolean(sidecar?.running || sidecar?.ready),
        ready: Boolean(sidecar?.ready),
        baseUrl: sidecar?.baseUrl || this.normalizeNullableString(entry.defaultBaseUrl),
        port: this.resolvePort(entry.defaultBaseUrl, vendorId),
        statusFile: syncStatusFile,
        healthFile,
        syncStatus: this.normalizeSyncStatus(syncReport?.status),
        syncSummary: this.normalizeNullableString(syncReport?.summary),
        healthSummary: this.normalizeNullableString(healthReport?.summary),
        lastAction,
        diff,
        licenseDecision,
      };
    });
  }

  private resolveSidecarCard(
    vendorId: string,
    sidecars: ReturnType<SidecarStatusService['readSummary']>,
  ): SidecarStatusCard | null {
    if (vendorId === 'aigateway') {
      return sidecars.AIGateway;
    }
    if (vendorId === 'zavorth-terminal') {
      return sidecars.ZavorthTerminal;
    }
    return null;
  }

  private resolvePreferredSource(entry: VendorManifestEntry): { type: 'local' | 'upstream'; value: string } {
    const localSource = this.resolveProjectPath(String(entry.localSource || '').trim());
    if (this.existsGitRepo(localSource)) {
      return { type: 'local', value: localSource };
    }
    return {
      type: 'upstream',
      value: String(entry.upstream || '').trim(),
    };
  }

  private resolveLastAction(
    history: VendorHistoryDocument,
    vendorId: string,
  ): VendorReleaseIndexEntry['lastAction'] {
    for (const entry of history.entries || []) {
      if (entry.type === 'update') {
        const reportItem = (entry.report || []).find((item) => this.normalizeId(item.id) === vendorId);
        if (reportItem) {
          return {
            type: 'update',
            createdAt: this.normalizeNullableString(entry.createdAt),
            trimmed: this.normalizeNullableString(reportItem.trimmed),
          };
        }
      }
      if (entry.type === 'rollback') {
        const restored = (entry.restoredLock?.sources || []).some((item) => this.normalizeId(item.id) === vendorId);
        if (restored) {
          return {
            type: 'rollback',
            createdAt: this.normalizeNullableString(entry.createdAt),
            trimmed: null,
          };
        }
      }
    }

    return {
      type: null,
      createdAt: null,
      trimmed: null,
    };
  }

  private resolveSyncStatusFile(vendorId: string): string | null {
    switch (vendorId) {
      case 'aigateway':
        return config.AIGatewaySyncStatusFile;
      case 'zavorth-terminal':
        return config.ZavorthTerminalSyncStatusFile;
      default:
        return null;
    }
  }

  private resolveHealthFile(vendorId: string): string | null {
    switch (vendorId) {
      case 'aigateway':
        return config.AIGatewayCompatibilityStatusFile;
      case 'zavorth-terminal':
        return config.zavorthBridgeRemoteDoctorReportFile;
      default:
        return null;
    }
  }

  private resolvePort(baseUrl: string | undefined, vendorId: string): number | null {
    const fallback = vendorId === 'aigateway' ? 20128 : 4747;
    const normalizedBaseUrl = String(baseUrl || '').trim();
    if (!normalizedBaseUrl) {
      return fallback;
    }
    try {
      const parsed = new URL(normalizedBaseUrl);
      const port = parsed.port ? safeParseInt(parsed.port, parsed.protocol === 'https:' ? 443 : 80) : (parsed.protocol === 'https:' ? 443 : 80);
      return Number.isFinite(port) && port > 0 ? port : fallback;
    } catch (error: unknown) {logger.warn('[Vendor Release] network request failed', error); return fallback; }
  }

  private normalizeSyncStatus(value: unknown): VendorReleaseIndexEntry['syncStatus'] {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'inspected' || normalized === 'promoted' || normalized === 'rolled_back' || normalized === 'failed') {
      return normalized;
    }
    return 'unknown';
  }

  private readHead(repoPath: string | null | undefined): string | null {
    const normalized = String(repoPath || '').trim();
    if (!this.existsGitRepo(normalized)) {
      return null;
    }
    try {
      return this.normalizeNullableString(this.runGitImpl(['rev-parse', 'HEAD'], normalized));
    } catch (error: unknown) {logger.warn('[Vendor Release] parsing failed', error); return null; }
  }

  private existsGitRepo(repoPath: string | null | undefined): boolean {
    const normalized = String(repoPath || '').trim();
    if (!normalized) {
      return false;
    }
    return this.existsSyncImpl(path.join(normalized, '.git')) || normalized.endsWith('.git');
  }

  private readJsonFile<T>(filePath: string | null, fallback: T): T {
    try {
      if (!filePath || !this.existsSyncImpl(filePath)) {
        return fallback;
      }
      return JSON.parse(this.readFileSyncImpl(filePath, 'utf8')) as T;
    } catch (error: unknown) {logger.warn('[Vendor Release] JSON parse failed', error); return fallback; }
  }

  private resolveProjectPath(relativeOrAbsolutePath: string): string {
    if (!relativeOrAbsolutePath) {
      return this.projectRoot;
    }
    return path.isAbsolute(relativeOrAbsolutePath)
      ? path.resolve(relativeOrAbsolutePath)
      : path.resolve(this.projectRoot, relativeOrAbsolutePath);
  }

  private normalizeId(value: unknown): string {
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

  private runGit(args: string[], cwd: string): string {
    const result = spawnSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      if (result.error) {
        throw result.error;
      }
      throw new Error(`${result.stderr || result.stdout || 'git failed'}`.trim());
    }
    return String(result.stdout || '').trim();
  }
}
