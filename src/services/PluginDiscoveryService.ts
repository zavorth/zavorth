import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ZAVORTH_PLUGIN_OS_API_VERSION,
  type ZavorthPluginManifest,
  type ZavorthPluginRuntimeState,
  type ZavorthPluginTrustLevel,
} from '../contracts/PluginManifestContract.js';
import {
  ZAVORTH_PLUGIN_DISCOVERY_SOURCE_KINDS,
  ZAVORTH_PLUGIN_DISCOVERY_SOURCE_PRIORITY,
  ZAVORTH_PLUGIN_MANIFEST_FILENAMES,
  ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION,
  type ZavorthDiscoveredPlugin,
  type ZavorthPluginDiscoveryCompatibility,
  type ZavorthPluginDiscoverySnapshot,
  type ZavorthPluginDiscoverySource,
  type ZavorthPluginDiscoverySourceKind,
  type ZavorthPluginDiscoveryStateView,
  type ZavorthPluginDiscoveryValidation,
  type ZavorthPluginManifestFilename,
} from '../contracts/core/PluginRuntimeContract.js';
import { PluginRegistryService } from './PluginRegistryService.js';

export type PluginDiscoveryStateLookup = {
  resolve(pluginId: string): {
    installed: boolean;
    enabled: boolean;
    trust: ZavorthPluginTrustLevel;
    installedRevision: string | null;
    sourceLocator: string | null;
  } | null;
};

export type PluginDiscoveryRuntime = {
  now?: () => Date;
  projectRoot?: string;
  workspaceRoot?: string | null;
  userHome?: string | null;
  bundledPluginsDir?: string | null;
  workspacePluginsDir?: string | null;
  userPluginsDir?: string | null;
  zavorthVersion?: string;
  stateLookup?: PluginDiscoveryStateLookup;
  registry?: Pick<PluginRegistryService, 'validateManifest'>;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
};

export type PluginDiscoveryInput = {
  projectRoot?: string;
  workspaceRoot?: string | null;
};

type DiscoveredCandidate = ZavorthDiscoveredPlugin & {
  priority: number;
};

const EMPTY_BY_SOURCE: Record<ZavorthPluginDiscoverySourceKind, number> = {
  bundled: 0,
  workspace: 0,
  user: 0,
};

export class PluginDiscoveryService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly workspaceRoot: string | null;
  private readonly userHome: string | null;
  private readonly bundledPluginsDir: string | null;
  private readonly workspacePluginsDir: string | null;
  private readonly userPluginsDir: string | null;
  private readonly zavorthVersion: string;
  private readonly stateLookup: PluginDiscoveryStateLookup | null;
  private readonly registry: Pick<PluginRegistryService, 'validateManifest'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readdirSync: typeof fs.readdirSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly statSync: typeof fs.statSync;

  constructor(runtime: PluginDiscoveryRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.workspaceRoot =
      runtime.workspaceRoot === undefined ? null : runtime.workspaceRoot ? path.resolve(runtime.workspaceRoot) : null;
    this.userHome =
      runtime.userHome === undefined ? os.homedir() : runtime.userHome ? path.resolve(runtime.userHome) : null;
    this.bundledPluginsDir = runtime.bundledPluginsDir === undefined ? null : runtime.bundledPluginsDir;
    this.workspacePluginsDir = runtime.workspacePluginsDir === undefined ? null : runtime.workspacePluginsDir;
    this.userPluginsDir = runtime.userPluginsDir === undefined ? null : runtime.userPluginsDir;
    this.zavorthVersion = String(runtime.zavorthVersion || '2.0.0').trim() || '2.0.0';
    this.stateLookup = runtime.stateLookup || null;
    this.registry = runtime.registry || new PluginRegistryService({ now: this.now });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSync = runtime.readdirSync || fs.readdirSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.statSync = runtime.statSync || fs.statSync.bind(fs);
  }

  public discover(input: PluginDiscoveryInput = {}): ZavorthPluginDiscoverySnapshot {
    const projectRoot = path.resolve(input.projectRoot || this.projectRoot);
    const workspaceRoot =
      input.workspaceRoot === undefined
        ? this.workspaceRoot
        : input.workspaceRoot
          ? path.resolve(input.workspaceRoot)
          : null;

    const sources = this.resolveSources(projectRoot, workspaceRoot);
    const candidates: DiscoveredCandidate[] = [];
    const sourceStats = sources.map((source) => {
      const packages = this.listPackageDirs(source.root);
      let validCount = 0;
      for (const packageDir of packages) {
        const discovered = this.discoverPackage(source, packageDir);
        if (discovered.validation.ok) {
          validCount += 1;
        }
        candidates.push(discovered);
      }
      return {
        kind: source.kind,
        root: source.root,
        exists: this.isDirectory(source.root),
        packageCount: packages.length,
        validCount,
      };
    });

    const resolved = this.resolveSelection(candidates);
    const plugins = resolved.plugins.slice().sort((left, right) => {
      if (left.selected !== right.selected) {
        return left.selected ? -1 : 1;
      }
      return left.pluginId.localeCompare(right.pluginId);
    });

    const bySource: Record<ZavorthPluginDiscoverySourceKind, number> = { ...EMPTY_BY_SOURCE };
    for (const plugin of plugins) {
      bySource[plugin.sourceKind] += 1;
    }

    const valid = plugins.filter((plugin) => plugin.validation.ok).length;
    const loadEligible = plugins.filter((plugin) => plugin.loadEligible).length;
    const selected = plugins.filter((plugin) => plugin.selected).length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION,
      sources: sourceStats,
      plugins,
      conflicts: resolved.conflicts,
      summary: {
        total: plugins.length,
        valid,
        invalid: plugins.length - valid,
        loadEligible,
        selected,
        bySource,
      },
    };
  }

  public formatSnapshotText(snapshot?: ZavorthPluginDiscoverySnapshot): string {
    const view = snapshot || this.discover();
    const lines = [
      'Zavorth Plugin Discovery',
      `Contract: ${view.contractVersion}`,
      `Generated: ${view.generatedAt}`,
      `Total: ${view.summary.total}`,
      `Valid: ${view.summary.valid}`,
      `Invalid: ${view.summary.invalid}`,
      `Selected: ${view.summary.selected}`,
      `Load eligible: ${view.summary.loadEligible}`,
      `By source: bundled=${view.summary.bySource.bundled} workspace=${view.summary.bySource.workspace} user=${view.summary.bySource.user}`,
      `Conflicts: ${view.conflicts.length}`,
    ];

    for (const source of view.sources) {
      lines.push(
        `Source ${source.kind}: root=${source.root} exists=${source.exists} packages=${source.packageCount} valid=${source.validCount}`,
      );
    }

    for (const plugin of view.plugins.slice(0, 40)) {
      lines.push(
        `- ${plugin.pluginId} [${plugin.sourceKind}] selected=${plugin.selected} valid=${plugin.validation.ok} eligible=${plugin.loadEligible} state=${plugin.state.runtimeState}`,
      );
    }

    return lines.join('\n');
  }

  private resolveSources(projectRoot: string, workspaceRoot: string | null): ZavorthPluginDiscoverySource[] {
    const workspaceBase = workspaceRoot || projectRoot;
    const roots: Record<ZavorthPluginDiscoverySourceKind, string> = {
      bundled: this.bundledPluginsDir ? path.resolve(this.bundledPluginsDir) : path.join(projectRoot, 'plugins'),
      workspace: this.workspacePluginsDir
        ? path.resolve(this.workspacePluginsDir)
        : path.join(workspaceBase, '.zavorth', 'plugins'),
      user: this.userPluginsDir
        ? path.resolve(this.userPluginsDir)
        : this.userHome
          ? path.join(this.userHome, '.zavorth', 'plugins')
          : path.join(projectRoot, '.zavorth-user-plugins-missing'),
    };

    return ZAVORTH_PLUGIN_DISCOVERY_SOURCE_KINDS.map((kind) => ({
      kind,
      root: roots[kind],
      priority: ZAVORTH_PLUGIN_DISCOVERY_SOURCE_PRIORITY[kind],
    }));
  }

  private listPackageDirs(root: string): string[] {
    if (!this.isDirectory(root)) {
      return [];
    }

    try {
      const entries = this.readdirSync(root, { withFileTypes: true });
      return entries
        .filter((entry) => {
          const packageDir = path.join(root, typeof entry === 'string' ? entry : entry.name);
          if (typeof entry === 'string') {
            return this.isDirectory(packageDir) && Boolean(this.findManifest(packageDir));
          }
          if (!entry.isDirectory()) {
            return false;
          }
          return Boolean(this.findManifest(packageDir));
        })
        .map((entry) => path.join(root, typeof entry === 'string' ? entry : entry.name))
        .sort((left, right) => left.localeCompare(right));
    } catch {
      return [];
    }
  }

  private discoverPackage(source: ZavorthPluginDiscoverySource, packageDir: string): DiscoveredCandidate {
    const folderName = path.basename(packageDir);
    const manifestHit = this.findManifest(packageDir);
    const findings: string[] = [];

    if (!manifestHit) {
      const pluginId = this.normalizeId(folderName) || folderName;
      const state = this.resolveStateView(pluginId, null);
      return {
        pluginId,
        sourceKind: source.kind,
        sourceRoot: source.root,
        packageDir,
        manifestPath: '',
        manifestFilename: ZAVORTH_PLUGIN_MANIFEST_FILENAMES[0],
        manifest: null,
        validation: { ok: false, findings: ['manifest file not found'] },
        compatibility: { ok: false, findings: ['manifest file not found'] },
        state,
        loadEligible: false,
        selected: false,
        findings: ['manifest file not found'],
        priority: source.priority,
      };
    }

    const rawResult = this.readJsonObject(manifestHit.manifestPath);
    if (rawResult.ok === false) {
      const pluginId = this.normalizeId(folderName) || folderName;
      const state = this.resolveStateView(pluginId, null);
      const parseFindings = [rawResult.error];
      return {
        pluginId,
        sourceKind: source.kind,
        sourceRoot: source.root,
        packageDir,
        manifestPath: manifestHit.manifestPath,
        manifestFilename: manifestHit.manifestFilename,
        manifest: null,
        validation: { ok: false, findings: parseFindings },
        compatibility: { ok: false, findings: parseFindings },
        state,
        loadEligible: false,
        selected: false,
        findings: parseFindings,
        priority: source.priority,
      };
    }

    const raw = rawResult.value;
    const rawId = this.pickPluginId(raw, folderName);
    const pluginId = this.normalizeId(rawId) || this.normalizeId(folderName) || folderName;
    const isPluginOs =
      String((raw as { schemaVersion?: unknown }).schemaVersion || '') === ZAVORTH_PLUGIN_OS_API_VERSION;

    let manifest: ZavorthPluginManifest | null = null;
    let validation: ZavorthPluginDiscoveryValidation;
    let compatibility: ZavorthPluginDiscoveryCompatibility;

    if (!isPluginOs) {
      const note = 'manifest is not a Zavorth Plugin OS manifest (expected schemaVersion zavorth.plugin-os.v1)';
      findings.push(note);
      validation = { ok: false, findings: [note] };
      compatibility = { ok: false, findings: [note] };
    } else {
      const partial = raw as Partial<ZavorthPluginManifest>;
      const validationFindings = this.registry.validateManifest({
        ...partial,
        id: pluginId,
      });
      validation = {
        ok: validationFindings.length === 0,
        findings: validationFindings,
      };
      findings.push(...validationFindings);
      compatibility = this.evaluateCompatibility(partial);
      findings.push(...compatibility.findings);
      manifest = {
        ...(partial as ZavorthPluginManifest),
        id: pluginId,
      };
    }

    const state = this.resolveStateView(pluginId, manifest);
    return {
      pluginId,
      sourceKind: source.kind,
      sourceRoot: source.root,
      packageDir,
      manifestPath: manifestHit.manifestPath,
      manifestFilename: manifestHit.manifestFilename,
      manifest,
      validation,
      compatibility,
      state,
      loadEligible: false,
      selected: false,
      findings: this.unique(findings),
      priority: source.priority,
    };
  }

  private resolveSelection(candidates: DiscoveredCandidate[]): {
    plugins: ZavorthDiscoveredPlugin[];
    conflicts: ZavorthPluginDiscoverySnapshot['conflicts'];
  } {
    const byId = new Map<string, DiscoveredCandidate[]>();
    for (const candidate of candidates) {
      const bucket = byId.get(candidate.pluginId) || [];
      bucket.push(candidate);
      byId.set(candidate.pluginId, bucket);
    }

    const plugins: ZavorthDiscoveredPlugin[] = [];
    const conflicts: ZavorthPluginDiscoverySnapshot['conflicts'] = [];

    for (const [pluginId, group] of byId.entries()) {
      const ordered = group.slice().sort((left, right) => {
        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }
        return left.packageDir.localeCompare(right.packageDir);
      });
      const winner = ordered[0];
      if (ordered.length > 1) {
        conflicts.push({
          pluginId,
          selectedSourceKind: winner.sourceKind,
          suppressedSourceKinds: ordered.slice(1).map((item) => item.sourceKind),
        });
      }

      for (const item of ordered) {
        const selected = item === winner;
        const loadEligible =
          selected &&
          item.validation.ok &&
          item.compatibility.ok &&
          item.state.trust !== 'blocked' &&
          item.state.installed === true &&
          item.state.enabled === true &&
          item.state.runtimeState === 'enabled';
        const { priority: _priority, ...rest } = item;
        plugins.push({
          ...rest,
          selected,
          loadEligible,
        });
      }
    }

    conflicts.sort((left, right) => left.pluginId.localeCompare(right.pluginId));
    return { plugins, conflicts };
  }

  private evaluateCompatibility(manifest: Partial<ZavorthPluginManifest>): ZavorthPluginDiscoveryCompatibility {
    const findings: string[] = [];
    let ok = true;

    if (manifest.schemaVersion !== ZAVORTH_PLUGIN_OS_API_VERSION) {
      findings.push(`schemaVersion must be ${ZAVORTH_PLUGIN_OS_API_VERSION}`);
      ok = false;
    }

    const pluginApiVersion = manifest.compatibility?.pluginApiVersion;
    if (pluginApiVersion !== ZAVORTH_PLUGIN_OS_API_VERSION) {
      findings.push(`compatibility.pluginApiVersion must be ${ZAVORTH_PLUGIN_OS_API_VERSION}`);
      ok = false;
    }

    const zavorthVersion = manifest.compatibility?.zavorthVersion;
    if (zavorthVersion !== undefined && zavorthVersion !== null) {
      if (String(zavorthVersion).trim() === '') {
        findings.push('compatibility.zavorthVersion is empty');
        ok = false;
      } else {
        const rangeResult = this.checkVersionRequirement(String(zavorthVersion).trim(), this.zavorthVersion);
        if (rangeResult === 'unparsable') {
          findings.push(`compatibility.zavorthVersion is unparsable: ${zavorthVersion}`);
        } else if (rangeResult === 'mismatch') {
          findings.push(`compatibility.zavorthVersion ${zavorthVersion} does not match runtime ${this.zavorthVersion}`);
          ok = false;
        }
      }
    }

    return { ok, findings };
  }

  private resolveStateView(pluginId: string, manifest: ZavorthPluginManifest | null): ZavorthPluginDiscoveryStateView {
    const defaultTrust: ZavorthPluginTrustLevel = manifest?.policy?.defaultTrust || 'review';
    const lookup = this.stateLookup?.resolve(pluginId) || null;

    const installed = lookup?.installed === true;
    const enabled = lookup?.enabled === true;
    const trust: ZavorthPluginTrustLevel = lookup?.trust || defaultTrust;
    const installedRevision = lookup?.installedRevision ?? null;
    const sourceLocator = lookup?.sourceLocator ?? null;
    const runtimeState = this.mapRuntimeState({ trust, installed, enabled });

    return {
      runtimeState,
      trust,
      installed,
      enabled,
      installedRevision,
      sourceLocator,
    };
  }

  private mapRuntimeState(input: {
    trust: ZavorthPluginTrustLevel;
    installed: boolean;
    enabled: boolean;
  }): ZavorthPluginRuntimeState {
    if (input.trust === 'blocked') {
      return 'blocked';
    }
    if (input.installed && input.enabled) {
      return 'enabled';
    }
    if (input.installed) {
      return 'disabled';
    }
    return 'available';
  }

  private findManifest(packageDir: string): {
    manifestPath: string;
    manifestFilename: ZavorthPluginManifestFilename;
  } | null {
    for (const filename of ZAVORTH_PLUGIN_MANIFEST_FILENAMES) {
      const manifestPath = path.join(packageDir, filename);
      if (this.existsSync(manifestPath) && this.isFile(manifestPath)) {
        return { manifestPath, manifestFilename: filename };
      }
    }
    return null;
  }

  private readJsonObject(
    filePath: string,
  ): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
    try {
      const text = this.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(String(text));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, error: 'manifest JSON must be an object' };
      }
      return { ok: true, value: parsed as Record<string, unknown> };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: `manifest JSON parse failed: ${message}` };
    }
  }

  private pickPluginId(raw: Record<string, unknown>, folderName: string): string {
    const id = raw.id;
    if (typeof id === 'string' && id.trim()) {
      return id.trim();
    }
    const name = raw.name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
    return folderName;
  }

  private checkVersionRequirement(requirement: string, current: string): 'match' | 'mismatch' | 'unparsable' {
    const currentParts = this.parseSemver(current);
    if (!currentParts) {
      return 'unparsable';
    }

    const trimmed = requirement.trim();
    if (trimmed.startsWith('>=')) {
      const required = this.parseSemver(trimmed.slice(2).trim());
      if (!required) {
        return 'unparsable';
      }
      return this.compareSemver(currentParts, required) >= 0 ? 'match' : 'mismatch';
    }

    if (trimmed.startsWith('>')) {
      const required = this.parseSemver(trimmed.slice(1).trim());
      if (!required) {
        return 'unparsable';
      }
      return this.compareSemver(currentParts, required) > 0 ? 'match' : 'mismatch';
    }

    if (trimmed.startsWith('<=')) {
      const required = this.parseSemver(trimmed.slice(2).trim());
      if (!required) {
        return 'unparsable';
      }
      return this.compareSemver(currentParts, required) <= 0 ? 'match' : 'mismatch';
    }

    if (trimmed.startsWith('<')) {
      const required = this.parseSemver(trimmed.slice(1).trim());
      if (!required) {
        return 'unparsable';
      }
      return this.compareSemver(currentParts, required) < 0 ? 'match' : 'mismatch';
    }

    if (trimmed.startsWith('=')) {
      const required = this.parseSemver(trimmed.slice(1).trim());
      if (!required) {
        return 'unparsable';
      }
      return this.compareSemver(currentParts, required) === 0 ? 'match' : 'mismatch';
    }

    const exact = this.parseSemver(trimmed);
    if (!exact) {
      return 'unparsable';
    }
    return this.compareSemver(currentParts, exact) === 0 ? 'match' : 'mismatch';
  }

  private parseSemver(value: string): [number, number, number] | null {
    const match = String(value || '')
      .trim()
      .match(/^v?(\d+)\.(\d+)\.(\d+)/i);
    if (!match) {
      return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  private compareSemver(left: [number, number, number], right: [number, number, number]): number {
    for (let index = 0; index < 3; index += 1) {
      if (left[index] !== right[index]) {
        return left[index] - right[index];
      }
    }
    return 0;
  }

  private isDirectory(targetPath: string): boolean {
    try {
      if (!this.existsSync(targetPath)) {
        return false;
      }
      return this.statSync(targetPath).isDirectory();
    } catch {
      return false;
    }
  }

  private isFile(targetPath: string): boolean {
    try {
      if (!this.existsSync(targetPath)) {
        return false;
      }
      return this.statSync(targetPath).isFile();
    } catch {
      return false;
    }
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:/-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }
}
