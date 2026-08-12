export const ZAVORTH_EXTENSION_API_VERSION = 'zavorth.extension.v1';

export const ZAVORTH_EXTENSION_KINDS = [
  'channel',
  'provider',
  'tool',
  'skill',
  'plugin',
  'mcp',
  'policy',
  'health',
  'verifier',
  'receipt-renderer',
] as const;

export const ZAVORTH_EXTENSION_SOURCE_KINDS = [
  'workspace',
  'local',
  'registry',
  'vendor',
  'generated',
] as const;

export const ZAVORTH_EXTENSION_TRUST_LEVELS = ['review', 'trusted', 'blocked'] as const;

export const ZAVORTH_EXTENSION_SANDBOX_PROFILES = [
  'metadata-only',
  'restricted',
  'networked',
  'local-exec',
] as const;

export const ZAVORTH_EXTENSION_PERMISSION_KINDS = [
  'network',
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

export const ZAVORTH_EXTENSION_PERMISSION_SCOPES = [
  'none',
  'local',
  'workspace',
  'external',
  'system',
] as const;

export type ZavorthExtensionKind = typeof ZAVORTH_EXTENSION_KINDS[number];

export type ZavorthExtensionSourceKind = typeof ZAVORTH_EXTENSION_SOURCE_KINDS[number];

export type ZavorthExtensionTrustLevel = typeof ZAVORTH_EXTENSION_TRUST_LEVELS[number];

export type ZavorthExtensionSandboxProfile = typeof ZAVORTH_EXTENSION_SANDBOX_PROFILES[number];

export type ZavorthExtensionPermissionKind = typeof ZAVORTH_EXTENSION_PERMISSION_KINDS[number];

export type ZavorthExtensionPermissionScope = typeof ZAVORTH_EXTENSION_PERMISSION_SCOPES[number];

export type ZavorthExtensionSourceDescriptor = {
  kind: ZavorthExtensionSourceKind;
  locator: string;
  digest?: string | null;
  trusted: boolean;
};

export type ZavorthExtensionCompatibility = {
  zavorthVersion: string;
  extensionApiVersion: typeof ZAVORTH_EXTENSION_API_VERSION;
  minimumNodeVersion?: string | null;
};

export type ZavorthExtensionPolicy = {
  defaultTrust: ZavorthExtensionTrustLevel;
  requiresApproval: boolean;
  allowNetworkByDefault: boolean;
  allowFilesystemWriteByDefault: boolean;
  allowProcessSpawnByDefault: boolean;
  sandboxProfile: ZavorthExtensionSandboxProfile;
};

export type ZavorthExtensionPermission = {
  kind: ZavorthExtensionPermissionKind;
  scope: ZavorthExtensionPermissionScope;
  reason: string;
  required: boolean;
};

export type ZavorthExtensionContribution = {
  id: string;
  kind: ZavorthExtensionKind;
  exportName: string;
  capabilityIds: string[];
  label?: string | null;
  summary?: string | null;
  dependsOn?: string[];
};

export type ZavorthExtensionManifest = {
  schemaVersion: typeof ZAVORTH_EXTENSION_API_VERSION;
  id: string;
  label: string;
  version: string;
  summary: string;
  description?: string | null;
  tags?: string[];
  source: ZavorthExtensionSourceDescriptor;
  compatibility: ZavorthExtensionCompatibility;
  contributions: ZavorthExtensionContribution[];
  permissions: ZavorthExtensionPermission[];
  policy: ZavorthExtensionPolicy;
  legacyPluginManifest?: unknown;
};

export type ZavorthExtensionCertificationFinding = {
  code: string;
  message: string;
  path?: string | null;
};

export type ZavorthExtensionCertification = {
  status: 'certified' | 'rejected';
  findings: ZavorthExtensionCertificationFinding[];
};

export type ZavorthExtensionInvocationContext = {
  extensionId: string;
  capabilityId: string;
  contribution: ZavorthExtensionContribution;
  manifest: ZavorthExtensionManifest;
  input?: unknown;
  approvalId?: string | null;
  grantedPermissions?: string[];
  [key: string]: unknown;
};

export type ZavorthExtensionHandler = (
  input: unknown,
  context: ZavorthExtensionInvocationContext,
) => unknown | Promise<unknown>;

export type ZavorthExtensionRegistryEntry = {
  manifest: ZavorthExtensionManifest;
  certification: ZavorthExtensionCertification;
  registeredAt: string;
};
