import type {
  ZavorthPluginCapabilityBinding,
  ZavorthPluginLifecycleAction,
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
  ZavorthPluginPermission,
  ZavorthPluginPermissionKind,
  ZavorthPluginPermissionScope,
  ZavorthPluginReceipt,
  ZavorthPluginSourceKind,
} from '../../contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../contracts/PluginManifestContract.js';

export type ZavorthModuleHandlerInput<TInput extends Record<string, unknown> = Record<string, unknown>> = {
  pluginId: string;
  capabilityId: string;
  input: TInput;
  requestedBy: string | null;
};

export type ZavorthModuleHandlerResult<TOutput = unknown> = {
  output: TOutput;
  artifacts?: string[];
  receipts?: string[];
};

export type ZavorthModuleHandler<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> = (input: ZavorthModuleHandlerInput<TInput>) =>
  ZavorthModuleHandlerResult<TOutput> | Promise<ZavorthModuleHandlerResult<TOutput>>;

export type ZavorthModuleDefinition<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> = {
  manifest: ZavorthPluginManifest;
  handler: ZavorthModuleHandler<TInput, TOutput>;
};

export type CreateZavorthModuleManifestInput = {
  id: string;
  label: string;
  version?: string;
  moduleKind: ZavorthPluginModuleKind;
  summary: string;
  description?: string;
  tags?: string[];
  source?: {
    kind?: ZavorthPluginSourceKind;
    locator?: string | null;
    digest?: string | null;
    trusted?: boolean;
  };
  capabilities: ZavorthPluginCapabilityBinding[];
  permissions?: ZavorthPluginPermission[];
  entrypoint?: {
    module?: string;
    exportName?: string;
    runtime?: 'node' | 'browser' | 'remote' | 'none';
  };
  lifecycle?: {
    actions?: ZavorthPluginLifecycleAction[];
    defaultAction?: ZavorthPluginLifecycleAction;
  };
  policy?: Partial<ZavorthPluginManifest['policy']>;
  artifactKinds?: string[];
  receiptKinds?: string[];
  zavorthVersion?: string;
};

export function defineZavorthModule<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
>(
  manifest: ZavorthPluginManifest,
  handler: ZavorthModuleHandler<TInput, TOutput>,
): ZavorthModuleDefinition<TInput, TOutput> {
  return {
    manifest,
    handler,
  };
}

export function createZavorthModuleManifest(
  input: CreateZavorthModuleManifestInput,
): ZavorthPluginManifest {
  const capabilities = input.capabilities;
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    throw new Error('createZavorthModuleManifest requires at least one capability.');
  }
  const permissions = input.permissions || [];
  const artifactKinds = input.artifactKinds || unique(capabilities.flatMap((capability) => capability.artifactKinds || []));
  const receiptKinds = input.receiptKinds || [`${normalizeId(input.id)}.receipt`];

  return {
    schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    id: normalizeId(input.id),
    label: String(input.label || '').trim(),
    version: String(input.version || '').trim() || '0.1.0',
    moduleKind: input.moduleKind,
    summary: String(input.summary || '').trim(),
    description: String(input.description || input.summary || '').trim(),
    tags: unique([...(input.tags || []), input.moduleKind]),
    source: {
      kind: input.source?.kind || 'local',
      locator: String(input.source?.locator || '').trim() || `zavorth-module://${normalizeId(input.id)}`,
      digest: input.source?.digest || null,
      trusted: input.source?.trusted === true,
    },
    compatibility: {
      zavorthVersion: input.zavorthVersion || '>=1.1.0',
      pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
    },
    capabilities,
    permissions,
    entrypoint: {
      module: input.entrypoint?.module || './index.js',
      exportName: input.entrypoint?.exportName || 'createZavorthModule',
      runtime: input.entrypoint?.runtime || 'node',
    },
    lifecycle: {
      actions: input.lifecycle?.actions || ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
      defaultAction: input.lifecycle?.defaultAction || 'invoke',
    },
    policy: {
      defaultTrust: input.policy?.defaultTrust || 'review',
      requiresApproval: input.policy?.requiresApproval ?? permissions.some((permission) => permission.required),
      allowNetworkByDefault: input.policy?.allowNetworkByDefault ?? false,
      allowFilesystemWriteByDefault: input.policy?.allowFilesystemWriteByDefault ?? false,
      allowProcessSpawnByDefault: input.policy?.allowProcessSpawnByDefault ?? false,
      sandboxProfile: input.policy?.sandboxProfile || 'restricted',
    },
    artifactKinds,
    receiptKinds,
  };
}

export function createZavorthCapabilityBinding(input: {
  id: string;
  intent: string;
  label: string;
  summary: string;
  artifactKinds?: string[];
  command?: ZavorthPluginCapabilityBinding['command'];
}): ZavorthPluginCapabilityBinding {
  return {
    id: String(input.id || '').trim(),
    intent: String(input.intent || '').trim(),
    label: String(input.label || '').trim(),
    summary: String(input.summary || '').trim(),
    artifactKinds: input.artifactKinds || [],
    command: input.command ?? null,
  };
}

export function createZavorthPermission(
  kind: ZavorthPluginPermissionKind,
  scope: ZavorthPluginPermissionScope,
  reason: string,
  required = true,
): ZavorthPluginPermission {
  return {
    kind,
    scope,
    reason,
    required,
  };
}

export function createZavorthModuleReceipt(input: {
  pluginId: string;
  action: ZavorthPluginLifecycleAction;
  status: ZavorthPluginReceipt['status'];
  summary: string;
  generatedAt?: string;
}): Pick<ZavorthPluginReceipt, 'generatedAt' | 'pluginId' | 'action' | 'status' | 'summary'> {
  return {
    generatedAt: input.generatedAt || new Date().toISOString(),
    pluginId: normalizeId(input.pluginId),
    action: input.action,
    status: input.status,
    summary: input.summary,
  };
}

export function normalizeZavorthModuleId(value: string): string {
  return normalizeId(value);
}

function normalizeId(value: string): string {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!normalized) {
    throw new Error('Zavorth module id is required.');
  }
  return normalized;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export type {
  ZavorthPluginCapabilityBinding,
  ZavorthPluginLifecycleAction,
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
  ZavorthPluginPermission,
  ZavorthPluginPermissionKind,
  ZavorthPluginPermissionScope,
  ZavorthPluginReceipt,
};
