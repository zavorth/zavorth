import {
  ZAVORTH_EXTENSION_API_VERSION,
  ZAVORTH_EXTENSION_KINDS,
  ZAVORTH_EXTENSION_PERMISSION_KINDS,
  ZAVORTH_EXTENSION_PERMISSION_SCOPES,
  ZAVORTH_EXTENSION_SANDBOX_PROFILES,
  ZAVORTH_EXTENSION_SOURCE_KINDS,
  ZAVORTH_EXTENSION_TRUST_LEVELS,
  type ZavorthExtensionCertification,
  type ZavorthExtensionCertificationFinding,
  type ZavorthExtensionContribution,
  type ZavorthExtensionHandler,
  type ZavorthExtensionInvocationContext,
  type ZavorthExtensionManifest,
  type ZavorthExtensionPermission,
  type ZavorthExtensionPolicy,
  type ZavorthExtensionRegistryEntry,
  type ZavorthExtensionSourceDescriptor,
} from '../contracts/ZavorthExtensionContract.js';
import type { ZavorthPluginManifest } from '../contracts/PluginManifestContract.js';

export type ZavorthExtensionRegistryOptions = {
  sourceTrustVerifier?: (
    source: ZavorthExtensionSourceDescriptor,
    context?: Partial<ZavorthExtensionInvocationContext>,
  ) => boolean | Promise<boolean>;
  approvalVerifier?: (
    context: ZavorthExtensionInvocationContext,
  ) => boolean | Promise<boolean>;
  permissionVerifier?: (
    context: ZavorthExtensionInvocationContext,
  ) => boolean | Promise<boolean>;
  sandboxExecutor?: unknown;
  now?: () => Date;
};

const PLUGIN_PERMISSION_KIND_MAP: Record<string, ZavorthExtensionPermission['kind']> = {
  'network.external': 'network',
  'network.local': 'network',
};

function mapPluginPermissionKind(kind: string): ZavorthExtensionPermission['kind'] {
  const normalized = PLUGIN_PERMISSION_KIND_MAP[kind] || kind;
  if (!ZAVORTH_EXTENSION_PERMISSION_KINDS.includes(normalized as ZavorthExtensionPermission['kind'])) {
    return 'network';
  }
  return normalized as ZavorthExtensionPermission['kind'];
}

type StoredExtensionRecord = {
  manifest: ZavorthExtensionManifest;
  handlers: Record<string, ZavorthExtensionHandler>;
  certification: ZavorthExtensionCertification;
  registeredAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as unknown as T;
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      result[key] = cloneValue(value[key]);
    }
    return result as unknown as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value) as T;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
    return Object.freeze(value) as T;
  }
  return value;
}

export class ZavorthExtensionRegistryService {
  private static readonly KINDS = new Set<string>(ZAVORTH_EXTENSION_KINDS);

  private static readonly SOURCE_KINDS = new Set<string>(ZAVORTH_EXTENSION_SOURCE_KINDS);

  private static readonly TRUST_LEVELS = new Set<string>(ZAVORTH_EXTENSION_TRUST_LEVELS);

  private static readonly SANDBOX_PROFILES = new Set<string>(ZAVORTH_EXTENSION_SANDBOX_PROFILES);

  private static readonly PERMISSION_KINDS = new Set<string>(ZAVORTH_EXTENSION_PERMISSION_KINDS);

  private static readonly PERMISSION_SCOPES = new Set<string>(ZAVORTH_EXTENSION_PERMISSION_SCOPES);

  private readonly entries = new Map<string, StoredExtensionRecord>();

  private readonly usedApprovalIds = new Set<string>();

  private readonly sourceTrustVerifier: ZavorthExtensionRegistryOptions['sourceTrustVerifier'] | null;

  private readonly approvalVerifier: ZavorthExtensionRegistryOptions['approvalVerifier'] | null;

  private readonly permissionVerifier: ZavorthExtensionRegistryOptions['permissionVerifier'] | null;

  private readonly sandboxExecutor: unknown;

  private readonly now: () => Date;

  constructor(options: ZavorthExtensionRegistryOptions = {}) {
    this.sourceTrustVerifier = options.sourceTrustVerifier ?? null;
    this.approvalVerifier = options.approvalVerifier ?? null;
    this.permissionVerifier = options.permissionVerifier ?? null;
    this.sandboxExecutor = options.sandboxExecutor ?? null;
    this.now = options.now || (() => new Date());
  }

  public register(input: {
    manifest: ZavorthExtensionManifest;
    handlers: Record<string, ZavorthExtensionHandler>;
  }): ZavorthExtensionRegistryEntry {
    const certification = this.certify(input.manifest);
    if (certification.status !== 'certified') {
      throw new Error(
        `extension_certification_rejected: ${certification.findings.map((finding) => finding.code).join(', ')}`,
      );
    }

    const id = this.normalizeId(input.manifest.id);
    const handlers = input.handlers || {};
    const missing = (input.manifest.contributions || [])
      .map((contribution) => String(contribution?.exportName || '').trim())
      .filter((exportName) => Boolean(exportName) && typeof handlers[exportName] !== 'function');
    if (missing.length > 0) {
      throw new Error('handler_missing');
    }
    if (this.entries.has(id)) {
      throw new Error('already registered');
    }

    const record: StoredExtensionRecord = {
      manifest: deepFreeze(cloneValue(input.manifest)),
      handlers: { ...handlers },
      certification: cloneValue(certification),
      registeredAt: this.now().toISOString(),
    };
    this.entries.set(id, record);
    return this.toEntry(record);
  }

  public registerPluginManifest(
    legacyPluginManifest: ZavorthPluginManifest,
    handlers: Record<string, ZavorthExtensionHandler>,
  ): ZavorthExtensionRegistryEntry {
    const plugin = legacyPluginManifest;
    const manifest: ZavorthExtensionManifest = {
      schemaVersion: ZAVORTH_EXTENSION_API_VERSION,
      id: String(plugin.id || '').trim(),
      label: String(plugin.label || plugin.id || '').trim(),
      version: String(plugin.version || '1.0.0').trim(),
      summary: String(plugin.summary || plugin.description || '').trim(),
      source: cloneValue(plugin.source) as ZavorthExtensionSourceDescriptor,
      compatibility: {
        zavorthVersion: String(plugin.compatibility?.zavorthVersion || '>=2'),
        extensionApiVersion: ZAVORTH_EXTENSION_API_VERSION,
      },
      contributions: (plugin.capabilities || []).map((capability) => ({
        id: String(capability.id || '').trim(),
        kind: String(plugin.moduleKind || 'plugin') as ZavorthExtensionManifest['contributions'][number]['kind'],
        exportName: String(plugin.entrypoint?.exportName || 'default').trim(),
        capabilityIds: [String(capability.id || '').trim()],
        label: capability.label,
        summary: capability.summary,
      })),
      permissions: (plugin.permissions || []).map((permission) => ({
        kind: mapPluginPermissionKind(permission.kind),
        scope: permission.scope,
        reason: String(permission.reason || ''),
        required: Boolean(permission.required),
      })),
      policy: cloneValue(plugin.policy) as ZavorthExtensionManifest['policy'],
      legacyPluginManifest: cloneValue(plugin),
    };
    return this.register({ manifest, handlers });
  }

  public certify(manifest: Partial<ZavorthExtensionManifest>): ZavorthExtensionCertification {
    const findings: ZavorthExtensionCertificationFinding[] = [];
    const add = (code: string, message: string): void => {
      findings.push({ code, message });
    };

    if (manifest.schemaVersion !== ZAVORTH_EXTENSION_API_VERSION) {
      add('schema_unsupported', `schemaVersion must be ${ZAVORTH_EXTENSION_API_VERSION}`);
    }

    const policy = manifest.policy as Partial<ZavorthExtensionPolicy> | undefined;
    if (!policy || typeof policy !== 'object') {
      add('policy_required', 'Extension manifest must declare a policy.');
    } else {
      if (!ZavorthExtensionRegistryService.SANDBOX_PROFILES.has(String(policy.sandboxProfile ?? ''))) {
        add('sandbox_invalid', `policy.sandboxProfile must be one of ${ZAVORTH_EXTENSION_SANDBOX_PROFILES.join(', ')}`);
      }
      if (!ZavorthExtensionRegistryService.TRUST_LEVELS.has(String(policy.defaultTrust ?? ''))) {
        add('policy_flag_invalid', 'policy.defaultTrust must be one of review, trusted, blocked');
      }
      for (const flag of [
        'requiresApproval',
        'allowNetworkByDefault',
        'allowFilesystemWriteByDefault',
        'allowProcessSpawnByDefault',
      ] as const) {
        if (typeof policy[flag] !== 'boolean') {
          add('policy_flag_invalid', `policy.${flag} must be a boolean`);
        }
      }
    }

    const contributions = Array.isArray(manifest.contributions) ? manifest.contributions : [];
    if (contributions.length === 0) {
      add('contribution_required', 'Extension manifest must declare at least one contribution.');
    }
    for (const contribution of contributions) {
      if (!contribution || typeof contribution !== 'object') {
        continue;
      }
      if (!ZavorthExtensionRegistryService.KINDS.has(String(contribution.kind ?? ''))) {
        add('contribution_kind_invalid', `contribution.kind ${String(contribution.kind ?? '')} is unsupported`);
      }
      if (!String(contribution.exportName ?? '').trim()) {
        add('export_name_required', 'Each contribution must declare an exportName.');
      }
      const capabilityIds = Array.isArray(contribution.capabilityIds) ? contribution.capabilityIds : [];
      const seenCapability = new Set<string>();
      for (const capabilityId of capabilityIds) {
        const normalized = this.normalizeId(String(capabilityId ?? ''));
        if (!normalized) {
          add('capability_id_empty', 'Capability ids must not be empty.');
        } else if (seenCapability.has(normalized)) {
          add('capability_id_duplicate', `Duplicate capability id ${normalized}`);
        } else {
          seenCapability.add(normalized);
        }
      }
      const dependencies = Array.isArray(contribution.dependsOn) ? contribution.dependsOn : [];
      const seenDependency = new Set<string>();
      for (const dependency of dependencies) {
        const raw = String(dependency ?? '');
        const normalized = this.normalizeId(raw);
        if (!normalized || raw.includes('/')) {
          add('dependency_id_invalid', `Invalid dependency id ${raw}`);
        }
        if (normalized) {
          if (seenDependency.has(normalized)) {
            add('dependency_duplicate', `Duplicate dependency id ${normalized}`);
          }
          seenDependency.add(normalized);
        }
      }
    }

    const source = manifest.source as Partial<ZavorthExtensionSourceDescriptor> | undefined;
    if (source && typeof source === 'object') {
      if (!ZavorthExtensionRegistryService.SOURCE_KINDS.has(String(source.kind ?? ''))) {
        add('source_kind_invalid', `source.kind must be one of ${ZAVORTH_EXTENSION_SOURCE_KINDS.join(', ')}`);
      }
      if (typeof source.trusted !== 'boolean') {
        add('trust_invalid', 'source.trusted must be a boolean');
      }
    }

    const permissions = Array.isArray(manifest.permissions) ? (manifest.permissions as ZavorthExtensionPermission[]) : [];
    const seenPermission = new Set<string>();
    for (const permission of permissions) {
      if (!permission || typeof permission !== 'object') {
        continue;
      }
      if (!ZavorthExtensionRegistryService.PERMISSION_KINDS.has(String(permission.kind ?? ''))) {
        add('permission_kind_invalid', `permission.kind ${String(permission.kind ?? '')} is unsupported`);
      }
      if (!ZavorthExtensionRegistryService.PERMISSION_SCOPES.has(String(permission.scope ?? ''))) {
        add('permission_scope_invalid', `permission.scope ${String(permission.scope ?? '')} is unsupported`);
      }
      if (!String(permission.reason ?? '').trim()) {
        add('permission_reason_required', 'Each permission must declare a reason.');
      }
      if (typeof permission.required !== 'boolean') {
        add('permission_required_invalid', 'permission.required must be a boolean');
      }
      const key = `${this.normalizeId(String(permission.kind ?? ''))}:${this.normalizeId(String(permission.scope ?? ''))}`;
      if (seenPermission.has(key)) {
        add('permission_duplicate', `Duplicate permission ${key}`);
      } else {
        seenPermission.add(key);
      }
    }

    if (policy && typeof policy === 'object') {
      const requiresNetworkPermission =
        policy.allowNetworkByDefault === true || policy.sandboxProfile === 'networked';
      if (requiresNetworkPermission) {
        const hasNetworkPermission = permissions.some(
          (permission) => permission && this.normalizeId(String(permission.kind ?? '')) === 'network',
        );
        if (!hasNetworkPermission) {
          add('network_permission_required', 'Network access requires a declared network permission.');
        }
      }
    }

    return {
      status: findings.length === 0 ? 'certified' : 'rejected',
      findings,
    };
  }

  public certifyModule(input: {
    manifest: ZavorthExtensionManifest;
    handlers: Record<string, ZavorthExtensionHandler>;
  }): ZavorthExtensionCertification {
    const base = this.certify(input.manifest);
    const findings = [...base.findings];
    const handlers = input.handlers || {};
    for (const contribution of input.manifest.contributions || []) {
      const exportName = String(contribution?.exportName || '').trim();
      if (exportName && typeof handlers[exportName] !== 'function') {
        findings.push({
          code: 'handler_missing',
          message: `No handler for declared export ${exportName}`,
        });
      }
    }
    return {
      status: findings.length === 0 ? 'certified' : 'rejected',
      findings,
    };
  }

  public list(kind?: ZavorthExtensionManifest['contributions'][number]['kind'] | string): ZavorthExtensionRegistryEntry[] {
    const normalizedKind = kind ? String(kind).trim() : '';
    return Array.from(this.entries.values())
      .filter((record) => {
        if (!normalizedKind) {
          return true;
        }
        return (record.manifest.contributions || []).some((contribution) => contribution?.kind === normalizedKind);
      })
      .map((record) => this.toEntry(record));
  }

  public get(id: string): ZavorthExtensionRegistryEntry | null {
    const record = this.entries.get(this.normalizeId(id));
    return record ? this.toEntry(record) : null;
  }

  public async invoke(
    id: string,
    capabilityId: string,
    input: unknown,
    context: Partial<ZavorthExtensionInvocationContext> = {},
  ): Promise<unknown> {
    const record = this.entries.get(this.normalizeId(id));
    if (!record) {
      throw new Error(`extension_not_registered: ${id}`);
    }
    const manifest = record.manifest;
    const policy = manifest.policy;

    if (policy.defaultTrust === 'blocked') {
      throw new Error('extension_policy_blocked');
    }

    if (policy.sandboxProfile === 'local-exec' && !this.sandboxExecutor) {
      throw new Error('extension_sandbox_executor_required');
    }

    const requiredPermissions = (manifest.permissions || []).filter((permission) => permission?.required === true);
    if (requiredPermissions.length > 0) {
      const granted = Array.isArray(context.grantedPermissions) ? context.grantedPermissions : [];
      for (const permission of requiredPermissions) {
        const grantKey = `${permission.kind}:${permission.scope}`;
        if (!granted.includes(grantKey)) {
          throw new Error('extension_permission_required');
        }
        if (this.permissionVerifier) {
          let allowed = false;
          try {
            allowed =
              (await this.permissionVerifier(this.buildInvocationContext(record, capabilityId, input, context))) === true;
          } catch {
            allowed = false;
          }
          if (!allowed) {
            throw new Error('extension_permission_required');
          }
        }
      }
    }

    let trustGranted = false;
    if (this.sourceTrustVerifier) {
      try {
        trustGranted = (await this.sourceTrustVerifier(manifest.source, context)) === true;
      } catch {
        trustGranted = false;
      }
    }

    const needsApproval = policy.requiresApproval === true || !trustGranted;
    if (needsApproval) {
      if (!this.approvalVerifier) {
        throw new Error('extension_approval_required');
      }
      const approvalId = String(context.approvalId ?? '');
      if (!approvalId) {
        throw new Error('extension_approval_required');
      }
      if (this.usedApprovalIds.has(approvalId)) {
        throw new Error('extension_approval_replayed');
      }
      let approved = false;
      try {
        approved =
          (await this.approvalVerifier(this.buildInvocationContext(record, capabilityId, input, context))) === true;
      } catch {
        approved = false;
      }
      if (!approved) {
        throw new Error('extension_approval_invalid');
      }
      this.usedApprovalIds.add(approvalId);
    }

    const contribution = this.resolveContribution(manifest, capabilityId);
    if (!contribution) {
      throw new Error('extension_contribution_missing');
    }
    const handler = record.handlers[contribution.exportName];
    if (typeof handler !== 'function') {
      throw new Error('handler_missing');
    }

    return handler(input, this.buildInvocationContext(record, capabilityId, input, context, contribution));
  }

  private buildInvocationContext(
    record: StoredExtensionRecord,
    capabilityId: string,
    input: unknown,
    context: Partial<ZavorthExtensionInvocationContext>,
    contribution?: ZavorthExtensionContribution,
  ): ZavorthExtensionInvocationContext {
    const resolved = contribution ?? this.resolveContribution(record.manifest, capabilityId);
    return {
      ...context,
      extensionId: record.manifest.id,
      capabilityId: String(capabilityId ?? ''),
      input,
      contribution: resolved as ZavorthExtensionContribution,
      manifest: record.manifest,
    };
  }

  private resolveContribution(
    manifest: ZavorthExtensionManifest,
    capabilityId: string,
  ): ZavorthExtensionContribution | null {
    const normalized = this.normalizeId(String(capabilityId ?? ''));
    if (!normalized) {
      return null;
    }
    return (
      (manifest.contributions || []).find((contribution) => {
        if (this.normalizeId(String(contribution.id ?? '')) === normalized) {
          return true;
        }
        return (contribution.capabilityIds || []).some(
          (capabilityIdValue) => this.normalizeId(String(capabilityIdValue ?? '')) === normalized,
        );
      }) ?? null
    );
  }

  private toEntry(record: StoredExtensionRecord): ZavorthExtensionRegistryEntry {
    return {
      manifest: cloneValue(record.manifest),
      certification: cloneValue(record.certification),
      registeredAt: record.registeredAt,
    };
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
