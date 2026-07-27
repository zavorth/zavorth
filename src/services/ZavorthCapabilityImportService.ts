import {
  CAPABILITY_IMPORT_CONTRACT_VERSION,
  type CapabilityImportIssue,
  type CapabilityImportManifest,
  type CapabilityImportManifestItem,
  type CapabilityImportReceipt,
  type CapabilityImportSnapshot,
} from '../contracts/CapabilityImportContract.js';
import type {
  CapabilityHubItem,
  CapabilityHubItemKind,
  CapabilityHubReadiness,
  CapabilityHubRiskLevel,
} from '../contracts/CapabilityHubContract.js';

export type CapabilityImportInput = {
  manifests?: CapabilityImportManifest[];
  manifest?: CapabilityImportManifest | null;
  rawJson?: string | null;
  sourceLabel?: string | null;
  includeItems?: boolean;
};

export type ZavorthCapabilityImportRuntime = {
  now?: () => Date;
  manifests?: CapabilityImportManifest[];
};

const ALLOWED_KINDS: CapabilityHubItemKind[] = [
  'runtime-capability',
  'channel',
  'integration',
  'provider',
  'mcp',
  'skill',
  'recipe',
];

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{12,}\b/g,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
];

export class ZavorthCapabilityImportService {
  private readonly now: () => Date;
  private readonly manifests: CapabilityImportManifest[];

  constructor(runtime: ZavorthCapabilityImportRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.manifests = Array.isArray(runtime.manifests) ? runtime.manifests.slice() : [];
  }

  public buildSnapshot(input: CapabilityImportInput = {}): CapabilityImportSnapshot {
    const manifests = this.resolveManifests(input);
    const issues: CapabilityImportIssue[] = [];
    const receipts: CapabilityImportReceipt[] = [];
    const items: CapabilityHubItem[] = [];
    let receivedItems = 0;

    for (const manifest of manifests) {
      const manifestIssues = this.validateManifest(manifest);
      issues.push(...manifestIssues);
      receipts.push({
        id: `cap-import:${this.slug(manifest.packId)}:manifest`,
        kind: 'manifest-validated',
        summary: `${manifest.label} manifest validated with ${manifestIssues.length} issue(s).`,
        itemId: null,
      });
      if (manifestIssues.some((issue) => issue.severity === 'blocked' || issue.severity === 'error')) {
        for (const item of manifest.items || []) {
          receivedItems += 1;
          receipts.push({
            id: `cap-import:${this.slug(manifest.packId)}:${this.slug(item.id)}:rejected`,
            kind: 'item-rejected',
            summary: `${item.id || 'unknown'} was rejected because the manifest failed validation.`,
            itemId: item.id || null,
          });
        }
        continue;
      }

      for (const item of manifest.items || []) {
        receivedItems += 1;
        const itemIssues = this.validateItem(manifest, item);
        issues.push(...itemIssues);
        if (itemIssues.some((issue) => issue.severity === 'blocked' || issue.severity === 'error')) {
          receipts.push({
            id: `cap-import:${this.slug(manifest.packId)}:${this.slug(item.id)}:rejected`,
            kind: 'item-rejected',
            summary: `${item.id || 'unknown'} was rejected before entering the Capability Hub.`,
            itemId: item.id || null,
          });
          continue;
        }
        const normalized = this.toCapabilityHubItem(manifest, item);
        items.push(normalized);
        receipts.push({
          id: `cap-import:${this.slug(manifest.packId)}:${this.slug(item.id)}:normalized`,
          kind: 'item-normalized',
          summary: `${normalized.id} normalized into Capability Hub contract.`,
          itemId: normalized.id,
        });
      }
    }

    const rejectedItems = receivedItems - items.length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;
    const blocked = issues.filter((issue) => issue.severity === 'blocked').length;

    return {
      contractVersion: CAPABILITY_IMPORT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      policy: {
        canonicalRoot: 'zavorth-core/Zavorth',
        canonicalRootOnly: true,
        externalCapabilityRootsAllowed: false,
        importsMustNormalizeToCapabilityHub: true,
        dryRunOnly: true,
        liveActivation: false,
        secretsSerialized: false,
      },
      source: {
        manifestCount: manifests.length,
        sourceLabel: input.sourceLabel || null,
      },
      summary: {
        receivedItems,
        normalizedItems: items.length,
        rejectedItems,
        warnings,
        blocked,
      },
      items: input.includeItems === false ? [] : items,
      issues,
      receipts,
      narrative: {
        headline: `Capability Importer normalizou ${items.length}/${receivedItems} item(s).`,
        operatorSummary: `${rejectedItems} rejected(s), ${warnings} aviso(s), serialized secrets: no, live activation: no.`,
        nextAction: items.length > 0
          ? 'Revisar no Capability Hub e passar pelo Natural Setup Assistant before ativar qualquer usage real.'
          : 'Provide a valid manifest with id, type, name, and summary for each capability.',
      },
    };
  }

  public listCapabilityHubItems(input: CapabilityImportInput = {}): CapabilityHubItem[] {
    return this.buildSnapshot({ ...input, includeItems: true }).items;
  }

  public renderReport(input: CapabilityImportInput = {}): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      'Zavorth Capability Importer',
      '',
      snapshot.narrative.headline,
      snapshot.narrative.operatorSummary,
      '',
      `Policy: canonicalRootOnly=${snapshot.policy.canonicalRootOnly}; externalRoots=${snapshot.policy.externalCapabilityRootsAllowed}; live=${snapshot.policy.liveActivation}; secrets=${snapshot.policy.secretsSerialized}.`,
      `Items: received ${snapshot.summary.receivedItems} | normalized ${snapshot.summary.normalizedItems} | rejected ${snapshot.summary.rejectedItems}.`,
    ];

    if (snapshot.items.length > 0) {
      lines.push('', 'Normalized:');
      for (const item of snapshot.items.slice(0, 12)) {
        lines.push(`- ${item.id} [${item.kind}/${item.readiness}] ${item.label}`);
      }
    }
    if (snapshot.issues.length > 0) {
      lines.push('', 'Issues:');
      for (const issue of snapshot.issues.slice(0, 12)) {
        lines.push(`- ${issue.severity}/${issue.code}: ${issue.message}`);
      }
    }
    lines.push('', `Next: ${snapshot.narrative.nextAction}`);
    return lines.join('\n');
  }

  private resolveManifests(input: CapabilityImportInput): CapabilityImportManifest[] {
    const manifests = [
      ...this.manifests,
      ...(Array.isArray(input.manifests) ? input.manifests : []),
      ...(input.manifest ? [input.manifest] : []),
    ];
    if (input.rawJson) {
      const parsed = JSON.parse(input.rawJson) as CapabilityImportManifest | { manifests?: CapabilityImportManifest[] };
      if ('manifests' in parsed && Array.isArray(parsed.manifests)) {
        manifests.push(...parsed.manifests);
      } else {
        manifests.push(parsed as CapabilityImportManifest);
      }
    }
    return manifests;
  }

  private validateManifest(manifest: CapabilityImportManifest): CapabilityImportIssue[] {
    const issues: CapabilityImportIssue[] = [];
    if (!manifest.packId || !manifest.label) {
      issues.push({
        severity: 'error',
        code: 'manifest.identity_missing',
        itemId: null,
        message: 'Manifest must include packId and label.',
      });
    }
    if (!Array.isArray(manifest.items)) {
      issues.push({
        severity: 'error',
        code: 'manifest.items_missing',
        itemId: null,
        message: 'Manifest must include an items array.',
      });
    }
    if (this.containsSecretValue(JSON.stringify(manifest))) {
      issues.push({
        severity: 'blocked',
        code: 'manifest.raw_secret_detected',
        itemId: null,
        message: 'Manifest contains secret-looking values. Import only secret refs, never raw secrets.',
      });
    }
    return issues;
  }

  private validateItem(
    manifest: CapabilityImportManifest,
    item: CapabilityImportManifestItem,
  ): CapabilityImportIssue[] {
    const issues: CapabilityImportIssue[] = [];
    if (!item.id || !item.label || !item.summary) {
      issues.push({
        severity: 'error',
        code: 'item.identity_missing',
        itemId: item.id || null,
        message: 'Imported item must include id, label and summary.',
      });
    }
    if (!ALLOWED_KINDS.includes(item.kind)) {
      issues.push({
        severity: 'error',
        code: 'item.kind_invalid',
        itemId: item.id || null,
        message: `Imported item ${item.id || 'unknown'} has unsupported kind ${String(item.kind)}.`,
      });
    }
    if (item.activation?.installed || item.activation?.configured) {
      issues.push({
        severity: 'warning',
        code: 'item.activation_downgraded',
        itemId: item.id,
        message: `${item.id} claimed installed/configured state; importer will downgrade to preview until readiness is checked.`,
      });
    }
    if (manifest.source?.externalRuntimeDependency) {
      issues.push({
        severity: 'info',
        code: 'item.external_runtime_dependency',
        itemId: item.id,
        message: `${item.id} depends on an external runtime, but the normalized record remains inside Zavorth root.`,
      });
    }
    return issues;
  }

  private toCapabilityHubItem(
    manifest: CapabilityImportManifest,
    item: CapabilityImportManifestItem,
  ): CapabilityHubItem {
    const kind = item.kind;
    const hubId = this.toHubId(kind, item.id);
    const readiness = item.activation?.readiness || 'needs_configuration';
    const risk = item.governance?.risk || this.defaultRisk(kind);
    const requiresApproval = item.governance?.requiresApproval ?? true;
    const sandboxRequired = item.governance?.sandboxRequired ?? (kind === 'skill' || kind === 'mcp' || risk === 'high');
    const tags = this.unique([
      'imported',
      this.slug(manifest.packId),
      kind,
      ...(item.tags || []),
    ]);

    return {
      id: hubId,
      kind,
      label: item.label,
      summary: item.summary,
      description: item.description || item.summary,
      tags,
      readiness,
      source: 'imported',
      requirements: {
        secretRefs: this.cleanList(item.requirements?.secretRefs),
        envKeys: this.cleanList(item.requirements?.envKeys),
        accounts: this.cleanList(item.requirements?.accounts),
        binaries: this.cleanList(item.requirements?.binaries),
        manualSteps: this.cleanList(item.requirements?.manualSteps),
      },
      governance: {
        risk,
        requiresApproval,
        budgetRequired: item.governance?.budgetRequired ?? true,
        sandboxRequired,
        networkScope: item.governance?.networkScope || 'unknown',
        receiptRequired: true,
        auditTrailRequired: true,
      },
      activation: {
        defaultEnabled: false,
        liveAllowed: false,
        configured: false,
        installed: false,
        setupGuided: item.activation?.setupGuided ?? true,
        readinessChecks: this.cleanList(item.activation?.readinessChecks || ['CapabilityImportService', 'CapabilityHubReview']),
        commands: this.cleanList(item.activation?.commands),
      },
      provenance: {
        owner: 'imported',
        sourceService: 'ZavorthCapabilityImportService',
        sourceId: `${manifest.packId}:${item.id}`,
        externalRuntimeDependency: Boolean(manifest.source?.externalRuntimeDependency),
        canonicalRootOnly: true,
      },
      searchText: this.searchText([
        hubId,
        item.label,
        item.summary,
        item.description || '',
        manifest.label,
        tags.join(' '),
      ]),
    };
  }

  private toHubId(kind: CapabilityHubItemKind, id: string): string {
    const normalized = this.slug(id.replace(/^[^:]+:/u, ''));
    return `${kind}:${normalized}`;
  }

  private defaultRisk(kind: CapabilityHubItemKind): CapabilityHubRiskLevel {
    if (kind === 'provider' || kind === 'channel' || kind === 'integration') {
      return 'medium';
    }
    if (kind === 'mcp' || kind === 'skill') {
      return 'high';
    }
    return 'unknown';
  }

  private containsSecretValue(value: string): boolean {
    return SECRET_VALUE_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(value);
    });
  }

  private cleanList(values: string[] | undefined): string[] {
    return this.unique((values || [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .filter((value) => !this.containsSecretValue(value)));
  }

  private unique(values: string[]): string[] {
    return values.filter((value, index, all) => all.indexOf(value) === index);
  }

  private slug(value: string): string {
    const slug = String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'unnamed';
  }

  private searchText(values: string[]): string {
    return values.join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9:._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
