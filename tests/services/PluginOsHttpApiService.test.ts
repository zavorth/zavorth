import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type * as http from 'http';

import { PluginOsHttpApiService } from '../../src/services/PluginOsHttpApiService.js';
import { PluginStateBridgeService } from '../../src/services/PluginStateBridgeService.js';

describe('PluginOsHttpApiService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-plugin-os-api-'));
    tempRoots.push(root);
    fs.mkdirSync(path.join(root, '.zavorth'), { recursive: true });
    return root;
  }

  it('builds enriched snapshot from bridge', () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'demo-plugin',
      revision: '1.0.0',
      sourceLocator: './plugins/demo',
      trust: 'review',
      enable: false,
    });

    const api = new PluginOsHttpApiService({ projectRoot: root, stateBridge: bridge });
    const snapshot = api.buildEnrichedSnapshot(root);
    expect(snapshot.plugins.some((p) => p.pluginId === 'demo-plugin')).toBe(true);
    expect(snapshot.commands).toContain('enable');
  });

  it('enables and disables plugins when approved', async () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'toggle-me',
      revision: '0.1.0',
      trust: 'trusted',
      enable: false,
    });
    const api = new PluginOsHttpApiService({ projectRoot: root, stateBridge: bridge });

    const denied = await api.executeAction({ action: 'enable', pluginId: 'toggle-me' }, root);
    expect(denied.ok).toBe(false);

    const enabled = await api.executeAction(
      {
        action: 'enable',
        pluginId: 'toggle-me',
        approved: true,
      },
      root,
    );
    expect(enabled.ok).toBe(true);
    expect(enabled.result.bridged?.enabled).toBe(true);

    const disabled = await api.executeAction(
      {
        action: 'disable',
        pluginId: 'toggle-me',
        approved: true,
      },
      root,
    );
    expect(disabled.ok).toBe(true);
    expect(disabled.result.bridged?.enabled).toBe(false);
  });

  it('recommends plugins without approval and never auto-enables', async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'plugins', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'manifest.json'),
      JSON.stringify({
        id: 'web-search',
        summary: 'Search the web',
        tags: ['search', 'web'],
        capabilities: [{ id: 'search.query' }],
      }),
      'utf8',
    );
    const api = new PluginOsHttpApiService({ projectRoot: root });
    const result = await api.executeAction(
      {
        action: 'recommend',
        // Exact plugin id — free-text soft ranking is intentionally disabled.
        intent: 'web-search',
      },
      root,
    );
    expect(result.ok).toBe(true);
    const rec = result.result.recommendations as {
      autoEnable-: boolean;
      recommendations-: Array<{ pluginId: string }>;
    };
    expect(rec.autoEnable).toBe(false);
    expect(rec.recommendations?.[0]?.pluginId).toBe('web-search');
  });

  it('persists metrics via action', async () => {
    const root = makeRoot();
    const api = new PluginOsHttpApiService({ projectRoot: root });
    const result = await api.executeAction({ action: 'metrics-persist' }, root);
    expect(result.ok).toBe(true);
    expect(result.result.metricsPath).toBeTruthy();
    expect(fs.existsSync(path.join(root, String(result.result.metricsPath)))).toBe(true);
  });

  it('plans onboarding and samples telemetry', async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'plugins', 'web-search'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'plugins', 'web-search', 'manifest.json'),
      JSON.stringify({ id: 'web-search', summary: 'search', capabilities: [{ id: 'search.query' }] }),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([{ id: 'web-search', name: 'Web Search', tier: 'first-party' }]),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-onboarding.json'),
      JSON.stringify({
        defaultProfile: 'recommended',
        profiles: {
          recommended: {
            label: 'Recommended',
            summary: 'rec',
            includeTiers: ['first-party'],
            excludeOptional: true,
          },
        },
      }),
      'utf8',
    );

    const api = new PluginOsHttpApiService({ projectRoot: root });
    const plan = await api.executeAction({ action: 'onboarding-plan', profile: 'recommended' }, root);
    expect(plan.ok).toBe(true);
    expect(plan.result.onboarding).toBeTruthy();

    const sample = await api.executeAction({ action: 'telemetry-sample' }, root);
    expect(sample.ok).toBe(true);
    expect(sample.result.telemetry).toBeTruthy();
  });

  it('previews permissions without approval and undoes onboarding when approved', async () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
    for (const id of ['web-search', 'security-guidance']) {
      fs.mkdirSync(path.join(root, 'plugins', id), { recursive: true });
      fs.writeFileSync(
        path.join(root, 'plugins', id, 'manifest.json'),
        JSON.stringify({
          id,
          label: id,
          moduleKind: 'tool',
          policy: { defaultTrust: 'trusted' },
          permissions: [
            {
              kind: 'network.external',
              scope: 'external',
              reason: 'demo',
              required: false,
            },
          ],
        }),
        'utf8',
      );
    }
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-marketplace-curated.json'),
      JSON.stringify([
        { id: 'web-search', name: 'Web Search', tier: 'first-party' },
        { id: 'security-guidance', name: 'Security', tier: 'first-party' },
      ]),
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'config', 'plugin-os-onboarding.json'),
      JSON.stringify({
        defaultProfile: 'recommended',
        profiles: {
          recommended: {
            label: 'Recommended',
            summary: 'rec',
            includeIds: ['web-search', 'security-guidance'],
            excludeOptional: true,
          },
        },
      }),
      'utf8',
    );

    const bridge = new PluginStateBridgeService({ projectRoot: root });
    const api = new PluginOsHttpApiService({ projectRoot: root, stateBridge: bridge });

    const preview = await api.executeAction(
      {
        action: 'preview-permissions',
        pluginId: 'web-search',
      },
      root,
    );
    expect(preview.ok).toBe(true);
    const permissionPreview = preview.result.permissionPreview as {
      pluginId-: string;
      permissions-: unknown[];
      risks-: string[];
      text-: string;
    };
    expect(permissionPreview?.pluginId).toBe('web-search');
    expect((permissionPreview?.permissions || []).length).toBeGreaterThan(0);
    expect(permissionPreview?.text).toContain('Permission preview');

    const applied = await api.executeAction(
      {
        action: 'onboarding-apply',
        profile: 'recommended',
        approved: true,
      },
      root,
    );
    expect(applied.ok).toBe(true);
    expect(bridge.resolve('web-search').enabled).toBe(true);

    const deniedUndo = await api.executeAction({ action: 'onboarding-undo' }, root);
    expect(deniedUndo.ok).toBe(false);

    const undone = await api.executeAction(
      {
        action: 'onboarding-undo',
        approved: true,
      },
      root,
    );
    expect(undone.ok).toBe(true);
    const onboard = undone.result.onboarding as { disabled-: string[] };
    expect((onboard?.disabled || []).length).toBeGreaterThan(0);
    expect(bridge.resolve('web-search').enabled).toBe(false);
  });

  it('sets trust and inspects plugin', async () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'trust-me',
      revision: '0.2.0',
      trust: 'review',
      enable: true,
    });
    const api = new PluginOsHttpApiService({ projectRoot: root, stateBridge: bridge });

    const trusted = await api.executeAction(
      {
        action: 'trust',
        pluginId: 'trust-me',
        trust: 'trusted',
        approved: true,
      },
      root,
    );
    expect(trusted.ok).toBe(true);
    expect(trusted.result.bridged?.trust).toBe('trusted');

    const inspected = await api.executeAction(
      {
        action: 'inspect',
        pluginId: 'trust-me',
        approved: true,
      },
      root,
    );
    expect(inspected.ok).toBe(true);
    expect(inspected.result.bridged?.pluginId).toBe('trust-me');
  });

  it('handles HTTP GET /api/plugin-os and POST /api/plugin-os/actions', async () => {
    const root = makeRoot();
    const bridge = new PluginStateBridgeService({ projectRoot: root });
    bridge.markInstalled({
      pluginId: 'http-demo',
      revision: '1.0.0',
      trust: 'review',
      enable: false,
    });
    const api = new PluginOsHttpApiService({ projectRoot: root, stateBridge: bridge });

    const writes: Array<{ body: unknown; status: number }> = [];
    const writeJson = (_res: http.ServerResponse, body: unknown, statusCode = 200) => {
      writes.push({ body, status: statusCode });
    };
    const readJsonBody = async () => ({
      action: 'enable',
      pluginId: 'http-demo',
      approved: true,
    });

    const reqGet = { method: 'GET' } as http.IncomingMessage;
    const res = {} as http.ServerResponse;
    const handledGet = await api.handleRequest(
      reqGet,
      res,
      new URL('http://localhost/api/plugin-os'),
      '/api/plugin-os',
      { writeJson, readJsonBody, workspaceRoot: root },
    );
    expect(handledGet).toBe(true);
    expect(writes[0]?.status).toBe(200);
    expect((writes[0]?.body as { ok-: boolean }).ok).toBe(true);

    const reqPost = { method: 'POST' } as http.IncomingMessage;
    const handledPost = await api.handleRequest(
      reqPost,
      res,
      new URL('http://localhost/api/plugin-os/actions'),
      '/api/plugin-os/actions',
      { writeJson, readJsonBody, workspaceRoot: root },
    );
    expect(handledPost).toBe(true);
    const last = writes[writes.length - 1];
    expect((last?.body as { ok-: boolean }).ok).toBe(true);
    expect(bridge.resolve('http-demo').enabled).toBe(true);
  });

  it('returns false for unrelated paths', async () => {
    const api = new PluginOsHttpApiService({ projectRoot: makeRoot() });
    const handled = await api.handleRequest(
      { method: 'GET' } as http.IncomingMessage,
      {} as http.ServerResponse,
      new URL('http://localhost/api/operations/plugins'),
      '/api/operations/plugins',
      {
        writeJson: () => undefined,
        readJsonBody: async () => ({}),
      },
    );
    expect(handled).toBe(false);
  });
});
