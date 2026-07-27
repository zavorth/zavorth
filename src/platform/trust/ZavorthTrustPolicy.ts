import crypto from 'crypto';
import {
  ZavorthPlatformCatalogSourceService,
  type ZavorthPlatformCatalogEntry,
} from '../../services/ZavorthPlatformCatalogSourceService.js';
import { PluginStateService } from '../../services/PluginStateService.js';

import {
  decideSecurityPolicy,
  type SecurityPolicyBrokerReceipt,
  type SecurityPolicyBrokerSurface,
} from '../../security/SecurityPolicyBroker.js';

export interface ZavorthTrustPolicy {
  validateSignature(packageId: string, version: string, signature: string): Promise<boolean>;
  isPublisherTrusted(authorId: string): Promise<boolean>;
  getProvenance(packageId: string): Promise<{
    sourceUrl: string;
    commitHash?: string;
    verifiedAt: string;
  }>;
  buildExpectedSignature?(packageId: string, version: string): string | null;
}

type ZavorthTrustPolicyRuntime = {
  now?: () => Date;
  catalogSourceService?: Pick<ZavorthPlatformCatalogSourceService, 'listEntries' | 'readSyncStatus'>;
  pluginStateService?: Pick<PluginStateService, 'getState'>;
  trustedPublishers?: string[];
};

export class DefaultTrustPolicy implements ZavorthTrustPolicy {
  private readonly now: () => Date;
  private readonly catalogSource: Pick<ZavorthPlatformCatalogSourceService, 'listEntries' | 'readSyncStatus'>;
  private readonly pluginState: Pick<PluginStateService, 'getState'>;
  private readonly trustedPublishers: Set<string>;
  private lastPolicyReceipt: SecurityPolicyBrokerReceipt | null = null;

  constructor(runtime: ZavorthTrustPolicyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.catalogSource = runtime.catalogSourceService || new ZavorthPlatformCatalogSourceService();
    this.pluginState = runtime.pluginStateService || new PluginStateService();
    this.trustedPublishers = new Set(
      (runtime.trustedPublishers || ['@zavorth-official', '@core-team', 'registry:zavorth'])
        .map((entry) => this.normalizeValue(entry))
        .filter(Boolean),
    );
  }

  public buildExpectedSignature(packageId: string, version: string): string | null {
    const entry = this.resolveEntry(packageId);
    if (!entry) {
      return null;
    }

    return `sha256:${sha256Hex([
      this.normalizeValue(entry.id),
      this.normalizeValue(version),
      this.normalizeValue(entry.source),
      this.normalizeValue(entry.summary),
      this.normalizeValue(entry.actionHint),
    ].join('\n'))}`;
  }

  public async validateSignature(packageId: string, version: string, signature: string): Promise<boolean> {
    const entry = this.resolveEntry(packageId);
    if (!entry) {
      this.recordBrokerDecision({
        surface: this.surfaceForPackage(packageId),
        operation: 'signature_validation',
        target: packageId,
        allowed: false,
        reason: 'Package is missing from the trusted catalog.',
      });
      return false;
    }

    const expected = this.buildExpectedSignature(entry.id, version);
    if (!expected || this.normalizeSignature(expected) !== this.normalizeSignature(signature)) {
      this.recordBrokerDecision({
        surface: this.surfaceForPackage(entry.id),
        operation: 'signature_validation',
        target: entry.id,
        allowed: false,
        reason: 'Package signature does not match the trusted catalog.',
      });
      return false;
    }

    if (entry.source.includes('remote-catalog')) {
      const sync = this.catalogSource.readSyncStatus();
      const allowed = sync.status === 'ready'
        && sync.sourceTrusted === true
        && !sync.stale
        && !sync.error;
      this.recordBrokerDecision({
        surface: this.surfaceForPackage(entry.id),
        operation: 'signature_validation',
        target: entry.id,
        allowed,
        reason: allowed ? 'Signature and trusted remote catalog are valid.'
          : 'Remote catalog is not ready, trusted, and fresh.',
      });
      return allowed;
    }

    const localState = this.pluginState.getState(entry.id);
    if (localState && localState.sourceTrusted === false) {
      this.recordBrokerDecision({
        surface: this.surfaceForPackage(entry.id),
        operation: 'signature_validation',
        target: entry.id,
        allowed: false,
        reason: 'local state marked the package source as untrusted.',
      });
      return false;
    }

    this.recordBrokerDecision({
      surface: this.surfaceForPackage(entry.id),
      operation: 'signature_validation',
      target: entry.id,
      allowed: true,
      reason: 'Local signature validated against the trusted catalog.',
    });
    return true;
  }

  public async isPublisherTrusted(authorId: string): Promise<boolean> {
    const normalized = this.normalizeValue(authorId);
    const allowed = this.trustedPublishers.has(normalized) || normalized.endsWith('-verified');
    this.recordBrokerDecision({
      surface: 'plugin',
      operation: 'publisher_trust',
      target: normalized || 'unknown',
      allowed,
      reason: allowed ? 'Publisher recognized as trusted.'
        : 'Publisher is not in the trusted list.',
    });
    return allowed;
  }

  public async getProvenance(packageId: string): Promise<{
    sourceUrl: string;
    commitHash?: string;
    verifiedAt: string;
  }> {
    const entry = this.resolveEntry(packageId);
    const sync = this.catalogSource.readSyncStatus();
    const localState = entry ? this.pluginState.getState(entry.id) : null;

    if (!entry) {
      return {
        sourceUrl: `zavorth://catalog/${this.normalizeValue(packageId) || 'unknown'}`,
        verifiedAt: this.now().toISOString(),
      };
    }

    const remoteSource = entry.source.includes('remote-catalog') && sync.remoteUrl ? `${String(sync.remoteUrl).replace(/\/+$/, '')}/packages/${encodeURIComponent(entry.id)}`
      : null;
    const sourceUrl = remoteSource
      || (entry.source.startsWith('registry:') ? `zavorth://${entry.source.replace(/^registry:/, 'catalog/')}/${entry.id}`
        : entry.source);
    const commitHash = localState?.sourceDigest || sync.contentSha256 || undefined;

    return {
      sourceUrl,
      commitHash,
      verifiedAt: sync.syncedAt || localState?.updatedAt || this.now().toISOString(),
    };
  }

  public getLastPolicyReceipt(): SecurityPolicyBrokerReceipt | null {
    return this.lastPolicyReceipt;
  }

  private resolveEntry(packageId: string): ZavorthPlatformCatalogEntry | null {
    const entries = this.catalogSource.listEntries();
    const normalized = this.normalizeValue(packageId);
    if (!normalized) {
      return null;
    }

    const candidates = [
      normalized,
      `plugin:${normalized}`,
      `skill:${normalized}`,
      `mcp:${normalized}`,
    ];
    return entries.find((entry) => candidates.includes(this.normalizeValue(entry.id))) || null;
  }

  private normalizeSignature(value: string): string {
    return this.normalizeValue(value).replace(/^sha256:/, '');
  }

  private normalizeValue(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private recordBrokerDecision(input: {
    surface: SecurityPolicyBrokerSurface;
    operation: string;
    target: string;
    allowed: boolean;
    reason: string;
  }): void {
    const decision = decideSecurityPolicy({
      surface: input.surface,
      operation: input.operation,
      target: input.target,
      adminPolicyRequired: !input.allowed,
      rule: input.allowed ? 'PLATFORM_TRUST_POLICY_ALLOWED' : 'PLATFORM_TRUST_POLICY_ADMIN_REQUIRED',
      reasons: [input.reason],
    });
    this.lastPolicyReceipt = decision.receipt;
  }

  private surfaceForPackage(packageId: string): SecurityPolicyBrokerSurface {
    const normalized = this.normalizeValue(packageId);
    if (normalized.startsWith('skill:')) {
      return 'skill';
    }
    if (normalized.startsWith('mcp:')) {
      return 'mcp';
    }
    return 'plugin';
  }
}

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(String(input || ''), 'utf8').digest('hex');
}
