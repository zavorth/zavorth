import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import { PluginDiscoveryService } from '../../src/services/PluginDiscoveryService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

const FIXED_NOW = () => new Date('2026-07-12T18:00:00.000Z');

function createTempRoot(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `zavorth-plugin-bridge-${label}-`));
}

const baseManifest = (overrides: Partial<ZavorthPluginManifest> = {}): ZavorthPluginManifest => ({
  schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  id: 'bridge-demo',
  label: 'Bridge Demo',
  version: '1.0.0',
  moduleKind: 'tool',
  summary: 'Bridge state demo plugin.',
  description: 'Used for PluginStateBridgeService discovery tests.',
  tags: ['tool'],
  source: {
    kind: 'local',
    locator: 'local://bridge-demo',
    digest: null,
    trusted: true,
  },
  compatibility: {
    zavorthVersion: '>=1.1.0',
    pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  },
  capabilities: [
    {
      id: 'demo.run',
      intent: 'demo',
      label: 'Demo',
      summary: 'Demo capability.',
      artifactKinds: [],
      command: { name: 'demo', aliases: [], usage: null },
    },
  ],
  permissions: [],
  entrypoint: {
    module: './index.js',
    exportName: 'register',
    runtime: 'node',
  },
  lifecycle: {
    actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
    defaultAction: 'invoke',
  },
  policy: {
    defaultTrust: 'review',
    requiresApproval: false,
    allowNetworkByDefault: false,
    allowFilesystemWriteByDefault: false,
    allowProcessSpawnByDefault: false,
    sandboxProfile: 'restricted',
  },
  artifactKinds: [],
  receiptKinds: [],
  ...overrides,
});

describe('PluginStateBridgeService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function track(root: string): string {
    tempRoots.push(root);
    return root;
  }

  it('resolves defaults for unknown plugin', () => {
    const projectRoot = track(createTempRoot('defaults'));
    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    const state = bridge.resolve('missing-plugin');
    expect(state).toEqual(expect.objectContaining({
      pluginId: 'missing-plugin',
      installed: false,
      enabled: false,
      trust: 'review',
      runtimeState: 'available',
      installedRevision: null,
      sourceLocator: null,
    }));
  });

  it('markInstalled sets installed, not enabled, runtimeState disabled', () => {
    const projectRoot = track(createTempRoot('install'));
    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    const state = bridge.markInstalled({
      pluginId: 'alpha',
      revision: '1.2.3',
      sourceLocator: './plugins/alpha',
      sourceDigest: 'sha256:abc',
      trust: 'review',
      enable: false,
    });
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(false);
    expect(state.runtimeState).toBe('disabled');
    expect(state.installedRevision).toBe('1.2.3');
    expect(state.sourceLocator).toBe('./plugins/alpha');
    expect(fs.existsSync(path.join(projectRoot, '.zavorth', 'plugin-os-state.json'))).toBe(true);
  });

  it('setEnabled true enables plugin and rewrites runtime index', () => {
    const projectRoot = track(createTempRoot('enable'));
    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    bridge.markInstalled({ pluginId: 'beta', revision: '0.1.0', enable: false });
    const state = bridge.setEnabled('beta', true);
    expect(state.enabled).toBe(true);
    expect(state.installed).toBe(true);
    expect(state.runtimeState).toBe('enabled');

    const runtimePath = path.join(projectRoot, '.zavorth', 'plugins-runtime.json');
    expect(fs.existsSync(runtimePath)).toBe(true);
    const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8')) as {
      enabled: Array<{ id: string }>;
    };
    expect(runtime.enabled.map((entry) => entry.id)).toContain('beta');
  });

  it('setTrust blocked keeps installed/enabled view but is not load-eligible via asStateLookup', () => {
    const projectRoot = track(createTempRoot('blocked'));
    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    bridge.markInstalled({ pluginId: 'gamma', revision: '1.0.0', enable: true });
    const state = bridge.setTrust('gamma', 'blocked');
    expect(state.trust).toBe('blocked');
    expect(state.runtimeState).toBe('blocked');
    expect(state.enabled).toBe(true);

    const lookup = bridge.asStateLookup().resolve('gamma');
    expect(lookup).toEqual(expect.objectContaining({
      installed: true,
      enabled: false,
      trust: 'blocked',
    }));
  });

  it('merges CLI plugins.json enabled record', () => {
    const projectRoot = track(createTempRoot('cli-merge'));
    const pluginsFile = path.join(projectRoot, '.zavorth', 'plugins.json');
    fs.mkdirSync(path.dirname(pluginsFile), { recursive: true });
    fs.writeFileSync(pluginsFile, JSON.stringify([
      {
        id: 'cli-plugin',
        name: 'cli-plugin',
        spec: './plugins/cli-plugin',
        version: '9.9.9',
        status: 'installed',
        enabled: true,
      },
    ], null, 2), 'utf8');

    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    const state = bridge.resolve('cli-plugin');
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(true);
    expect(state.runtimeState).toBe('enabled');
    expect(state.installedRevision).toBe('9.9.9');
    expect(state.sourceLocator).toBe('./plugins/cli-plugin');
    expect(state.origins.fromCliRecord).toBe(true);
  });

  it('PluginDiscoveryService with bridge.asStateLookup marks loadEligible when installed+enabled+not blocked', () => {
    const projectRoot = track(createTempRoot('discovery'));
    const userHome = track(createTempRoot('home'));
    const packageDir = path.join(projectRoot, 'plugins', 'bridge-demo');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(
      path.join(packageDir, 'manifest.json'),
      JSON.stringify(baseManifest(), null, 2),
      'utf8',
    );

    const bridge = new PluginStateBridgeService({ now: FIXED_NOW, projectRoot });
    bridge.markInstalled({
      pluginId: 'bridge-demo',
      revision: '1.0.0',
      sourceLocator: 'bundled://bridge-demo',
      enable: true,
      trust: 'trusted',
    });

    const discovery = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
      stateLookup: bridge.asStateLookup(),
    });
    const snapshot = discovery.discover();
    const plugin = snapshot.plugins.find((entry) => entry.pluginId === 'bridge-demo');
    expect(plugin).toBeTruthy();
    expect(plugin?.validation.ok).toBe(true);
    expect(plugin?.selected).toBe(true);
    expect(plugin?.state.installed).toBe(true);
    expect(plugin?.state.enabled).toBe(true);
    expect(plugin?.state.trust).toBe('trusted');
    expect(plugin?.loadEligible).toBe(true);

    bridge.setTrust('bridge-demo', 'blocked');
    const blockedSnap = discovery.discover();
    const blocked = blockedSnap.plugins.find((entry) => entry.pluginId === 'bridge-demo');
    expect(blocked?.state.trust).toBe('blocked');
    expect(blocked?.loadEligible).toBe(false);
  });
});
