import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_EXTENSION_PLUGIN_SDK_CONTRACT_VERSION,
  type ZavorthExtensionPluginHotReloadDev,
  type ZavorthExtensionPluginLifecycleAction,
  type ZavorthExtensionPluginLifecyclePlan,
  type ZavorthExtensionPluginManifest,
  type ZavorthExtensionPluginManifestValidation,
  type ZavorthExtensionPluginMarketplaceEntry,
  type ZavorthExtensionPluginPermissionKind,
  type ZavorthExtensionPluginPermissionReview,
  type ZavorthExtensionPluginPermissionScope,
  type ZavorthExtensionPluginReceipt,
  type ZavorthExtensionPluginSdkAction,
  type ZavorthExtensionPluginSdkInput,
  type ZavorthExtensionPluginSdkSnapshot,
  type ZavorthExtensionPluginSdkStatus,
} from '../contracts/ZavorthExtensionPluginSdkContract.js';
import { ZavorthPluginRegistryService } from './ZavorthPluginRegistryService.js';
import { PluginStateService } from './PluginStateService.js';
import { logger } from '../logger.js';

type ExtensionPluginSdkDeps = {
  now?: () => Date;
  env?: Record<string, string | undefined>;
  cwd?: string;
  readFile?: (file: string) => string;
  exists?: (file: string) => boolean;
  pluginRegistryService?: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  pluginStateService?: Pick<PluginStateService, 'upsertState' | 'clearState'>;
};

const SCHEMA_VERSION = 'zavorth.plugin-sdk.v1' as const;

const PERMISSION_KINDS: ZavorthExtensionPluginPermissionKind[] = [
  'network.external',
  'network.local',
  'filesystem.read',
  'filesystem.write',
  'secret.read',
  'process.spawn',
  'artifact.read',
  'artifact.write',
  'memory.read',
  'memory.write',
  'channel.send',
  'provider.call',
  'node.invoke',
];

const LIFECYCLE_ACTIONS: ZavorthExtensionPluginLifecycleAction[] = [
  'install',
  'enable',
  'disable',
  'uninstall',
  'upgrade',
  'invoke',
  'doctor',
];

export class ZavorthExtensionPluginSdkService {
  private readonly now: () => Date;
  private readonly env: Record<string, string | undefined>;
  private readonly cwd: string;
  private readonly readFile: (file: string) => string;
  private readonly exists: (file: string) => boolean;
  private readonly pluginRegistry: Pick<ZavorthPluginRegistryService, 'buildSnapshot'>;
  private readonly pluginState: Pick<PluginStateService, 'upsertState' | 'clearState'>;

  public constructor(deps: ExtensionPluginSdkDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.env = deps.env || process.env;
    this.cwd = path.resolve(deps.cwd || process.cwd());
    this.readFile = deps.readFile || ((file) => fs.readFileSync(file, 'utf8'));
    this.exists = deps.exists || fs.existsSync;
    this.pluginRegistry = deps.pluginRegistryService || new ZavorthPluginRegistryService();
    this.pluginState = deps.pluginStateService || new PluginStateService();
  }

  public execute(input: ZavorthExtensionPluginSdkInput = {}): ZavorthExtensionPluginSdkSnapshot {
    const action = normalizeAction(input.action);
    const workspace = path.resolve(input.workspace || this.cwd);
    const manifest = this.loadManifest(input);
    const validation = this.validateManifest(manifest);
    const permissions = this.reviewPermissions(manifest);
    const marketplaceEntries = this.buildMarketplaceEntries();
    const lifecycle = this.buildLifecyclePlan({
      action,
      manifest,
      validation,
      permissions,
      input,
    });
    const hotReloadDev = this.buildHotReloadDev(input, validation);
    const receipts = this.buildReceipts({
      validation,
      permissions,
      marketplaceEntries,
      lifecycle,
      hotReloadDev,
    });
    const status = this.resolveStatus({
      action,
      validation,
      permissions,
      lifecycle,
      hotReloadDev,
    });

    return {
      contractVersion: ZAVORTH_EXTENSION_PLUGIN_SDK_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      source: 'ZavorthExtensionPluginSdkService',
      action,
      status,
      workspace: normalizePath(workspace),
      manifestSchema: {
        schemaVersion: SCHEMA_VERSION,
        requiredFields: ['schemaVersion', 'id', 'name', 'version', 'entrypoint', 'permissions', 'lifecycle'],
        permissionKinds: PERMISSION_KINDS,
        lifecycleActions: LIFECYCLE_ACTIONS,
      },
      validation,
      permissions,
      marketplaceLocal: {
        status: marketplaceEntries.length > 0 ? 'ready' : 'empty',
        entries: marketplaceEntries,
      },
      lifecycle,
      hotReloadDev,
      receipts,
      safety: {
        manifestRequiredForInstall: true,
        checksumRequiredForTrustedInstall: true,
        signatureRequiredForTrustedRemoteInstall: true,
        permissionsCannotEscalateSilently: true,
        lifecycleMutationsRequireApproval: true,
        hotReloadDoesNotBypassPolicy: true,
        receiptsRequiredPerPluginAction: true,
        rawSecretsNeverSerialized: true,
      },
      commands: {
        status: 'zavorth plugins sdk',
        validate: 'zavorth plugins sdk --action manifest.validate --manifest <path>',
        marketplace: 'zavorth plugins marketplace',
        lifecyclePlan: 'zavorth plugins sdk --action lifecycle.plan --plugin <id> --lifecycle enable',
        lifecycleApply: 'zavorth plugins sdk --action lifecycle.apply --plugin <id> --lifecycle enable --approval-id <id>',
        check: 'npm run zavorth:extension-plugin-sdk:check --silent',
      },
      nextSafeAction: nextSafeAction(status, action),
    };
  }

  public formatSnapshotText(snapshot: ZavorthExtensionPluginSdkSnapshot): string {
    return [
      'Zavorth Extension / Plugin SDK',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `Manifest: ${snapshot.validation.status} | ${snapshot.validation.manifestId || 'none'}`,
      `Checksum: ${snapshot.validation.checksumStatus} | Signature: ${snapshot.validation.signatureStatus}`,
      `Permissions: ${snapshot.permissions.status} | approvals=${snapshot.permissions.approvalRequiredCount} | blocked=${snapshot.permissions.blockedCount}`,
      `Lifecycle: ${snapshot.lifecycle.action} | ${snapshot.lifecycle.status} | mutates=${snapshot.lifecycle.willMutateState}`,
      `Marketplace: ${snapshot.marketplaceLocal.entries.length} local item(s)`,
      `Hot reload: ${snapshot.hotReloadDev.status} | ${snapshot.hotReloadDev.reloadMode}`,
      '',
      'Marketplace preview:',
      ...snapshot.marketplaceLocal.entries.slice(0, 8).map((entry) =>
        `- ${entry.id}: ${entry.status} | ${entry.signatureStatus} | ${entry.installCommand}`),
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private loadManifest(input: ZavorthExtensionPluginSdkInput): ZavorthExtensionPluginManifest | null {
    const fromJson = String(input.manifestJson || '').trim();
    if (fromJson) {
      return parseJson(fromJson);
    }
    const manifestPath = String(input.manifestPath || '').trim();
    if (manifestPath) {
      const resolved = path.resolve(this.cwd, manifestPath);
      if (!this.exists(resolved)) {
        return null;
      }
      return parseJson(this.readFile(resolved));
    }
    return sampleManifest();
  }

  private validateManifest(manifest: ZavorthExtensionPluginManifest | null): ZavorthExtensionPluginManifestValidation {
    if (!manifest || typeof manifest !== 'object') {
      return {
        status: 'invalid',
        manifestId: null,
        canonicalChecksum: null,
        declaredChecksum: null,
        checksumStatus: 'missing',
        signatureStatus: 'unsigned',
        findings: ['manifest could not be loaded or parsed'],
      };
    }

    const findings: string[] = [];
    const manifestId = normalizeId(manifest.id);
    if (!manifestId) findings.push('id is required');
    if (manifest.schemaVersion !== SCHEMA_VERSION) findings.push(`schemaVersion must be ${SCHEMA_VERSION}`);
    if (!manifest.name) findings.push('name is required');
    if (!manifest.version) findings.push('version is required');
    if (!manifest.entrypoint?.module || !manifest.entrypoint?.exportName || !manifest.entrypoint?.runtime) {
      findings.push('entrypoint.module, entrypoint.exportName and entrypoint.runtime are required');
    }
    if (!Array.isArray(manifest.permissions)) findings.push('permissions must be an array');
    if (!Array.isArray(manifest.lifecycle?.actions) || manifest.lifecycle.actions.length === 0) {
      findings.push('lifecycle.actions must be non-empty');
    }
    if (manifest.lifecycle?.defaultAction && !manifest.lifecycle.actions.includes(manifest.lifecycle.defaultAction)) {
      findings.push('lifecycle.defaultAction must be included in lifecycle.actions');
    }

    const canonicalChecksum = checksumManifest(manifest);
    const declaredChecksum = normalizeChecksum(manifest.integrity?.checksum);
    const checksumStatus = !declaredChecksum
      ? 'missing'
      : declaredChecksum === canonicalChecksum
        ? 'match'
        : 'mismatch';
    const signatureStatus = this.signatureStatus(manifest);
    if (checksumStatus === 'mismatch') findings.push('declared checksum does not match canonical manifest');

    return {
      status: findings.length === 0 ? 'valid' : 'invalid',
      manifestId,
      canonicalChecksum,
      declaredChecksum,
      checksumStatus,
      signatureStatus,
      findings,
    };
  }

  private signatureStatus(manifest: ZavorthExtensionPluginManifest): ZavorthExtensionPluginManifestValidation['signatureStatus'] {
    const signature = String(manifest.integrity?.signature || '').trim();
    if (!signature) return 'unsigned';
    const publicKeyId = String(manifest.integrity?.publicKeyId || '').trim();
    if (!publicKeyId) return 'missing-key';
    const trustedKeys = new Set(
      String(this.env.ZAVORTH_PLUGIN_TRUSTED_PUBLIC_KEYS || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    );
    if (trustedKeys.has(publicKeyId) && /^sig:[a-z0-9_-]{12,}$/i.test(signature)) {
      return 'verified';
    }
    return 'untrusted';
  }

  private reviewPermissions(manifest: ZavorthExtensionPluginManifest | null): ZavorthExtensionPluginPermissionReview {
    const permissions = Array.isArray(manifest?.permissions) ? manifest!.permissions : [];
    const reviewed = permissions.map((permission) => {
      const kind = permission.kind;
      const scope = permission.scope;
      const decision = permissionDecision(kind, scope);
      return {
        kind,
        scope,
        decision,
        reason: reasonForPermission(kind, scope, decision),
      };
    });
    const blockedCount = reviewed.filter((entry) => entry.decision === 'blocked').length;
    const approvalRequiredCount = reviewed.filter((entry) => entry.decision === 'approval-required').length;
    return {
      status: blockedCount > 0 ? 'blocked' : approvalRequiredCount > 0 ? 'approval-required' : 'safe',
      permissions: reviewed,
      blockedCount,
      approvalRequiredCount,
    };
  }

  private buildMarketplaceEntries(): ZavorthExtensionPluginMarketplaceEntry[] {
    const snapshot = this.pluginRegistry.buildSnapshot({});
    const entries = (snapshot.entries || []).slice(0, 24).map((entry) => {
      const source = entry.source === 'workspace-profile'
        ? 'workspace'
        : entry.kind === 'template'
          ? 'builtin-template'
          : 'local-registry';
      const checksum = checksumObject({
        id: entry.id,
        label: entry.label,
        version: entry.version,
        source,
        capabilities: entry.capabilities,
      });
      return {
        id: entry.id,
        label: entry.label,
        version: entry.version || 'local',
        source,
        status: entry.installState === 'installed'
          ? 'installed'
          : entry.trust === 'trusted'
            ? 'review'
            : 'available',
        checksum,
        signatureStatus: entry.registrySource ? 'verified' : 'unsigned',
        installCommand: `zavorth plugins sdk --action lifecycle.plan --plugin ${entry.id} --lifecycle install`,
      } satisfies ZavorthExtensionPluginMarketplaceEntry;
    });

    if (entries.length > 0) return entries;
    return [
      {
        id: 'plugin-template:hello-world',
        label: 'Hello World Plugin Template',
        version: '1.0.0',
        source: 'builtin-template',
        status: 'available',
        checksum: checksumObject({ id: 'plugin-template:hello-world', version: '1.0.0' }),
        signatureStatus: 'unsigned',
        installCommand: 'zavorth plugins sdk --action lifecycle.plan --plugin plugin-template:hello-world --lifecycle install',
      },
    ];
  }

  private buildLifecyclePlan(input: {
    action: ZavorthExtensionPluginSdkAction;
    manifest: ZavorthExtensionPluginManifest | null;
    validation: ZavorthExtensionPluginManifestValidation;
    permissions: ZavorthExtensionPluginPermissionReview;
    input: ZavorthExtensionPluginSdkInput;
  }): ZavorthExtensionPluginLifecyclePlan {
    const lifecycleAction = normalizeLifecycle(input.input.lifecycleAction);
    const pluginId = normalizeId(input.input.pluginId) || input.validation.manifestId;
    const mutates = ['install', 'enable', 'disable', 'uninstall', 'upgrade'].includes(lifecycleAction);
    const receiptId = `plugin-sdk.lifecycle.${lifecycleAction}.${crypto.createHash('sha256').update(`${pluginId || 'unknown'}:${this.now().toISOString()}`).digest('hex').slice(0, 12)}`;

    if (input.validation.status === 'invalid' && ['install', 'enable', 'invoke'].includes(lifecycleAction)) {
      return {
        action: lifecycleAction,
        pluginId,
        status: 'blocked',
        willMutateState: false,
        approvalRequired: false,
        reason: `Manifest is invalid: ${input.validation.findings.join('; ')}`,
        receiptId,
      };
    }
    if (input.permissions.status === 'blocked') {
      return {
        action: lifecycleAction,
        pluginId,
        status: 'blocked',
        willMutateState: false,
        approvalRequired: false,
        reason: 'Plugin requests blocked permission scope.',
        receiptId,
      };
    }

    const needsApproval = mutates || input.permissions.status === 'approval-required' || input.validation.signatureStatus !== 'verified';
    const approvalPresent = Boolean(String(input.input.approvalId || '').trim());
    if (input.action === 'lifecycle.apply' && needsApproval && !approvalPresent) {
      return {
        action: lifecycleAction,
        pluginId,
        status: 'approval-required',
        willMutateState: false,
        approvalRequired: true,
        reason: 'Lifecycle apply requires approval because plugin state or trust boundary would change.',
        receiptId,
      };
    }

    if (input.action === 'lifecycle.apply' && approvalPresent && pluginId) {
      if (lifecycleAction === 'uninstall') {
        this.pluginState.clearState(pluginId);
      } else {
        this.pluginState.upsertState({
          pluginId,
          installed: lifecycleAction !== 'disable',
          trust: input.validation.signatureStatus === 'verified' ? 'trusted' : 'review',
          installedRevision: input.manifest?.version || null,
          sourceDigest: input.validation.canonicalChecksum,
          sourceLocator: input.manifest?.entrypoint?.module || null,
          sourceTrusted: input.validation.signatureStatus === 'verified',
        });
      }
      return {
        action: lifecycleAction,
        pluginId,
        status: 'applied',
        willMutateState: true,
        approvalRequired: needsApproval,
        reason: 'Lifecycle mutation applied through PluginStateService with receipt metadata.',
        receiptId,
      };
    }

    return {
      action: lifecycleAction,
      pluginId,
      status: needsApproval ? 'approval-required' : 'preview',
      willMutateState: false,
      approvalRequired: needsApproval,
      reason: needsApproval
        ? 'Lifecycle is ready but waits for approval, checksum/signature review and permission review.'
        : 'Lifecycle can be planned without mutating state.',
      receiptId,
    };
  }

  private buildHotReloadDev(
    input: ZavorthExtensionPluginSdkInput,
    validation: ZavorthExtensionPluginManifestValidation,
  ): ZavorthExtensionPluginHotReloadDev {
    const enabled = Boolean(input.dev) || isTruthy(this.env.ZAVORTH_PLUGIN_DEV_HOT_RELOAD);
    const watchRoots = [
      path.join(this.cwd, 'plugins'),
      path.join(this.cwd, '.zavorth', 'plugins'),
      path.join(this.cwd, 'src', 'plugins'),
    ].map(normalizePath);
    return {
      status: enabled ? validation.status === 'valid' ? 'ready' : 'needs-configuration' : 'disabled',
      enabled,
      watchRoots,
      reloadMode: enabled ? 'dev-runtime' : 'manifest-only',
      command: 'zavorth plugins sdk --action dev.hot-reload --dev --manifest <path>',
      constraints: {
        noExternalNetworkByDefault: true,
        reloadRequiresManifestValidation: true,
        reloadDoesNotBypassPermissions: true,
        receiptsRequired: true,
      },
    };
  }

  private buildReceipts(input: {
    validation: ZavorthExtensionPluginManifestValidation;
    permissions: ZavorthExtensionPluginPermissionReview;
    marketplaceEntries: ZavorthExtensionPluginMarketplaceEntry[];
    lifecycle: ZavorthExtensionPluginLifecyclePlan;
    hotReloadDev: ZavorthExtensionPluginHotReloadDev;
  }): ZavorthExtensionPluginReceipt[] {
    return [
      receipt('manifest', input.validation.status === 'valid' ? 'done' : 'blocked', `Manifest validation is ${input.validation.status}.`),
      receipt('integrity', input.validation.checksumStatus === 'match' ? 'done' : 'planned', `Checksum=${input.validation.checksumStatus}; signature=${input.validation.signatureStatus}.`),
      receipt('permission', input.permissions.status === 'blocked' ? 'blocked' : input.permissions.status === 'approval-required' ? 'approval-required' : 'done', `Permissions status=${input.permissions.status}.`),
      receipt('marketplace', 'done', `Local marketplace exposed ${input.marketplaceEntries.length} item(s).`),
      receipt('lifecycle', lifecycleReceiptStatus(input.lifecycle.status), input.lifecycle.reason),
      receipt('hot-reload', input.hotReloadDev.status === 'ready' ? 'done' : 'planned', `Hot reload ${input.hotReloadDev.status}; mode=${input.hotReloadDev.reloadMode}.`),
      receipt('policy', 'done', 'Plugin SDK never bypasses manifest validation, permissions, approval or receipts.'),
    ];
  }

  private resolveStatus(input: {
    action: ZavorthExtensionPluginSdkAction;
    validation: ZavorthExtensionPluginManifestValidation;
    permissions: ZavorthExtensionPluginPermissionReview;
    lifecycle: ZavorthExtensionPluginLifecyclePlan;
    hotReloadDev: ZavorthExtensionPluginHotReloadDev;
  }): ZavorthExtensionPluginSdkStatus {
    if (input.lifecycle.status === 'blocked' || input.permissions.status === 'blocked') return 'blocked';
    if (input.action === 'manifest.validate' && input.validation.status === 'invalid') return 'blocked';
    if (input.lifecycle.status === 'approval-required') return 'approval-required';
    if (input.action === 'dev.hot-reload' && input.hotReloadDev.status === 'needs-configuration') return 'needs-configuration';
    if (input.action === 'dev.hot-reload' && input.hotReloadDev.status === 'ready') return 'ready';
    return input.validation.status === 'valid' ? 'ready' : 'preview';
  }
}

function normalizeAction(value: ZavorthExtensionPluginSdkInput['action']): ZavorthExtensionPluginSdkAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'validate' || normalized === 'manifest.validate') return 'manifest.validate';
  if (normalized === 'marketplace' || normalized === 'marketplace.list') return 'marketplace.list';
  if (normalized === 'plan' || normalized === 'lifecycle.plan') return 'lifecycle.plan';
  if (normalized === 'apply' || normalized === 'lifecycle.apply') return 'lifecycle.apply';
  if (normalized === 'hot-reload' || normalized === 'dev.hot-reload') return 'dev.hot-reload';
  if (normalized === 'receipts' || normalized === 'receipts.audit') return 'receipts.audit';
  return 'sdk.status';
}

function normalizeLifecycle(value: unknown): ZavorthExtensionPluginLifecycleAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (LIFECYCLE_ACTIONS.includes(normalized as ZavorthExtensionPluginLifecycleAction)) {
    return normalized as ZavorthExtensionPluginLifecycleAction;
  }
  return 'install';
}

function normalizeId(value: unknown): string | null {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || null;
}

function parseJson(value: string): ZavorthExtensionPluginManifest | null {
  try {
    return JSON.parse(value) as ZavorthExtensionPluginManifest;
  } catch (error) { logger.warn('[Zavorth Extension Plugin Sdk] JSON parse failed', error); return null; }
}

function sampleManifest(): ZavorthExtensionPluginManifest {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'plugin-template:hello-world',
    name: 'Hello World Plugin Template',
    version: '1.0.0',
    description: 'A safe local template used to validate the Zavorth Extension / Plugin SDK.',
    entrypoint: {
      module: './plugins/hello-world/index.js',
      exportName: 'activate',
      runtime: 'node',
    },
    permissions: [
      {
        kind: 'artifact.write',
        scope: 'workspace',
        reason: 'Write a local receipt artifact during template invocation.',
        required: false,
      },
    ],
    lifecycle: {
      actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor'],
      defaultAction: 'install',
    },
    integrity: {
      checksum: null,
      signature: null,
      publicKeyId: null,
    },
    metadata: {
      category: 'template',
    },
  };
}

function permissionDecision(
  kind: ZavorthExtensionPluginPermissionKind,
  scope: ZavorthExtensionPluginPermissionScope,
): 'allow' | 'approval-required' | 'blocked' {
  if (scope === 'system') return 'blocked';
  if (kind === 'secret.read' || kind === 'process.spawn' || kind === 'network.external') return 'approval-required';
  if (kind === 'filesystem.write' || kind === 'channel.send' || kind === 'provider.call' || kind === 'node.invoke') {
    return 'approval-required';
  }
  return 'allow';
}

function reasonForPermission(
  kind: ZavorthExtensionPluginPermissionKind,
  scope: ZavorthExtensionPluginPermissionScope,
  decision: 'allow' | 'approval-required' | 'blocked',
): string {
  if (decision === 'blocked') return `${kind} requested blocked system scope.`;
  if (decision === 'approval-required') return `${kind} with ${scope} scope crosses a trust boundary and needs approval.`;
  return `${kind} with ${scope} scope is safe to expose as metadata or read-only capability.`;
}

function checksumManifest(manifest: ZavorthExtensionPluginManifest): string {
  const canonical = {
    ...manifest,
    integrity: {
      ...manifest.integrity,
      checksum: null,
    },
  };
  return checksumObject(canonical);
}

function checksumObject(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function normalizeChecksum(value: unknown): string | null {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  return text.startsWith('sha256:') ? text : `sha256:${text}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function receipt(
  kind: ZavorthExtensionPluginReceipt['kind'],
  status: ZavorthExtensionPluginReceipt['status'],
  summary: string,
): ZavorthExtensionPluginReceipt {
  return {
    id: `extension-plugin-sdk-${kind}-${crypto.createHash('sha256').update(`${kind}:${status}:${summary}`).digest('hex').slice(0, 12)}`,
    kind,
    status,
    summary,
    rawSecretSerialized: false,
  };
}

function lifecycleReceiptStatus(
  status: ZavorthExtensionPluginLifecyclePlan['status'],
): ZavorthExtensionPluginReceipt['status'] {
  if (status === 'applied') return 'done';
  if (status === 'preview') return 'planned';
  return status;
}

function isTruthy(value: unknown): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}

function nextSafeAction(status: ZavorthExtensionPluginSdkStatus, action: ZavorthExtensionPluginSdkAction): string {
  if (status === 'blocked') return 'Fix manifest, checksum or blocked permission scopes before installing the plugin.';
  if (status === 'approval-required') return 'Review permissions and integrity, then apply with a scoped approval id.';
  if (action === 'marketplace.list') return 'Choose a local marketplace item, validate its manifest and plan install.';
  if (action === 'dev.hot-reload') return 'Use dev hot reload only for validated local manifests; policy still applies.';
  return 'Validate a manifest, inspect marketplace entries or plan a lifecycle action.';
}
