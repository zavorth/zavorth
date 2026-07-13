import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PluginOsMarketplaceService } from '../../src/services/PluginOsMarketplaceService.js';

const ROOT = path.resolve(__dirname, '../..');

describe('PluginOsMarketplaceService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function tempWorkspace() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mkt-'));
    tempRoots.push(root);
    // minimal monorepo markers
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        {
          id: 'web-search',
          name: 'Web Search',
          summary: 'Search the web',
          moduleKind: 'search',
          source: 'bundled://web-search',
          signed: true,
          tier: 'first-party',
          tags: ['search', 'web'],
          version: '1.0.0',
          permissions: ['network.external'],
        },
        {
          id: 'demo-remote-style',
          name: 'Demo Remote Style',
          summary: 'Materialize-only entry',
          moduleKind: 'tool',
          tier: 'community',
          tags: ['demo'],
          version: '0.1.0',
          permissions: [],
        },
      ], null, 2),
    );
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'manifest.json'),
      JSON.stringify({
        schemaVersion: 'zavorth.plugin-os.v1',
        id: 'web-search',
        label: 'Web Search',
        version: '1.0.0',
        moduleKind: 'search',
        summary: 'bundled',
        capabilities: [{ id: 'search.query', intent: 'search.query', label: 'Search', summary: 'q' }],
        permissions: [],
        entrypoint: { module: './index.js', exportName: 'register', runtime: 'node' },
        lifecycle: { actions: ['invoke'], defaultAction: 'invoke' },
        policy: { defaultTrust: 'review', requiresApproval: false },
        source: { kind: 'local', locator: 'bundled://web-search', trusted: false },
        compatibility: { zavorthVersion: '>=1.1.0', pluginApiVersion: 'zavorth.plugin-os.v1' },
      }, null, 2),
    );
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'index.js'),
      'function register(ctx){ ctx.bindCapability("search.query", async()=>({output:{ok:true}})); }\nmodule.exports={register};\n',
    );
    return root;
  }

  it('lists curated entries with install state', () => {
    const root = tempWorkspace();
    const service = new PluginOsMarketplaceService({ projectRoot: root });
    const listed = service.list({ root });
    expect(listed.ok).toBe(true);
    expect(listed.total).toBeGreaterThanOrEqual(2);
    const web = listed.entries.find((e) => e.id === 'web-search');
    expect(web).toBeTruthy();
    expect(web?.origin === 'curated' || web?.origin === 'bundled').toBe(true);
  });

  it('previews install path for bundled first-party', () => {
    const root = tempWorkspace();
    const service = new PluginOsMarketplaceService({ projectRoot: root });
    const preview = service.preview('web-search', { root });
    expect(preview.ok).toBe(true);
    expect(preview.bundledPath).toBeTruthy();
    expect(preview.canInstall).toBe(true);
    expect(preview.formatText()).toContain('web-search');
  });

  it('installs by copying bundled package under .zavorth/plugins', async () => {
    const root = tempWorkspace();
    const service = new PluginOsMarketplaceService({ projectRoot: root });
    const result = await service.install('web-search', { root, enable: false });
    expect(result.ok).toBe(true);
    expect(result.method === 'bundled-copy' || result.method === 'already-present').toBe(true);
    expect(result.packageDir).toBeTruthy();
    expect(fs.existsSync(path.join(result.packageDir!, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.packageDir!, 'index.js'))).toBe(true);
  });

  it('materializes non-bundled marketplace entry', async () => {
    const root = tempWorkspace();
    const service = new PluginOsMarketplaceService({ projectRoot: root });
    const result = await service.install('demo-remote-style', { root, enable: true });
    expect(result.ok).toBe(true);
    expect(result.method).toBe('materialize');
    expect(fs.existsSync(path.join(root, '.zavorth', 'plugins', 'demo-remote-style', 'manifest.json'))).toBe(true);
  });

  it('lists real monorepo catalog when projectRoot is repo', () => {
    const service = new PluginOsMarketplaceService({ projectRoot: ROOT });
    const listed = service.list({ root: ROOT, limit: 300 });
    expect(listed.ok).toBe(true);
    expect(listed.total).toBeGreaterThan(40);
    expect(listed.entries.some((e) => e.id === 'web-search')).toBe(true);
  });
});
