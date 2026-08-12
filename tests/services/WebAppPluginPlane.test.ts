import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

function buildPluginSnapshot(selectedId: string | null = 'openrouter') {
  return {
    generatedAt: '2026-04-02T12:00:00.000Z',
    summary: {
      total: 2,
      ready: 1,
      configurable: 0,
      templates: 0,
      workspaceExtensions: 1,
      trusted: 1,
      installed: 2,
    },
    query: null,
    entries: [
      {
        id: 'openrouter',
        kind: 'integration',
        source: 'integration-hub',
        label: 'OpenRouter',
        version: 'native',
        readiness: 'ready',
        trust: 'trusted',
        summary: 'Gateway remoto.',
        actionHint: '/integrations openrouter',
        installState: 'installed',
        tags: ['remote'],
        capabilities: ['chat'],
        searchText: 'openrouter',
        actions: [
          {
            id: 'openrouter:inspect',
            label: 'Inspecionar',
            command: '/integrations openrouter',
            kind: 'inspect',
          },
          {
            id: 'openrouter:doctor',
            label: 'Rodar doctor',
            command: '/plugins doctor openrouter',
            kind: 'doctor',
          },
          {
            id: 'openrouter:open',
            label: 'Abrir proximo passo',
            command: '/plugins open openrouter',
            kind: 'open',
          },
          {
            id: 'openrouter:review',
            label: 'Marcar review',
            command: '/plugins review openrouter',
            kind: 'trust',
          },
          {
            id: 'openrouter:remove',
            label: 'Remover cadastro local',
            command: '/plugins remove openrouter',
            kind: 'remove',
          },
        ],
        details: ['Trust: trusted'],
      },
      {
        id: 'workspace:repo',
        kind: 'workspace-extension',
        source: 'workspace-profile',
        label: 'Repo Workspace',
        version: 'workspace-profile',
        readiness: 'workspace',
        trust: 'trusted',
        summary: 'Comandos e hooks do repo.',
        actionHint: 'npm run workspace:command -- --workspace "C:/repo" --list',
        installState: 'workspace',
        tags: ['workspace'],
        capabilities: ['workspace-extension'],
        searchText: 'workspace repo',
        actions: [],
        details: [],
      },
    ],
    selected: selectedId
      ? {
          id: 'openrouter',
          kind: 'integration',
          source: 'integration-hub',
          label: 'OpenRouter',
          version: 'native',
          readiness: 'ready',
          trust: 'trusted',
          summary: 'Gateway remoto.',
          actionHint: '/integrations openrouter',
          installState: 'installed',
          tags: ['remote'],
          capabilities: ['chat'],
          searchText: 'openrouter',
          actions: [
            {
              id: 'openrouter:inspect',
              label: 'Inspecionar',
              command: '/integrations openrouter',
              kind: 'inspect',
            },
            {
              id: 'openrouter:doctor',
              label: 'Rodar doctor',
              command: '/plugins doctor openrouter',
              kind: 'doctor',
            },
            {
              id: 'openrouter:open',
              label: 'Abrir proximo passo',
              command: '/plugins open openrouter',
              kind: 'open',
            },
          ],
          details: ['Trust: trusted'],
        }
      : null,
    featuredIds: ['openrouter'],
    narrative: {
      headline: 'Zavorth expõe 2 item(ns) no plano de plugins, skills e extensoes.',
      operatorSummary: '2 registrado(s), 1 trusted e 1 extensao(oes) vindas de ZAVORTH.md.',
    },
  };
}

describe('WebApp plugin plane actions', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('exposes the plugin plane snapshot and executes plugin actions through the web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-plugin-plane-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const pluginRegistryService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildPluginSnapshot(selectedId || 'openrouter')),
    };
    const pluginActionService = {
      execute: jest.fn(() => ({
        generatedAt: '2026-04-02T12:05:00.000Z',
        pluginId: 'openrouter',
        actionId: 'trust',
        status: 'applied',
        ok: true,
        summary: 'OpenRouter marcado como trusted.',
        details: ['Nenhum segredo foi alterado.'],
        selected: buildPluginSnapshot('openrouter').selected,
        snapshot: buildPluginSnapshot('openrouter'),
      })),
    };

    const service = new DashboardService(logRepo, {
      pluginRegistryService: pluginRegistryService as any,
      pluginActionService: pluginActionService as any,
    });

    await service.start();
    const { status: pluginsStatus, payload: pluginsPayload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/plugins',
      { token: 'web-secret' },
    );
    const { status: actionStatus, payload: actionPayload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/plugins/actions',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pluginId: 'openrouter',
            actionId: 'trust',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(pluginsStatus).toBe(200);
    expect(pluginsPayload).toEqual(
      expect.objectContaining({
        ok: true,
        plugins: expect.objectContaining({
          summary: expect.objectContaining({
            total: 2,
            installed: 2,
          }),
        }),
      }),
    );
    expect(actionStatus).toBe(200);
    expect(pluginActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'trust',
      }),
    );
    expect(actionPayload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'OpenRouter marcado como trusted.',
        }),
        plugins: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'openrouter',
          }),
        }),
      }),
    );
  });
});
