import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import type { ZavorthPluginManifest } from '../contracts/PluginManifestContract.js';
import type {
  ZavorthPluginDiscoverySnapshot,
  ZavorthPluginLoadSnapshot,
  ZavorthPluginRuntimeBootstrapSnapshot,
} from '../contracts/core/PluginRuntimeContract.js';
import {
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
  type ManifestInferenceResult,
} from '../sdk/plugin/manifestInference.js';
import { isDefinedPlugin, type DefinedPlugin } from '../sdk/plugin/definePlugin.js';
import { PluginRuntimeService } from './PluginRuntimeService.js';
import {
  PluginStateBridgeService,
  type BridgedPluginState,
} from './PluginStateBridgeService.js';
import {
  PluginHotReloadService,
  type PluginHotReloadWatchHandle,
} from './PluginHotReloadService.js';
import { PluginDiscoveryService } from './PluginDiscoveryService.js';

export type PluginDevServiceRuntime = {
  now?: () => Date;
  stateBridge?: PluginStateBridgeService;
  runtimeService?: PluginRuntimeService;
  hotReload?: PluginHotReloadService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
  renameSync?: typeof fs.renameSync;
};

export type PluginDevStep = {
  id: string;
  ok: boolean;
  summary: string;
};

export type PluginDevSnapshot = {
  generatedAt: string;
  pluginPath: string;
  pluginId: string | null;
  steps: PluginDevStep[];
  discovery?: {
    total: number;
    valid: number;
    loadEligible: number;
    selected: number;
  };
  load?: {
    total: number;
    loaded: number;
    failed: number;
    blocked: number;
    skipped: number;
  };
  wire?: {
    plans: number;
    handlersRegistered: number;
    toolsRegistered: number;
    hooksRegistered: number;
  };
  inference?: ManifestInferenceResult;
  bridge?: BridgedPluginState | null;
  bootstrap?: ZavorthPluginRuntimeBootstrapSnapshot | null;
  nextCommands: string[];
  /** Present when watch mode is active; call stop() to end the watcher. */
  stop?: () => void;
  watchHandle?: PluginHotReloadWatchHandle | null;
  formatText(): string;
};

export class PluginDevService {
  private readonly now: () => Date;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly renameSyncImpl: typeof fs.renameSync;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly injectedRuntime: PluginRuntimeService | null;
  private readonly hotReload: PluginHotReloadService;

  constructor(runtime: PluginDevServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.renameSyncImpl = runtime.renameSync || fs.renameSync.bind(fs);
    this.injectedBridge = runtime.stateBridge || null;
    this.injectedRuntime = runtime.runtimeService || null;
    this.hotReload = runtime.hotReload || new PluginHotReloadService();
  }

  public async run(input: {
    root: string;
    pluginPath: string;
    enable?: boolean;
    trust?: 'review' | 'trusted';
    applyInference?: boolean;
    writeManifest?: boolean;
    watch?: boolean;
    watchIntervalMs?: number;
    watchMs?: number;
    onReload?: (info: { path: string; mtimeMs: number; ok: boolean; summary: string }) => void | Promise<void>;
  }): Promise<PluginDevSnapshot> {
    const root = path.resolve(input.root || process.cwd());
    const pluginPath = this.resolvePluginPath(root, input.pluginPath);
    const enable = input.enable !== false;
    const trust = input.trust === 'review' ? 'review' : 'trusted';
    const applyInference = input.applyInference !== false;
    const writeManifest = input.writeManifest === true;
    const watch = input.watch === true;
    const steps: PluginDevStep[] = [];

    if (!isInside(root, pluginPath)) {
      return this.buildSnapshot({
        pluginPath,
        pluginId: null,
        steps: [{
          id: 'resolve-path',
          ok: false,
          summary: 'Plugin path is outside the workspace root.',
        }],
        nextCommands: [],
      });
    }

    if (!this.existsSyncImpl(pluginPath)) {
      return this.buildSnapshot({
        pluginPath,
        pluginId: null,
        steps: [{
          id: 'resolve-path',
          ok: false,
          summary: `Plugin path does not exist: ${pluginPath}`,
        }],
        nextCommands: [],
      });
    }

    steps.push({
      id: 'resolve-path',
      ok: true,
      summary: `Resolved plugin path ${path.relative(root, pluginPath) || '.'}`,
    });

    const manifestPath = this.findManifestPath(pluginPath);
    const existingManifest = manifestPath
      ? this.readManifest(manifestPath)
      : null;
    steps.push({
      id: 'read-manifest',
      ok: Boolean(existingManifest),
      summary: existingManifest ? `Loaded manifest ${path.basename(manifestPath || 'manifest.json')} for ${existingManifest.id}`
        : 'No valid manifest.json found (will rely on inference)',
    });

    const entryModule = existingManifest?.entrypoint?.module || './index.js';
    const indexPath = path.resolve(pluginPath, entryModule);
    const sourceText = this.existsSyncImpl(indexPath)
      ? this.readFileSyncImpl(indexPath, 'utf8')
      : '';
    steps.push({
      id: 'read-source',
      ok: Boolean(sourceText),
      summary: sourceText ? `Read entrypoint ${path.basename(indexPath)}`
        : `Entrypoint missing: ${indexPath}`,
    });

    let defined: DefinedPlugin | null = null;
    let requiredModule: Record<string, unknown> | null = null;
    if (this.existsSyncImpl(indexPath)) {
      try {
        requiredModule = this.tryLoadModule(indexPath);
        defined = this.extractDefinedPlugin(requiredModule);
        steps.push({
          id: 'load-module',
          ok: true,
          summary: defined ? 'Loaded DefinedPlugin export'
            : requiredModule && typeof requiredModule.register === 'function' ? 'Loaded register export'
              : 'Module loaded without register/DefinedPlugin export',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({
          id: 'load-module',
          ok: false,
          summary: `Module load soft-failed: ${message}`,
        });
      }
    }

    let inference: ManifestInferenceResult;
    if (defined) {
      inference = inferManifestFromDefinedPlugin(defined);
    } else {
      const fallbackId = existingManifest?.id
        || path.basename(pluginPath)
        || 'dev-plugin';
      inference = sourceText
        ? inferManifestFromSource(sourceText, fallbackId)
        : {
          ok: false,
          source: existingManifest ? 'existing-manifest' : 'none',
          manifest: existingManifest,
          findings: sourceText ? [] : ['no source available for inference'],
          inferredCapabilityIds: (existingManifest?.capabilities || [])
            .map((capability) => capability.id),
          inferredHookEvents: [],
        };
    }

    const reconciled = reconcileManifestWithInference(
      existingManifest,
      inference,
      { writeMode: 'merge-dev' },
    );
    inference = {
      ...inference,
      findings: [...inference.findings, ...reconciled.findings],
      manifest: reconciled.manifest || inference.manifest,
    };

    steps.push({
      id: 'inference',
      ok: inference.ok || Boolean(existingManifest),
      summary: `Inference source=${inference.source}; capabilities=${inference.inferredCapabilityIds.join(', ') || 'none'}`,
    });

    if (applyInference && reconciled.manifest) {
      try {
        const sidecarPath = path.join(pluginPath, 'manifest.dev.inferred.json');
        this.writeFileSyncImpl(
          sidecarPath,
          `${JSON.stringify({
            generatedAt: this.now().toISOString(),
            source: inference.source,
            findings: inference.findings,
            drift: reconciled.drift,
            manifest: reconciled.manifest,
          }, null, 2)}\n`,
          'utf8',
        );
        steps.push({
          id: 'write-inferred-sidecar',
          ok: true,
          summary: `Wrote ${path.basename(sidecarPath)} (manifest.json left unchanged)`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({
          id: 'write-inferred-sidecar',
          ok: false,
          summary: `Failed to write inferred sidecar: ${message}`,
        });
      }
    }

    if (writeManifest && reconciled.manifest) {
      try {
        const targetManifestPath = manifestPath || path.join(pluginPath, 'manifest.json');
        const merged = reconciled.manifest;
        const missingCount = (inference.inferredCapabilityIds || []).filter((capabilityId) => {
          return !(existingManifest?.capabilities || []).some((capability) => capability.id === capabilityId);
        }).length;
        this.writeAtomicJson(targetManifestPath, merged);
        steps.push({
          id: 'write-manifest',
          ok: true,
          summary: missingCount > 0
            ? `Merged ${missingCount} inferred capability(ies) into ${path.basename(targetManifestPath)}`
            : `Wrote ${path.basename(targetManifestPath)} (no capability drift)`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({
          id: 'write-manifest',
          ok: false,
          summary: `Failed to write manifest: ${message}`,
        });
      }
    }

    const pluginId = existingManifest?.id
      || inference.manifest?.id
      || path.basename(pluginPath);

    const bridge = this.injectedBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: root,
    });

    let bridgeState: BridgedPluginState | null = null;
    try {
      bridgeState = bridge.markInstalled({
        pluginId,
        revision: existingManifest?.version || inference.manifest?.version || '0.1.0',
        sourceLocator: path.relative(root, pluginPath).replace(/\\/gu, '/') || pluginPath,
        trust,
        enable,
      });
      steps.push({
        id: 'bridge-install',
        ok: true,
        summary: `Bridge marked installed enable=${enable} trust=${trust}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      steps.push({
        id: 'bridge-install',
        ok: false,
        summary: `Bridge markInstalled failed: ${message}`,
      });
    }

    let bootstrap: ZavorthPluginRuntimeBootstrapSnapshot | null = null;
    let discoverySummary: PluginDevSnapshot['discovery'];
    let loadSummary: PluginDevSnapshot['load'];
    let wireSummary: PluginDevSnapshot['wire'];
    let runtime: PluginRuntimeService | null = null;

    try {
      const requireFromPlugin = createRequire(indexPath.endsWith('.js')
        ? indexPath
        : path.join(pluginPath, 'index.js'));
      runtime = this.injectedRuntime || new PluginRuntimeService({
        now: this.now,
        projectRoot: root,
        workspaceRoot: root,
        stateBridge: bridge,
        loadRuntime: {
          importModule: async (modulePath: string) => {
            try {
              const resolved = requireFromPlugin.resolve(modulePath);
              if (resolved && requireFromPlugin.cache[resolved]) {
                delete requireFromPlugin.cache[resolved];
              }
            } catch {
              /* soft-fail cache bust */
            }
            try {
              const loaded = requireFromPlugin(modulePath) as Record<string, unknown>;
              if (loaded && typeof loaded === 'object') {
                return loaded;
              }
            } catch {
              /* fall through to dynamic import */
            }
            const mod = await import(`${pathToFileURL(modulePath).href}...t=${Date.now()}`);
            return mod as Record<string, unknown>;
          },
        },
      });

      bootstrap = await runtime.bootstrap({
        projectRoot: root,
        workspaceRoot: root,
        approvedPluginIds: [pluginId],
      });

      discoverySummary = {
        total: bootstrap.discovery.summary.total,
        valid: bootstrap.discovery.summary.valid,
        loadEligible: bootstrap.discovery.summary.loadEligible,
        selected: bootstrap.discovery.summary.selected,
      };
      loadSummary = {
        total: bootstrap.load.summary.total,
        loaded: bootstrap.load.summary.loaded,
        failed: bootstrap.load.summary.failed,
        blocked: bootstrap.load.summary.blocked,
        skipped: bootstrap.load.summary.skipped,
      };
      wireSummary = {
        plans: bootstrap.wire.plans.length,
        handlersRegistered: bootstrap.wire.handlersRegistered,
        toolsRegistered: bootstrap.wire.toolsRegistered,
        hooksRegistered: bootstrap.wire.hooksRegistered,
      };

      const loadResult = bootstrap.load.results.find(
        (result) => result.pluginId === pluginId,
      );
      steps.push({
        id: 'runtime-bootstrap',
        ok: Boolean(loadResult && loadResult.status === 'loaded')
          || bootstrap.summary.loaded > 0,
        summary: loadResult ? `Load status=${loadResult.status}; capabilities=${loadResult.capabilities.length}; hooks=${loadResult.hooks.length}`
          : `Bootstrap complete loaded=${bootstrap.summary.loaded} failed=${bootstrap.summary.failed}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      steps.push({
        id: 'runtime-bootstrap',
        ok: false,
        summary: `Runtime bootstrap soft-failed: ${message}`,
      });
    }

    let watchHandle: PluginHotReloadWatchHandle | null = null;
    let stop: (() => void) | undefined;

    if (watch && runtime) {
      const activeRuntime = runtime;
      watchHandle = this.hotReload.watch({
        pluginPath,
        root,
        intervalMs: input.watchIntervalMs || 500,
        onChange: async (info) => {
          try {
            const discovery = new PluginDiscoveryService({
              now: this.now,
              projectRoot: root,
              stateLookup: bridge.asStateLookup(),
            });
            const snapshot = discovery.discover({ projectRoot: root });
            const discovered = snapshot.plugins.find((plugin) => plugin.pluginId === pluginId);
            if (!discovered) {
              steps.push({
                id: 'hot-reload',
                ok: false,
                summary: `hot-reload: plugin ${pluginId} not discovered`,
              });
              await input.onReload?.({
                path: info.path,
                mtimeMs: info.mtimeMs,
                ok: false,
                summary: 'plugin not discovered',
              });
              return;
            }
            const reloaded = await activeRuntime.reloadPlugin(pluginId, discovered, {
              approved: true,
            });
            const ok = reloaded.load.status === 'loaded';
            const summary = ok ? `hot-reload applied status=${reloaded.load.status} capabilities=${reloaded.load.capabilities.length}`
              : `hot-reload failed status=${reloaded.load.status} ${reloaded.load.findings.slice(0, 2).join('; ')}`;
            steps.push({
              id: 'hot-reload',
              ok,
              summary,
            });
            await input.onReload?.({
              path: info.path,
              mtimeMs: info.mtimeMs,
              ok,
              summary,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            steps.push({
              id: 'hot-reload',
              ok: false,
              summary: `hot-reload error: ${message}`,
            });
            await input.onReload?.({
              path: info.path,
              mtimeMs: info.mtimeMs,
              ok: false,
              summary: message,
            });
          }
        },
      });

      steps.push({
        id: 'watch',
        ok: true,
        summary: `Watching ${path.relative(root, pluginPath) || '.'} (interval=${input.watchIntervalMs || 500}ms)`,
      });

      stop = () => {
        watchHandle?.stop();
      };

      if (typeof input.watchMs === 'number' && input.watchMs > 0) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            stop?.();
            resolve();
          }, input.watchMs);
          if (typeof (timer as { unref?: () => void }).unref === 'function') {
            (timer as { unref: () => void }).unref();
          }
        });
      }
    }

    const relativePath = path.relative(root, pluginPath).replace(/\\/gu, '/') || pluginPath;
    const nextCommands = [
      `zavorth plugins inspect ${pluginId}`,
      `zavorth plugins doctor ${pluginId}`,
      `zavorth plugins disable ${pluginId}`,
      `zavorth plugins install ./${relativePath} --yes`,
      `zavorth plugins dev ./${relativePath} --watch`,
      `zavorth plugins dev ./${relativePath} --write-manifest`,
    ];

    return this.buildSnapshot({
      pluginPath: relativePath,
      pluginId,
      steps,
      discovery: discoverySummary,
      load: loadSummary,
      wire: wireSummary,
      inference,
      bridge: bridgeState,
      bootstrap,
      nextCommands,
      stop,
      watchHandle,
    });
  }

  private buildSnapshot(input: {
    pluginPath: string;
    pluginId: string | null;
    steps: PluginDevStep[];
    discovery?: PluginDevSnapshot['discovery'];
    load?: PluginDevSnapshot['load'];
    wire?: PluginDevSnapshot['wire'];
    inference?: ManifestInferenceResult;
    bridge?: BridgedPluginState | null;
    bootstrap?: ZavorthPluginRuntimeBootstrapSnapshot | null;
    nextCommands: string[];
    stop?: () => void;
    watchHandle?: PluginHotReloadWatchHandle | null;
  }): PluginDevSnapshot {
    const snapshot: PluginDevSnapshot = {
      generatedAt: this.now().toISOString(),
      pluginPath: input.pluginPath,
      pluginId: input.pluginId,
      steps: input.steps,
      discovery: input.discovery,
      load: input.load,
      wire: input.wire,
      inference: input.inference,
      bridge: input.bridge || null,
      bootstrap: input.bootstrap || null,
      nextCommands: input.nextCommands,
      stop: input.stop,
      watchHandle: input.watchHandle || null,
      formatText: () => formatSnapshotText(snapshot),
    };
    return snapshot;
  }

  private writeAtomicJson(filePath: string, value: unknown): void {
    const dir = path.dirname(filePath);
    this.mkdirSyncImpl(dir, { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    this.writeFileSyncImpl(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    try {
      this.renameSyncImpl(tempPath, filePath);
    } catch {
      this.writeFileSyncImpl(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      try {
        fs.rmSync(tempPath, { force: true });
      } catch {
        /* soft-fail cleanup */
      }
    }
  }

  private resolvePluginPath(root: string, pluginPath: string): string {
    const raw = String(pluginPath || '').trim();
    if (!raw) {
      return path.resolve(root);
    }
    if (path.isAbsolute(raw)) {
      return path.resolve(raw);
    }
    return path.resolve(root, raw);
  }

  private findManifestPath(pluginPath: string): string | null {
    const candidates = ['manifest.json', 'zavorth.plugin.json', 'plugin.json'];
    for (const name of candidates) {
      const candidate = path.join(pluginPath, name);
      if (this.existsSyncImpl(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private readManifest(manifestPath: string): ZavorthPluginManifest | null {
    try {
      const raw = JSON.parse(this.readFileSyncImpl(manifestPath, 'utf8')) as ZavorthPluginManifest;
      if (!raw || typeof raw !== 'object') {
        return null;
      }
      if (!raw.id) {
        return null;
      }
      return raw;
    } catch {
      return null;
    }
  }

  private tryLoadModule(modulePath: string): Record<string, unknown> {
    const require = createRequire(modulePath);
    // Bust require cache for iterative author loops.
    try {
      const resolved = require.resolve(modulePath);
      if (resolved && require.cache[resolved]) {
        delete require.cache[resolved];
      }
    } catch {
      /* soft-fail cache bust */
    }
    return require(modulePath) as Record<string, unknown>;
  }

  private extractDefinedPlugin(
    moduleExports: Record<string, unknown> | null,
  ): DefinedPlugin | null {
    if (!moduleExports) {
      return null;
    }
    if (isDefinedPlugin(moduleExports)) {
      return moduleExports;
    }
    if (isDefinedPlugin(moduleExports.default)) {
      return moduleExports.default;
    }
    if (isDefinedPlugin(moduleExports.plugin)) {
      return moduleExports.plugin;
    }
    if (
      moduleExports.manifest
      && typeof moduleExports.register === 'function'
      && isDefinedPlugin({
        kind: 'zavorth.defined-plugin',
        manifest: moduleExports.manifest,
        register: moduleExports.register,
        input: { id: (moduleExports.manifest as ZavorthPluginManifest).id },
      })
    ) {
      return {
        kind: 'zavorth.defined-plugin',
        manifest: moduleExports.manifest as ZavorthPluginManifest,
        register: moduleExports.register as DefinedPlugin['register'],
        input: { id: (moduleExports.manifest as ZavorthPluginManifest).id },
      };
    }
    return null;
  }
}

export function formatSnapshotText(snapshot: PluginDevSnapshot): string {
  const lines: string[] = [
    `Plugin dev: ${snapshot.pluginId || '<unknown>'}`,
    `Path: ${snapshot.pluginPath}`,
    `Generated: ${snapshot.generatedAt}`,
    '',
    'Steps:',
    ...snapshot.steps.map((step) => `  ${step.ok ? 'ok' : 'fail'} ${step.id}: ${step.summary}`),
  ];

  if (snapshot.inference) {
    lines.push(
      '',
      `Inference: source=${snapshot.inference.source} ok=${snapshot.inference.ok}`,
      `  capabilities: ${snapshot.inference.inferredCapabilityIds.join(', ') || 'none'}`,
      `  hooks: ${snapshot.inference.inferredHookEvents.join(', ') || 'none'}`,
      ...snapshot.inference.findings.slice(0, 8).map((finding) => ` ? ${finding}`),
    );
  }

  if (snapshot.bridge) {
    lines.push(
      '',
      `Bridge: installed=${snapshot.bridge.installed} enabled=${snapshot.bridge.enabled} trust=${snapshot.bridge.trust} state=${snapshot.bridge.runtimeState}`,
    );
  }

  if (snapshot.discovery) {
    lines.push(
      '',
      `Discovery: total=${snapshot.discovery.total} valid=${snapshot.discovery.valid} eligible=${snapshot.discovery.loadEligible} selected=${snapshot.discovery.selected}`,
    );
  }

  if (snapshot.load) {
    lines.push(
      `Load: total=${snapshot.load.total} loaded=${snapshot.load.loaded} failed=${snapshot.load.failed} blocked=${snapshot.load.blocked} skipped=${snapshot.load.skipped}`,
    );
  }

  if (snapshot.wire) {
    lines.push(
      `Wire: plans=${snapshot.wire.plans} handlers=${snapshot.wire.handlersRegistered} tools=${snapshot.wire.toolsRegistered} hooks=${snapshot.wire.hooksRegistered}`,
    );
  }

  if (snapshot.nextCommands.length > 0) {
    lines.push('', 'Next:', ...snapshot.nextCommands.map((command) => `  ${command}`));
  }

  return lines.join('\n');
}

function isInside(root: string, target: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export type {
  ZavorthPluginDiscoverySnapshot,
  ZavorthPluginLoadSnapshot,
};
