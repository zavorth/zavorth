import type { PluginConnectionDescriptor } from '../connection/index.js';

export const ZAVORTH_PLUGIN_OS_CONTRACT_VERSION = '2026-05-04.gate-2';
export const ZAVORTH_PLUGIN_OS_API_VERSION = 'zavorth.plugin-os.v1';

export const ZAVORTH_PLUGIN_PERMISSION_KINDS = [
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
] as const;

export type ZavorthPluginPermissionKind = typeof ZAVORTH_PLUGIN_PERMISSION_KINDS[number];

export type ZavorthPluginModuleKind =
  | 'agent'
  | 'provider'
  | 'channel'
  | 'sandbox'
  | 'tool'
  | 'media'
  | 'voice'
  | 'search'
  | 'memory'
  | 'diagnostics'
  | 'qa'
  | 'bridge'
  | 'workspace'
  | 'module';

export type ZavorthPluginSourceKind = 'registry' | 'local' | 'workspace' | 'vendor' | 'generated';

export type ZavorthPluginLifecycleAction =
  | 'install'
  | 'enable'
  | 'disable'
  | 'uninstall'
  | 'invoke'
  | 'doctor'
  | 'upgrade';

export type ZavorthPluginTrustLevel = 'review' | 'trusted' | 'blocked';

export type ZavorthPluginRuntimeState = 'available' | 'installed' | 'enabled' | 'disabled' | 'blocked';

export type ZavorthPluginPermissionScope = 'none' | 'local' | 'workspace' | 'external' | 'system';

export type ZavorthPluginSourceDescriptor = {
  kind: ZavorthPluginSourceKind;
  locator: string;
  digest?: string | null;
  trusted: boolean;
};

export type ZavorthPluginCompatibility = {
  zavorthVersion: string;
  pluginApiVersion: typeof ZAVORTH_PLUGIN_OS_API_VERSION;
  minimumNodeVersion?: string | null;
};

export type ZavorthPluginCapabilityBinding = {
  id: string;
  intent: string;
  label: string;
  summary: string;
  artifactKinds?: string[];
  command?: {
    name: string;
    aliases?: string[];
    usage?: string | null;
  } | null;
};

export type ZavorthPluginPermission = {
  kind: ZavorthPluginPermissionKind;
  scope: ZavorthPluginPermissionScope;
  reason: string;
  required: boolean;
};

export type ZavorthPluginEntrypoint = {
  module: string;
  exportName: string;
  runtime: 'node' | 'browser' | 'remote' | 'none';
};

export type ZavorthPluginLifecycle = {
  actions: ZavorthPluginLifecycleAction[];
  defaultAction: ZavorthPluginLifecycleAction;
};

export type ZavorthPluginPolicy = {
  defaultTrust: ZavorthPluginTrustLevel;
  requiresApproval: boolean;
  allowNetworkByDefault: boolean;
  allowFilesystemWriteByDefault: boolean;
  allowProcessSpawnByDefault: boolean;
  sandboxProfile: 'metadata-only' | 'restricted' | 'networked' | 'local-exec';
};

export type ZavorthPluginManifest = {
  schemaVersion: typeof ZAVORTH_PLUGIN_OS_API_VERSION;
  id: string;
  label: string;
  version: string;
  moduleKind: ZavorthPluginModuleKind;
  summary: string;
  description: string;
  tags: string[];
  source: ZavorthPluginSourceDescriptor;
  compatibility: ZavorthPluginCompatibility;
  capabilities: ZavorthPluginCapabilityBinding[];
  permissions: ZavorthPluginPermission[];
  entrypoint: ZavorthPluginEntrypoint;
  lifecycle: ZavorthPluginLifecycle;
  policy: ZavorthPluginPolicy;
  artifactKinds: string[];
  receiptKinds: string[];
  /** Optional connection descriptor for zero-friction onboarding via `/connect`. */
  connection?: PluginConnectionDescriptor;
};

export type ZavorthPluginStateEntry = {
  pluginId: string;
  revision: string;
  state: ZavorthPluginRuntimeState;
  trust: ZavorthPluginTrustLevel;
  installedAt: string | null;
  updatedAt: string;
};

export type ZavorthPluginRegistryEntry = {
  manifest: ZavorthPluginManifest;
  state: ZavorthPluginStateEntry;
  health: {
    ok: boolean;
    summary: string;
    findings: string[];
  };
};

export type ZavorthPluginSandboxDecisionStatus = 'allow' | 'needs_approval' | 'blocked';

export type ZavorthPluginSandboxDecision = {
  generatedAt: string;
  pluginId: string;
  action: ZavorthPluginLifecycleAction;
  status: ZavorthPluginSandboxDecisionStatus;
  trust: ZavorthPluginTrustLevel;
  reasons: string[];
  requiredApprovals: string[];
  constraints: {
    network: ZavorthPluginPermissionScope[];
    filesystem: ZavorthPluginPermissionScope[];
    secrets: boolean;
    processSpawn: boolean;
    artifacts: string[];
    receipts: string[];
  };
};

export type ZavorthPluginReceipt = {
  generatedAt: string;
  pluginId: string;
  action: ZavorthPluginLifecycleAction;
  status: 'applied' | 'planned' | 'blocked' | 'approval_required';
  summary: string;
  decision: ZavorthPluginSandboxDecision;
};
