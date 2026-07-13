import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { ZavorthPluginManifest } from '../../src/contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../../src/contracts/PluginManifestContract.js';
import {
  ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION,
} from '../../src/contracts/core/PluginRuntimeContract.js';
import { PluginDiscoveryService } from '../../src/services/PluginDiscoveryService.js';

const FIXED_NOW = () => new Date('2026-07-12T15:00:00.000Z');

const baseManifest = (overrides: Partial<ZavorthPluginManifest> = {}): ZavorthPluginManifest => ({
  schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  id: 'search-searxng',
  label: 'SearxNG Search',
  version: '1.0.0',
  moduleKind: 'search',
  summary: 'Self-hosted search connector.',
  description: 'Routes search.query through a governed SearxNG adapter.',
  tags: ['search', 'provider'],
  source: {
    kind: 'registry',
    locator: 'registry://zavorth/search-searxng',
    digest: 'sha256:demo',
    trusted: false,
  },
  compatibility: {
    zavorthVersion: '>=1.1.0',
    pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
  },
  capabilities: [
    {
      id: 'search.query',
      intent: 'web_search',
      label: 'Search Query',
      summary: 'Runs a policy-gated search query.',
      artifactKinds: ['search.result'],
      command: {
        name: 'search',
        aliases: ['find'],
        usage: '<query>',
      },
    },
  ],
  permissions: [
    {
      kind: 'network.external',
      scope: 'external',
      reason: 'Search provider calls external HTTP endpoints.',
      required: true,
    },
  ],
  entrypoint: {
    module: 'dist/modules/search-searxng.js',
    exportName: 'createSearchPlugin',
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
  artifactKinds: ['search.result'],
  receiptKinds: ['plugin.invocation', 'search.query.receipt'],
  ...overrides,
});

function createTempRoot(label: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `zavorth-plugin-discovery-${label}-`));
  return root;
}

function writeManifest(packageDir: string, filename: string, body: unknown): string {
  fs.mkdirSync(packageDir, { recursive: true });
  const filePath = path.join(packageDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');
  return filePath;
}

describe('PluginDiscoveryService', () => {
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

  it('returns an empty snapshot when roots do not exist', () => {
    const projectRoot = track(createTempRoot('empty-project'));
    const userHome = track(createTempRoot('empty-home'));
    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    const snapshot = service.discover();
    expect(snapshot.contractVersion).toBe(ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION);
    expect(snapshot.generatedAt).toBe('2026-07-12T15:00:00.000Z');
    expect(snapshot.plugins).toEqual([]);
    expect(snapshot.conflicts).toEqual([]);
    expect(snapshot.summary).toEqual({
      total: 0,
      valid: 0,
      invalid: 0,
      loadEligible: 0,
      selected: 0,
      bySource: { bundled: 0, workspace: 0, user: 0 },
    });
    expect(snapshot.sources.every((source) => source.exists === false)).toBe(true);
  });

  it('discovers a valid Plugin OS manifest from bundled and keeps it not loadEligible when disabled', () => {
    const projectRoot = track(createTempRoot('bundled-valid'));
    const userHome = track(createTempRoot('home-1'));
    const packageDir = path.join(projectRoot, 'plugins', 'search-searxng');
    writeManifest(packageDir, 'manifest.json', baseManifest());

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    const snapshot = service.discover();
    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.summary.valid).toBe(1);
    expect(snapshot.summary.loadEligible).toBe(0);
    expect(snapshot.plugins[0]).toEqual(
      expect.objectContaining({
        pluginId: 'search-searxng',
        sourceKind: 'bundled',
        selected: true,
        loadEligible: false,
        manifestFilename: 'manifest.json',
        validation: expect.objectContaining({ ok: true }),
        compatibility: expect.objectContaining({ ok: true }),
        state: expect.objectContaining({
          installed: false,
          enabled: false,
          runtimeState: 'available',
          trust: 'review',
        }),
      }),
    );
    expect(snapshot.plugins[0].manifest?.id).toBe('search-searxng');
  });

  it('marks loadEligible when installed, enabled, trusted and selected via stateLookup', () => {
    const projectRoot = track(createTempRoot('eligible'));
    const userHome = track(createTempRoot('home-2'));
    const packageDir = path.join(projectRoot, 'plugins', 'search-searxng');
    writeManifest(packageDir, 'manifest.json', baseManifest());

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
      stateLookup: {
        resolve: (pluginId) => {
          if (pluginId !== 'search-searxng') {
            return null;
          }
          return {
            installed: true,
            enabled: true,
            trust: 'trusted',
            installedRevision: '1.0.0',
            sourceLocator: 'bundled://search-searxng',
          };
        },
      },
    });

    const snapshot = service.discover();
    expect(snapshot.plugins[0].loadEligible).toBe(true);
    expect(snapshot.plugins[0].state).toEqual(
      expect.objectContaining({
        installed: true,
        enabled: true,
        trust: 'trusted',
        runtimeState: 'enabled',
        installedRevision: '1.0.0',
        sourceLocator: 'bundled://search-searxng',
      }),
    );
    expect(snapshot.summary.loadEligible).toBe(1);
  });

  it('reports validation findings for incomplete manifests', () => {
    const projectRoot = track(createTempRoot('invalid'));
    const userHome = track(createTempRoot('home-3'));
    const packageDir = path.join(projectRoot, 'plugins', 'broken-plugin');
    writeManifest(packageDir, 'manifest.json', {
      schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      id: 'broken-plugin',
      compatibility: {
        zavorthVersion: '>=1.0.0',
        pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      },
    });

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    const snapshot = service.discover();
    expect(snapshot.summary.valid).toBe(0);
    expect(snapshot.summary.invalid).toBe(1);
    expect(snapshot.plugins[0].validation.ok).toBe(false);
    expect(snapshot.plugins[0].validation.findings).toEqual(
      expect.arrayContaining([
        'label is required',
        'version is required',
        'at least one capability is required',
        'entrypoint exportName and runtime are required',
        'lifecycle must include invoke',
        'policy is required',
      ]),
    );
    expect(snapshot.plugins[0].loadEligible).toBe(false);
  });

  it('selects user source over bundled for the same plugin id and records a conflict', () => {
    const projectRoot = track(createTempRoot('conflict-project'));
    const userHome = track(createTempRoot('conflict-home'));
    const workspaceRoot = track(createTempRoot('conflict-workspace'));

    writeManifest(
      path.join(projectRoot, 'plugins', 'search-searxng'),
      'manifest.json',
      baseManifest({ version: '1.0.0', source: { kind: 'registry', locator: 'bundled', trusted: false } }),
    );
    writeManifest(
      path.join(userHome, '.zavorth', 'plugins', 'search-searxng'),
      'manifest.json',
      baseManifest({ version: '2.0.0', source: { kind: 'local', locator: 'user', trusted: false } }),
    );

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot,
      userHome,
    });

    const snapshot = service.discover();
    expect(snapshot.summary.total).toBe(2);
    expect(snapshot.conflicts).toEqual([
      {
        pluginId: 'search-searxng',
        selectedSourceKind: 'user',
        suppressedSourceKinds: ['bundled'],
      },
    ]);

    const selected = snapshot.plugins.find((plugin) => plugin.selected);
    const suppressed = snapshot.plugins.find((plugin) => !plugin.selected);
    expect(selected?.sourceKind).toBe('user');
    expect(selected?.manifest?.version).toBe('2.0.0');
    expect(suppressed?.sourceKind).toBe('bundled');
    expect(suppressed?.selected).toBe(false);
  });

  it('prefers manifest.json over zavorth.plugin.json in the same package', () => {
    const projectRoot = track(createTempRoot('manifest-order'));
    const userHome = track(createTempRoot('home-4'));
    const packageDir = path.join(projectRoot, 'plugins', 'dual-manifest');

    writeManifest(
      packageDir,
      'zavorth.plugin.json',
      baseManifest({
        id: 'from-zavorth-plugin-json',
        label: 'From zavorth.plugin.json',
      }),
    );
    writeManifest(
      packageDir,
      'manifest.json',
      baseManifest({
        id: 'from-manifest-json',
        label: 'From manifest.json',
      }),
    );

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    const snapshot = service.discover();
    expect(snapshot.plugins).toHaveLength(1);
    expect(snapshot.plugins[0].manifestFilename).toBe('manifest.json');
    expect(snapshot.plugins[0].pluginId).toBe('from-manifest-json');
    expect(snapshot.plugins[0].manifest?.label).toBe('From manifest.json');
  });

  it('handles malformed JSON without throwing', () => {
    const projectRoot = track(createTempRoot('malformed'));
    const userHome = track(createTempRoot('home-5'));
    const packageDir = path.join(projectRoot, 'plugins', 'broken-json');
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, 'manifest.json'), '{ not-json', 'utf8');

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    expect(() => service.discover()).not.toThrow();
    const snapshot = service.discover();
    expect(snapshot.plugins).toHaveLength(1);
    expect(snapshot.plugins[0].pluginId).toBe('broken-json');
    expect(snapshot.plugins[0].validation.ok).toBe(false);
    expect(snapshot.plugins[0].manifest).toBeNull();
    expect(snapshot.plugins[0].findings.some((item) => item.includes('parse failed'))).toBe(true);
  });

  it('does not mark blocked trust plugins as loadEligible', () => {
    const projectRoot = track(createTempRoot('blocked'));
    const userHome = track(createTempRoot('home-6'));
    writeManifest(
      path.join(projectRoot, 'plugins', 'search-searxng'),
      'manifest.json',
      baseManifest(),
    );

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
      stateLookup: {
        resolve: () => ({
          installed: true,
          enabled: true,
          trust: 'blocked',
          installedRevision: '1.0.0',
          sourceLocator: 'bundled://search-searxng',
        }),
      },
    });

    const snapshot = service.discover();
    expect(snapshot.plugins[0].state.trust).toBe('blocked');
    expect(snapshot.plugins[0].state.runtimeState).toBe('blocked');
    expect(snapshot.plugins[0].loadEligible).toBe(false);
    expect(snapshot.summary.loadEligible).toBe(0);
  });

  it('formatSnapshotText includes summary counts', () => {
    const projectRoot = track(createTempRoot('format'));
    const userHome = track(createTempRoot('home-7'));
    writeManifest(
      path.join(projectRoot, 'plugins', 'search-searxng'),
      'manifest.json',
      baseManifest(),
    );

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    const text = service.formatSnapshotText();
    expect(text).toContain('Zavorth Plugin Discovery');
    expect(text).toContain(`Contract: ${ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION}`);
    expect(text).toContain('Total: 1');
    expect(text).toContain('Valid: 1');
    expect(text).toContain('Invalid: 0');
    expect(text).toContain('Load eligible: 0');
    expect(text).toContain('search-searxng');
  });

  it('treats non Plugin OS manifests as invalid alternate packages', () => {
    const projectRoot = track(createTempRoot('legacy'));
    const userHome = track(createTempRoot('home-8'));
    writeManifest(
      path.join(projectRoot, 'plugins', 'legacy-pack'),
      'plugin.json',
      {
        name: 'legacy-pack',
        version: '0.1.0',
      },
    );

    const service = new PluginDiscoveryService({
      now: FIXED_NOW,
      projectRoot,
      workspaceRoot: null,
      userHome,
    });

    const snapshot = service.discover();
    expect(snapshot.plugins[0].pluginId).toBe('legacy-pack');
    expect(snapshot.plugins[0].manifest).toBeNull();
    expect(snapshot.plugins[0].validation.ok).toBe(false);
    expect(snapshot.plugins[0].findings).toEqual(
      expect.arrayContaining([
        'manifest is not a Zavorth Plugin OS manifest (expected schemaVersion zavorth.plugin-os.v1)',
      ]),
    );
  });
});
