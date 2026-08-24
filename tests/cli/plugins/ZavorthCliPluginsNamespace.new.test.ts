import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runPlugins } from '../../../src/cli/plugins/ZavorthCliPluginsNamespace.js';
import { PluginStateBridgeService } from '../../../src/services/PluginStateBridgeService.js';

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-cli-plugins-new-'));
}

describe('ZavorthCliPluginsNamespace new + recommend', () => {
  // Scaffold flows spawn node/npm child processes; the budget covers
  // parallel-worker contention on the host.
  jest.setTimeout(60000);

  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('previews plugins new without --yes', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const result = (await runPlugins(root, ['new', 'preview-me'])) as { output?: string };
    const text = JSON.stringify(result);
    expect(text + String(result.output || '')).toMatch(/Preview|preview|--yes|--run/i);
    expect(fs.existsSync(path.join(root, 'plugins', 'preview-me', 'manifest.json'))).toBe(false);
  });

  it('creates plugins/hello with --run and enables bridge', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    await runPlugins(root, ['new', 'hello', '--run']);

    const targetDir = path.join(root, 'plugins', 'hello');
    expect(fs.existsSync(path.join(targetDir, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(targetDir, 'index.js'))).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'));
    expect(manifest.id).toBe('hello');
    expect(manifest.capabilities[0].id).toBe('main.ping');

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const state = bridge.resolve('hello');
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(true);
    expect(state.trust).toBe('trusted');
  });

  it('creates bridge plugin with --enable --smoke --yes', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');

    const result = (await runPlugins(root, [
      'new',
      'bridge-smoke',
      '--kind',
      'bridge',
      '--enable',
      '--smoke',
      '--yes',
    ])) as { ok?: boolean; output?: string };
    const text = `${JSON.stringify(result)}\n${result.output || ''}`;
    expect(text).toMatch(/bridge-smoke|ok=true|smoke/i);

    const targetDir = path.join(root, 'plugins', 'bridge-smoke');
    expect(fs.existsSync(path.join(targetDir, 'manifest.json'))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(targetDir, 'manifest.json'), 'utf8'));
    expect(manifest.moduleKind).toBe('bridge');
    expect(manifest.capabilities.some((c: { id: string }) => c.id === 'bridge.invoke')).toBe(true);

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const state = bridge.resolve('bridge-smoke');
    expect(state.installed).toBe(true);
    expect(state.enabled).toBe(true);
  });

  it('help lists new and recommend', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');
    const result = (await runPlugins(root, ['help'])) as { output?: string };
    const text = `${JSON.stringify(result)}\n${result.output || ''}`;
    expect(text).toMatch(/new </);
    expect(text).toMatch(/recommend/);
  });

  it('recommend ranks from intent text', async () => {
    const root = createTempRoot();
    tempRoots.push(root);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'tmp', version: '0.0.0' }), 'utf8');
    const pluginDir = path.join(root, 'plugins', 'web-search');
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(
        {
          schemaVersion: 'zavorth.plugin-os.v1',
          id: 'web-search',
          label: 'Web Search',
          version: '1.0.0',
          moduleKind: 'search',
          summary: 'Search the web',
          description: 'web search plugin',
          tags: ['search', 'web'],
          source: { kind: 'local', locator: 'local', trusted: false },
          compatibility: { zavorthVersion: '>=1.1.0', pluginApiVersion: 'zavorth.plugin-os.v1' },
          capabilities: [{ id: 'search.query', intent: 'search.web.query', label: 'Search', summary: 'query the web' }],
          permissions: [],
          entrypoint: { module: './index.js', exportName: 'register', runtime: 'node' },
          lifecycle: { actions: ['invoke'], defaultAction: 'invoke' },
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
        },
        null,
        2,
      ),
      'utf8',
    );

    // Free-text does not soft-rank (purity); exact plugin id in intent does.
    const result = (await runPlugins(root, ['recommend', 'web-search', '--json'])) as { output?: string };
    const text = `${JSON.stringify(result)}\n${result.output || ''}`;
    expect(text).toMatch(/web-search/);
  });
});
