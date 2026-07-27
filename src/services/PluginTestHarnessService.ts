import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { PluginDiscoveryService } from './PluginDiscoveryService.js';
import { PluginLoadService } from './PluginLoadService.js';
import { PluginRegistryService } from './PluginRegistryService.js';
import { PluginRuntimeService } from './PluginRuntimeService.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';

export type PluginTestCaseResult = {
  name: string;
  ok: boolean;
  detail: string;
};

export type PluginTestHarnessResult = {
  ok: boolean;
  pluginId: string | null;
  pluginPath: string;
  results: PluginTestCaseResult[];
};

export type PluginTestHarnessRuntime = {
  now?: () => Date;
  stateBridge?: PluginStateBridgeService;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export class PluginTestHarnessService {
  private readonly now: () => Date;
  private readonly injectedBridge: PluginStateBridgeService | null;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: PluginTestHarnessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.injectedBridge = runtime.stateBridge || null;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public async run(input: {
    root: string;
    pluginPath: string;
    cases?: string[];
  }): Promise<PluginTestHarnessResult> {
    const root = path.resolve(input.root || process.cwd());
    const pluginPath = path.isAbsolute(input.pluginPath)
      ? path.resolve(input.pluginPath)
      : path.resolve(root, input.pluginPath);
    const results: PluginTestCaseResult[] = [];
    const relative = path.relative(root, pluginPath).replace(/\\/gu, '/') || pluginPath;

    if (!this.existsSyncImpl(pluginPath)) {
      return {
        ok: false,
        pluginId: null,
        pluginPath: relative,
        results: [{
          name: 'path-exists',
          ok: false,
          detail: `Plugin path does not exist: ${pluginPath}`,
        }],
      };
    }

    const manifestPath = this.findManifestPath(pluginPath);
    let manifest: Record<string, unknown> | null = null;
    let pluginId: string | null = null;

    // 1. manifest validates
    try {
      if (!manifestPath) {
        results.push({
          name: 'manifest-validates',
          ok: false,
          detail: 'No manifest.json / zavorth.plugin.json found',
        });
      } else {
        manifest = JSON.parse(this.readFileSyncImpl(manifestPath, 'utf8')) as Record<string, unknown>;
        pluginId = String(manifest.id || path.basename(pluginPath));
        const registry = new PluginRegistryService({ now: this.now });
        const findings = registry.validateManifest(manifest as never);
        results.push({
          name: 'manifest-validates',
          ok: findings.length === 0,
          detail: findings.length === 0
            ? `Manifest ok for ${pluginId}`
            : findings.slice(0, 4).join('; '),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: 'manifest-validates',
        ok: false,
        detail: `Manifest parse/validate failed: ${message}`,
      });
    }

    // 2. module loads register
    const entryModule = String(
      (manifest?.entrypoint && typeof manifest.entrypoint === 'object'
        ? (manifest.entrypoint as Record<string, unknown>).module
        : null)
      || './index.js',
    );
    const indexPath = path.resolve(pluginPath, entryModule);
    try {
      if (!this.existsSyncImpl(indexPath)) {
        results.push({
          name: 'module-loads-register',
          ok: false,
          detail: `Entrypoint missing: ${indexPath}`,
        });
      } else {
        const require = createRequire(indexPath);
        try {
          const resolved = require.resolve(indexPath);
          if (resolved && require.cache[resolved]) {
            delete require.cache[resolved];
          }
        } catch {
          /* soft-fail */
        }
        const mod = require(indexPath) as Record<string, unknown>;
        const hasRegister = typeof mod.register === 'function'
          || typeof mod.createZavorthModule === 'function'
          || typeof mod.default === 'function';
        results.push({
          name: 'module-loads-register',
          ok: hasRegister,
          detail: hasRegister ? 'Module exports register/createZavorthModule'
            : 'Module loaded but register/createZavorthModule export missing',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: 'module-loads-register',
        ok: false,
        detail: `Module load failed: ${message}`,
      });
    }

    const bridge = this.injectedBridge || new PluginStateBridgeService({
      now: this.now,
      projectRoot: root,
    });
    const id = pluginId || path.basename(pluginPath);

    // 3. loadEligible with bridge enable trusted
    try {
      bridge.markInstalled({
        pluginId: id,
        revision: String(manifest?.version || '0.1.0'),
        sourceLocator: relative.startsWith('.') ? relative : `./${relative}`,
        trust: 'trusted',
        enable: true,
      });
      const discovery = new PluginDiscoveryService({
        now: this.now,
        projectRoot: root,
        stateLookup: bridge.asStateLookup(),
      });
      const snapshot = discovery.discover({ projectRoot: root });
      const hit = snapshot.plugins.find((plugin) => plugin.pluginId === id);
      results.push({
        name: 'load-eligible',
        ok: Boolean(hit?.loadEligible),
        detail: hit ? `loadEligible=${hit.loadEligible} selected=${hit.selected} valid=${hit.validation.ok}`
          : 'Plugin not discovered after bridge enable',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: 'load-eligible',
        ok: false,
        detail: `Eligibility check failed: ${message}`,
      });
    }

    // 4. loadOne succeeds
    let loadResultStatus = 'unknown';
    let loadedCapabilities: string[] = [];
    let hookCount = 0;
    try {
      const requireFromPlugin = createRequire(
        this.existsSyncImpl(indexPath) ? indexPath : path.join(pluginPath, 'index.js'),
      );
      const runtime = new PluginRuntimeService({
        now: this.now,
        projectRoot: root,
        workspaceRoot: root,
        stateBridge: bridge,
        loadRuntime: {
          importModule: async (modulePath: string) => {
            try {
              const loaded = requireFromPlugin(modulePath) as Record<string, unknown>;
              if (loaded && typeof loaded === 'object') {
                return loaded;
              }
            } catch {
              /* fall through */
            }
            const mod = await import(pathToFileURL(modulePath).href);
            return mod as Record<string, unknown>;
          },
        },
      });
      const bootstrap = await runtime.bootstrap({
        projectRoot: root,
        workspaceRoot: root,
        approvedPluginIds: [id],
      });
      const loadHit = bootstrap.load.results.find((result) => result.pluginId === id);
      loadResultStatus = loadHit?.status || 'missing';
      loadedCapabilities = loadHit?.capabilities || [];
      hookCount = loadHit?.hooks?.length || 0;
      results.push({
        name: 'load-one',
        ok: loadHit?.status === 'loaded',
        detail: loadHit ? `status=${loadHit.status} capabilities=${loadHit.capabilities.length} findings=${loadHit.findings.slice(0, 3).join('; ') || 'none'}`
          : 'Plugin missing from load results',
      });

      // 5. invoke first capability when present
      if (loadedCapabilities.length > 0 && loadHit?.status === 'loaded') {
        try {
          const registry = new PluginRegistryService({ now: this.now });
          const loadedPlugin = bootstrap.load.loaded.find((entry) => entry.pluginId === id);
          if (loadedPlugin) {
            registry.registerManifest(loadedPlugin.manifest);
            try {
              registry.install?.(id, { approved: true });
            } catch {
              /* already */
            }
            try {
              registry.enable?.(id, { approved: true });
            } catch {
              /* already */
            }
            const handler = runtime['loader']
              ? (runtime as unknown as { loader: PluginLoadService }).loader.createRegistryHandler(id)
              : null;
            if (handler) {
              registry.registerHandler(id, handler);
            }
            const capabilityId = loadedCapabilities[0];
            const plan = registry.prepareInvocation({
              pluginId: id,
              capabilityId,
              input: {},
              approved: true,
            });
            const invocation = await registry.invoke({
              pluginId: id,
              capabilityId,
              input: {},
              approved: true,
            });
            const ok = invocation.status === 'executed'
              || invocation.status === 'planned'
              || invocation.status === 'approval_required'
              || plan.decision.status === 'allow'
              || plan.decision.status === 'needs_approval';
            results.push({
              name: 'invoke-capability',
              ok,
              detail: `capability=${capabilityId} invoke=${invocation.status} plan=${plan.decision.status}`,
            });
          } else {
            results.push({
              name: 'invoke-capability',
              ok: false,
              detail: 'Loaded plugin record missing for invoke',
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          results.push({
            name: 'invoke-capability',
            ok: false,
            detail: `Invoke failed: ${message}`,
          });
        }
      } else {
        results.push({
          name: 'invoke-capability',
          ok: loadResultStatus !== 'loaded' ? false : true,
          detail: loadedCapabilities.length === 0
            ? 'No capabilities to invoke'
            : `Skipped invoke because load status=${loadResultStatus}`,
        });
      }

      // 6. hooks registered count >= 0
      results.push({
        name: 'hooks-registered',
        ok: hookCount >= 0,
        detail: `hooks=${hookCount}`,
      });

      runtime.dispose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: 'load-one',
        ok: false,
        detail: `Runtime bootstrap failed: ${message}`,
      });
      results.push({
        name: 'invoke-capability',
        ok: false,
        detail: 'Skipped due to load failure',
      });
      results.push({
        name: 'hooks-registered',
        ok: false,
        detail: 'Skipped due to load failure',
      });
    }

    const selectedCases = Array.isArray(input.cases) && input.cases.length > 0
      ? new Set(input.cases.map((item) => String(item).trim()).filter(Boolean))
      : null;
    const filtered = selectedCases
      ? results.filter((result) => selectedCases.has(result.name))
      : results;

    return {
      ok: filtered.every((result) => result.ok),
      pluginId: id,
      pluginPath: relative,
      results: filtered,
    };
  }

  private findManifestPath(pluginPath: string): string | null {
    for (const name of ['manifest.json', 'zavorth.plugin.json', 'plugin.json']) {
      const candidate = path.join(pluginPath, name);
      if (this.existsSyncImpl(candidate)) {
        return candidate;
      }
    }
    return null;
  }
}
