export const ZAVORTH_EXTENSION_PLUGIN_SDK_CONTRACT_VERSION =
  '2026-05-24.extension-plugin-sdk-phase-8' as const;

export type ZavorthExtensionPluginSdkAction =
  | 'sdk.status'
  | 'manifest.validate'
  | 'marketplace.list'
  | 'lifecycle.plan'
  | 'lifecycle.apply'
  | 'dev.hot-reload'
  | 'receipts.audit';

export type ZavorthExtensionPluginSdkStatus =
  | 'ready'
  | 'preview'
  | 'approval-required'
  | 'blocked'
  | 'needs-configuration';

export type ZavorthExtensionPluginLifecycleAction =
  | 'install'
  | 'enable'
  | 'disable'
  | 'uninstall'
  | 'upgrade'
  | 'invoke'
  | 'doctor';

export type ZavorthExtensionPluginPermissionKind =
  | 'network.external'
  | 'network.local'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'secret.read'
  | 'process.spawn'
  | 'artifact.read'
  | 'artifact.write'
  | 'memory.read'
  | 'memory.write'
  | 'channel.send'
  | 'provider.call'
  | 'node.invoke';

export type ZavorthExtensionPluginPermissionScope =
  | 'none'
  | 'local'
  | 'workspace'
  | 'external'
  | 'system';

export type ZavorthExtensionPluginManifest = {
  schemaVersion: 'zavorth.plugin-sdk.v1';
  id: string;
  name: string;
  version: string;
  description: string;
  entrypoint: {
    module: string;
    exportName: string;
    runtime: 'node' | 'browser' | 'remote' | 'none';
  };
  permissions: Array<{
    kind: ZavorthExtensionPluginPermissionKind;
    scope: ZavorthExtensionPluginPermissionScope;
    reason: string;
    required: boolean;
  }>;
  lifecycle: {
    actions: ZavorthExtensionPluginLifecycleAction[];
    defaultAction: ZavorthExtensionPluginLifecycleAction;
  };
  integrity?: {
    checksum?: string | null;
    signature?: string | null;
    publicKeyId?: string | null;
  };
  metadata?: Record<string, unknown>;
};

export type ZavorthExtensionPluginManifestValidation = {
  status: 'valid' | 'invalid';
  manifestId: string | null;
  canonicalChecksum: string | null;
  declaredChecksum: string | null;
  checksumStatus: 'match' | 'missing' | 'mismatch';
  signatureStatus: 'verified' | 'unsigned' | 'untrusted' | 'missing-key';
  findings: string[];
};

export type ZavorthExtensionPluginPermissionReview = {
  status: 'safe' | 'approval-required' | 'blocked';
  permissions: Array<{
    kind: ZavorthExtensionPluginPermissionKind;
    scope: ZavorthExtensionPluginPermissionScope;
    decision: 'allow' | 'approval-required' | 'blocked';
    reason: string;
  }>;
  blockedCount: number;
  approvalRequiredCount: number;
};

export type ZavorthExtensionPluginMarketplaceEntry = {
  id: string;
  label: string;
  version: string;
  source: 'local-registry' | 'workspace' | 'builtin-template';
  status: 'available' | 'installed' | 'enabled' | 'review';
  checksum: string;
  signatureStatus: 'verified' | 'unsigned' | 'untrusted' | 'missing-key';
  installCommand: string;
};

export type ZavorthExtensionPluginLifecyclePlan = {
  action: ZavorthExtensionPluginLifecycleAction;
  pluginId: string | null;
  status: 'preview' | 'approval-required' | 'applied' | 'blocked';
  willMutateState: boolean;
  approvalRequired: boolean;
  reason: string;
  receiptId: string;
};

export type ZavorthExtensionPluginHotReloadDev = {
  status: 'ready' | 'disabled' | 'needs-configuration';
  enabled: boolean;
  watchRoots: string[];
  reloadMode: 'manifest-only' | 'dev-runtime';
  command: string;
  constraints: {
    noExternalNetworkByDefault: true;
    reloadRequiresManifestValidation: true;
    reloadDoesNotBypassPermissions: true;
    receiptsRequired: true;
  };
};

export type ZavorthExtensionPluginReceipt = {
  id: string;
  kind: 'manifest' | 'permission' | 'integrity' | 'marketplace' | 'lifecycle' | 'hot-reload' | 'policy';
  status: 'done' | 'planned' | 'approval-required' | 'blocked';
  summary: string;
  rawSecretSerialized: false;
};

export type ZavorthExtensionPluginSdkInput = {
  action?: ZavorthExtensionPluginSdkAction | 'status' | 'validate' | 'marketplace' | 'plan' | 'apply' | 'hot-reload' | 'receipts' | null;
  manifestPath?: string | null;
  manifestJson?: string | null;
  pluginId?: string | null;
  lifecycleAction?: ZavorthExtensionPluginLifecycleAction | null;
  approvalId?: string | null;
  dev?: boolean;
  workspace?: string | null;
  sourceSurface?: string | null;
  actorId?: string | null;
};

export type ZavorthExtensionPluginSdkSnapshot = {
  contractVersion: typeof ZAVORTH_EXTENSION_PLUGIN_SDK_CONTRACT_VERSION;
  generatedAt: string;
  source: 'ZavorthExtensionPluginSdkService';
  action: ZavorthExtensionPluginSdkAction;
  status: ZavorthExtensionPluginSdkStatus;
  workspace: string;
  manifestSchema: {
    schemaVersion: 'zavorth.plugin-sdk.v1';
    requiredFields: string[];
    permissionKinds: ZavorthExtensionPluginPermissionKind[];
    lifecycleActions: ZavorthExtensionPluginLifecycleAction[];
  };
  validation: ZavorthExtensionPluginManifestValidation;
  permissions: ZavorthExtensionPluginPermissionReview;
  marketplaceLocal: {
    status: 'ready' | 'empty';
    entries: ZavorthExtensionPluginMarketplaceEntry[];
  };
  lifecycle: ZavorthExtensionPluginLifecyclePlan;
  hotReloadDev: ZavorthExtensionPluginHotReloadDev;
  receipts: ZavorthExtensionPluginReceipt[];
  safety: {
    manifestRequiredForInstall: true;
    checksumRequiredForTrustedInstall: true;
    signatureRequiredForTrustedRemoteInstall: true;
    permissionsCannotEscalateSilently: true;
    lifecycleMutationsRequireApproval: true;
    hotReloadDoesNotBypassPolicy: true;
    receiptsRequiredPerPluginAction: true;
    rawSecretsNeverSerialized: true;
  };
  commands: {
    status: 'zavorth plugins sdk';
    validate: 'zavorth plugins sdk --action manifest.validate --manifest <path>';
    marketplace: 'zavorth plugins marketplace';
    lifecyclePlan: 'zavorth plugins sdk --action lifecycle.plan --plugin <id> --lifecycle enable';
    lifecycleApply: 'zavorth plugins sdk --action lifecycle.apply --plugin <id> --lifecycle enable --approval-id <id>';
    check: 'npm run zavorth:extension-plugin-sdk:check --silent';
  };
  nextSafeAction: string;
};
