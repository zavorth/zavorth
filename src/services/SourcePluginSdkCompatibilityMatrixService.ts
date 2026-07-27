import fs from 'node:fs';
import path from 'node:path';
import type {
  SourceInternalPluginPackageName,
  SourcePluginPackageDecision,
  SourcePluginPackageExportFamily,
  SourcePluginSdkCompatibilityMatrixEntry,
  SourcePluginSdkCompatibilityMatrixSnapshot,
} from '../contracts/SourcePluginPackageContract.js';
import {
  SOURCE_INTERNAL_PLUGIN_PACKAGES,
  ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION,
} from '../contracts/SourcePluginPackageContract.js';

type SourcePluginSdkCompatibilityMatrixRuntime = {
  now?: () => Date;
};

type PackageJsonShape = {
  name?: string;
  exports?: string | Record<string, unknown>;
};

export class SourcePluginSdkCompatibilityMatrixService {
  private readonly now: () => Date;

  constructor(runtime: SourcePluginSdkCompatibilityMatrixRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(sourceRoot: string): SourcePluginSdkCompatibilityMatrixSnapshot {
    const root = path.resolve(sourceRoot);
    const entries = SOURCE_INTERNAL_PLUGIN_PACKAGES.map((packageName) =>
      this.buildEntry(root, packageName),
    );
    const packagesFound = entries.filter((entry) => entry.status === 'found').length;
    const packagesMissing = entries.length - packagesFound;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SOURCE_PLUGIN_PACKAGE_ABSORPTION_CONTRACT_VERSION,
      status: packagesMissing === 0 ? 'passed' : 'failed',
      sourceRoot: normalizePath(root),
      summary: {
        packagesExpected: SOURCE_INTERNAL_PLUGIN_PACKAGES.length,
        packagesFound,
        packagesMissing,
        declaredExports: entries.reduce((total, entry) => total + entry.declaredExports, 0),
        pluginSdkExports: exportsFor(entries, '@source/plugin-sdk'),
        memoryHostExports: exportsFor(entries, '@source/memory-host-sdk'),
        packageContractExports: exportsFor(entries, '@source/plugin-package-contract'),
        sdkRootExports: exportsFor(entries, '@source/sdk'),
        mappedToPluginOs: entries.filter((entry) => entry.decision === 'mapped-to-plugin-os').length,
        mappedToNativeSdk: entries.filter((entry) => entry.decision === 'zavorth-native-sdk').length,
        ownerDecisionRequired: entries.filter((entry) => entry.decision === 'owner-decision-required').length,
      },
      entries,
    };
  }

  private buildEntry(
    sourceRoot: string,
    packageName: SourceInternalPluginPackageName,
  ): SourcePluginSdkCompatibilityMatrixEntry {
    const packagePath = path.join(sourceRoot, 'packages', packageName.replace('@source/', ''));
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return {
        packageName,
        packagePath: normalizePath(packagePath),
        status: 'missing',
        declaredExports: 0,
        exportSubpaths: [],
        exportFamilies: emptyFamilies(),
        decision: 'owner-decision-required',
        targetPhase: packageName === '@source/memory-host-sdk' ? 5 : 1,
        zavorthTarget: 'missing-package-owner-decision',
        reason: 'Source package path was not found during Intent model scan.',
      };
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as PackageJsonShape;
    const exportSubpaths = listPackageExports(packageJson.exports);
    const decision = decisionForPackage(packageName);
    return {
      packageName,
      packagePath: normalizePath(packagePath),
      status: 'found',
      declaredExports: exportSubpaths.length,
      exportSubpaths,
      exportFamilies: countExportFamilies(exportSubpaths),
      decision,
      targetPhase: packageName === '@source/memory-host-sdk' ? 5 : 1,
      zavorthTarget: targetForPackage(packageName),
      reason: reasonForPackage(packageName, decision),
    };
  }
}

function decisionForPackage(packageName: SourceInternalPluginPackageName): SourcePluginPackageDecision {
  if (packageName === '@source/sdk') return 'zavorth-native-sdk';
  if (packageName === '@source/memory-host-sdk') return 'mapped-to-plugin-os';
  return 'mapped-to-plugin-os';
}

function targetForPackage(packageName: SourceInternalPluginPackageName): string {
  switch (packageName) {
    case '@source/plugin-sdk':
      return 'ZavorthPluginPackageContract + Plugin OS manifest/lifecycle/policy SDK';
    case '@source/plugin-package-contract':
      return 'SourcePluginPackageAdapterService compatibility reader';
    case '@source/sdk':
      return 'Zavorth stable ./sdk public subpaths';
    case '@source/memory-host-sdk':
      return 'MemoryKnowledgeContract follow-up in Credential vault, with package semantics tracked now';
    default:
      return 'Zavorth-native Plugin OS';
  }
}

function reasonForPackage(
  packageName: SourceInternalPluginPackageName,
  decision: SourcePluginPackageDecision,
): string {
  if (decision === 'zavorth-native-sdk') {
    return `${packageName} is replaced by stable Zavorth SDK subpaths; no Source import-path shim is provided.`;
  }
  if (packageName === '@source/memory-host-sdk') {
    return `${packageName} semantics are tracked in Plugin OS now and promoted to functional memory backend work in Credential vault.`;
  }
  return `${packageName} is absorbed as Zavorth-native Plugin OS contracts, adapter checks and lifecycle receipts.`;
}

function listPackageExports(exportsField: PackageJsonShape['exports']): string[] {
  if (!exportsField) return [];
  if (typeof exportsField === 'string') return ['.'];
  return Object.keys(exportsField).sort();
}

function countExportFamilies(subpaths: string[]): Record<SourcePluginPackageExportFamily, number> {
  const counts = emptyFamilies();
  for (const subpath of subpaths) {
    counts[classifyExportFamily(subpath)] += 1;
  }
  return counts;
}

function classifyExportFamily(subpath: string): SourcePluginPackageExportFamily {
  const text = subpath.toLowerCase();
  if (text === '.') return 'package-root';
  const hasAny = (tokens: string[]) => tokens.some((token) => text.includes(token));
  if (hasAny(['provider', 'model'])) return 'provider';
  if (hasAny(['channel', 'delivery', 'transport'])) return 'channel';
  if (hasAny(['config', 'env', 'browser'])) return 'config';
  if (hasAny(['security', 'ssrf'])) return 'security';
  if (hasAny(['secret', 'auth'])) return 'secret';
  if (hasAny(['memory', 'engine', 'query', 'multimodal'])) return 'memory';
  if (hasAny(['runtime', 'lock', 'dedupe', 'queue', 'heartbeat', 'number', 'random', 'time', 'system'])) return 'runtime-utility';
  if (hasAny(['test', 'doctor'])) return 'testing';
  if (hasAny(['media', 'video', 'tts', 'speech', 'text'])) return 'media';
  if (hasAny(['plugin', 'entry', 'core', 'cli', 'file'])) return 'plugin-runtime';
  return 'other';
}

function emptyFamilies(): Record<SourcePluginPackageExportFamily, number> {
  return {
    'plugin-runtime': 0,
    provider: 0,
    channel: 0,
    config: 0,
    security: 0,
    secret: 0,
    memory: 0,
    'runtime-utility': 0,
    testing: 0,
    media: 0,
    'package-root': 0,
    other: 0,
  };
}

function exportsFor(
  entries: SourcePluginSdkCompatibilityMatrixEntry[],
  packageName: SourceInternalPluginPackageName,
): number {
  return entries.find((entry) => entry.packageName === packageName)?.declaredExports || 0;
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/');
}
