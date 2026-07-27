import type {
  ZavorthPluginCapabilityBinding,
  ZavorthPluginManifest,
  ZavorthPluginModuleKind,
  ZavorthPluginPermission,
  ZavorthPluginPermissionKind,
  ZavorthPluginPermissionScope,
} from '../contracts/PluginManifestContract.js';
import {
  ZAVORTH_PLUGIN_OS_API_VERSION,
  ZAVORTH_PLUGIN_PERMISSION_KINDS,
} from '../contracts/PluginManifestContract.js';
import { ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION } from '../contracts/SourcePluginPackageContract.js';

import type {
  SourcePluginPackageAdapterSnapshot,
  SourcePluginPackageCompatibility,
  SourcePluginPackageValidationIssue,
} from '../contracts/SourcePluginPackageContract.js';

type SourcePluginPackageAdapterRuntime = {
  now?: () => Date;
};

type SourcePluginPackageJson = {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  keywords?: unknown;
  main?: unknown;
  module?: unknown;
  source?: unknown;
};

type SourcePackageBlock = {
  compat?: Record<string, unknown>;
  build?: Record<string, unknown>;
  install?: Record<string, unknown>;
  plugin?: Record<string, unknown>;
  permissions?: unknown;
  capabilities?: unknown;
  entrypoint?: Record<string, unknown>;
};

const REQUIRED_FIELD_PATHS = [
  'source.compat.pluginApi',
  'source.build.sourceVersion',
] as const;

const KNOWN_PERMISSION_KINDS = new Set<string>(ZAVORTH_PLUGIN_PERMISSION_KINDS);

export class SourcePluginPackageAdapterService {
  private readonly now: () => Date;

  constructor(runtime: SourcePluginPackageAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public convertPackageJson(input: {
    packageJson: unknown;
    packagePath?: string | null;
    digest?: string | null;
  }): SourcePluginPackageAdapterSnapshot {
    const packageJson = asRecord(input.packageJson) as SourcePluginPackageJson;
    const source = this.readSourceBlock(packageJson);
    const sourcePackageName = normalizeOptionalString(packageJson.name) || 'source-external-plugin';
    const sourcePackageVersion = normalizeOptionalString(packageJson.version) || '0.0.0';
    const compatibility = this.normalizeCompatibility(packageJson);
    const issues = this.validatePackage(packageJson);
    const manifest = this.buildManifest({
      packageJson,
      source,
      sourcePackageName,
      sourcePackageVersion,
      packagePath: input.packagePath || null,
      digest: input.digest || null,
      compatibility,
      issues,
    });
    const status = issues.some((issue) => issue.severity === 'error') ? 'blocked'
      : issues.length > 0
        ? 'needs_review'
        : 'converted';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION,
      status,
      manifest,
      receipt: {
        generatedAt: this.now().toISOString(),
        sourcePackageName,
        sourcePackageVersion,
        status,
        manifestId: manifest.id,
        compatibility,
        issues,
        policy: {
          noSourceImportPathShim: true,
          noRuntimeExecution: true,
          manifestDisabledByDefault: true,
          requiresPolicyBeforeInvoke: true,
          noSecretsSerialized: true,
        },
      },
    };
  }

  public normalizeCompatibility(packageJson: unknown): SourcePluginPackageCompatibility {
    const root = asRecord(packageJson);
    const source = this.readSourceBlock(root);
    const version = normalizeOptionalString(root.version);
    const minHostVersion = normalizeOptionalString(source.install?.minHostVersion);
    const pluginApiRange = normalizeOptionalString(source.compat?.pluginApi);
    const builtWithSourceVersion = normalizeOptionalString(source.build?.sourceVersion) || version;
    const pluginSdkVersion = normalizeOptionalString(source.build?.pluginSdkVersion);
    const minGatewayVersion = normalizeOptionalString(source.compat?.minGatewayVersion) || minHostVersion;

    return {
      pluginApiRange: pluginApiRange || null,
      builtWithSourceVersion: builtWithSourceVersion || null,
      pluginSdkVersion: pluginSdkVersion || null,
      minGatewayVersion: minGatewayVersion || null,
      missingRequiredFieldPaths: this.listMissingRequiredFieldPaths(packageJson),
    };
  }

  public listMissingRequiredFieldPaths(packageJson: unknown): string[] {
    const root = asRecord(packageJson);
    const source = this.readSourceBlock(root);
    const missing: string[] = [];
    if (!normalizeOptionalString(source.compat?.pluginApi)) {
      missing.push(REQUIRED_FIELD_PATHS[0]);
    }
    if (!normalizeOptionalString(source.build?.sourceVersion)) {
      missing.push(REQUIRED_FIELD_PATHS[1]);
    }
    return missing;
  }

  private validatePackage(packageJson: unknown): SourcePluginPackageValidationIssue[] {
    const root = asRecord(packageJson);
    const issues: SourcePluginPackageValidationIssue[] = [];
    if (!normalizeOptionalString(root.name)) {
      issues.push({
        severity: 'error',
        fieldPath: 'name',
        message: 'package name is required to adapt an Source-like plugin package.',
      });
    }

    for (const fieldPath of this.listMissingRequiredFieldPaths(packageJson)) {
      issues.push({
        severity: 'warning',
        fieldPath,
        message: `${fieldPath} is recommended before enabling external plugin packages.`,
      });
    }

    return issues;
  }

  private buildManifest(input: {
    packageJson: SourcePluginPackageJson;
    source: SourcePackageBlock;
    sourcePackageName: string;
    sourcePackageVersion: string;
    packagePath: string | null;
    digest: string | null;
    compatibility: SourcePluginPackageCompatibility;
    issues: SourcePluginPackageValidationIssue[];
  }): ZavorthPluginManifest {
    const moduleKind = this.resolveModuleKind(input.sourcePackageName, input.packageJson, input.source);
    const manifestId = normalizeId(normalizeOptionalString(input.source.plugin?.id) || input.sourcePackageName);
    const label = normalizeOptionalString(input.source.plugin?.label)
      || normalizeOptionalString(input.source.plugin?.name)
      || normalizeLabel(input.sourcePackageName);
    const summary = normalizeOptionalString(input.packageJson.description)
      || normalizeOptionalString(input.source.plugin?.summary)
      || `Source-compatible ${moduleKind} package adapted for Zavorth Plugin OS.`;
    const permissions = this.resolvePermissions(input.sourcePackageName, input.packageJson, input.source, moduleKind);
    const capabilities = this.resolveCapabilities(input.sourcePackageName, input.source, moduleKind);
    const artifactKinds = unique(capabilities.flatMap((capability) => capability.artifactKinds || []));
    const receiptKinds = unique([`${manifestId}.receipt`, 'source-plugin-package.adapter.receipt']);

    return {
      schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      id: manifestId,
      label,
      version: input.sourcePackageVersion,
      moduleKind,
      summary,
      description: summary,
      tags: unique([
        'source-compatible',
        moduleKind,
        ...readStringArray(input.packageJson.keywords),
      ]),
      source: {
        kind: 'local',
        locator: input.packagePath || `package:${input.sourcePackageName}`,
        digest: input.digest,
        trusted: false,
      },
      compatibility: {
        zavorthVersion: input.compatibility.minGatewayVersion || '>=1.1.0',
        pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      },
      capabilities,
      permissions,
      entrypoint: {
        module: normalizeOptionalString(input.source.entrypoint?.module)
          || normalizeOptionalString(input.packageJson.module)
          || normalizeOptionalString(input.packageJson.main)
          || './dist/index.js',
        exportName: normalizeOptionalString(input.source.entrypoint?.exportName) || 'createPlugin',
        runtime: 'node',
      },
      lifecycle: {
        actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
        defaultAction: 'doctor',
      },
      policy: {
        defaultTrust: 'review',
        requiresApproval: true,
        allowNetworkByDefault: false,
        allowFilesystemWriteByDefault: false,
        allowProcessSpawnByDefault: false,
        sandboxProfile: 'restricted',
      },
      artifactKinds,
      receiptKinds,
    };
  }

  private resolveModuleKind(
    packageName: string,
    packageJson: SourcePluginPackageJson,
    source: SourcePackageBlock,
  ): ZavorthPluginModuleKind {
    const declaredKind = normalizeOptionalString(source.plugin?.kind);
    if (isPluginModuleKind(declaredKind)) return declaredKind;

    const haystack = [
      packageName,
      normalizeOptionalString(packageJson.description) || '',
      ...readStringArray(packageJson.keywords),
    ].join(' ').toLowerCase();

    if (haystack.includes('provider') || haystack.includes('model')) return 'provider';
    if (haystack.includes('channel') || haystack.includes('slack') || haystack.includes('discord')) return 'channel';
    if (haystack.includes('memory')) return 'memory';
    if (haystack.includes('search')) return 'search';
    if (haystack.includes('voice') || haystack.includes('tts') || haystack.includes('speech')) return 'voice';
    if (haystack.includes('media') || haystack.includes('video')) return 'media';
    if (haystack.includes('diagnostic') || haystack.includes('doctor')) return 'diagnostics';
    return 'module';
  }

  private resolveCapabilities(
    packageName: string,
    source: SourcePackageBlock,
    moduleKind: ZavorthPluginModuleKind,
  ): ZavorthPluginCapabilityBinding[] {
    if (Array.isArray(source.capabilities)) {
      const declared = source.capabilities
        .map((capability) => asRecord(capability))
        .map((capability, index): ZavorthPluginCapabilityBinding => ({
          id: normalizeOptionalString(capability.id) || `${normalizeId(packageName)}.${index + 1}`,
          intent: normalizeOptionalString(capability.intent) || `${moduleKind}_invoke`,
          label: normalizeOptionalString(capability.label) || normalizeLabel(normalizeOptionalString(capability.id) || packageName),
          summary: normalizeOptionalString(capability.summary) || `Runs ${packageName} through Zavorth Plugin OS.`,
          artifactKinds: readStringArray(capability.artifactKinds),
          command: null,
        }));
      if (declared.length > 0) return declared;
    }

    const id = `${normalizeId(packageName)}.invoke`;
    return [{
      id,
      intent: `${moduleKind}_invoke`,
      label: `${normalizeLabel(packageName)} Invoke`,
      summary: `Plans an Source-compatible ${moduleKind} invocation through Zavorth Plugin OS.`,
      artifactKinds: [`${normalizeId(packageName)}.artifact`],
      command: null,
    }];
  }

  private resolvePermissions(
    packageName: string,
    packageJson: SourcePluginPackageJson,
    source: SourcePackageBlock,
    moduleKind: ZavorthPluginModuleKind,
  ): ZavorthPluginPermission[] {
    const declared = Array.isArray(source.permissions)
      ? source.permissions
        .map((permission) => this.normalizePermission(permission))
        .filter((permission): permission is ZavorthPluginPermission => Boolean(permission))
      : [];
    if (declared.length > 0) return declared;

    const permissions: ZavorthPluginPermission[] = [];
    if (['provider', 'channel', 'search', 'media', 'voice'].includes(moduleKind)) {
      permissions.push({
        kind: 'network.external',
        scope: 'external',
        reason: `${packageName} may need external API access when enabled.`,
        required: true,
      });
    }
    if (moduleKind === 'memory') {
      permissions.push({
        kind: 'memory.write',
        scope: 'workspace',
        reason: `${packageName} may write governed memory artifacts when enabled.`,
        required: true,
      });
    }
    const keywords = readStringArray(packageJson.keywords).join(' ').toLowerCase();
    if (keywords.includes('secret') || keywords.includes('auth')) {
      permissions.push({
        kind: 'secret.read',
        scope: 'workspace',
        reason: `${packageName} declares auth/secret behavior.`,
        required: true,
      });
    }
    permissions.push({
      kind: 'artifact.write',
      scope: 'workspace',
      reason: 'Plugin OS records artifact-first execution receipts.',
      required: false,
    });
    return permissions;
  }

  private normalizePermission(permission: unknown): ZavorthPluginPermission | null {
    const record = asRecord(permission);
    const kind = normalizeOptionalString(record.kind);
    const scope = normalizeOptionalString(record.scope) || 'workspace';
    if (!kind || !KNOWN_PERMISSION_KINDS.has(kind) || !isPermissionScope(scope)) return null;
    return {
      kind: kind as ZavorthPluginPermissionKind,
      scope,
      reason: normalizeOptionalString(record.reason) || `Source package requested ${kind}.`,
      required: record.required !== false,
    };
  }

  private readSourceBlock(packageJson: unknown): SourcePackageBlock {
    const root = asRecord(packageJson);
    const source = asRecord(root.source);
    return {
      compat: asOptionalRecord(source.compat),
      build: asOptionalRecord(source.build),
      install: asOptionalRecord(source.install),
      plugin: asOptionalRecord(source.plugin),
      permissions: source.permissions,
      capabilities: source.capabilities,
      entrypoint: asOptionalRecord(source.entrypoint),
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  const record = asRecord(value);
  return Object.keys(record).length > 0 ? record : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeLabel(value: string): string {
  return value
    .replace(/^@/, '')
    .replace(/[\/_.:-]+/g, ' ')
    .split(/\s+/g)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function isPluginModuleKind(value: string | undefined): value is ZavorthPluginModuleKind {
  return Boolean(value && [
    'agent',
    'provider',
    'channel',
    'sandbox',
    'tool',
    'media',
    'voice',
    'search',
    'memory',
    'diagnostics',
    'qa',
    'bridge',
    'workspace',
    'module',
  ].includes(value));
}

function isPermissionScope(value: string): value is ZavorthPluginPermissionScope {
  return ['none', 'local', 'workspace', 'external', 'system'].includes(value);
}
