import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { ZavorthControlService } from '../../src/services/ZavorthControlService';
import { createTestLogRepo, fetchZavorthControlJson } from '../helpers/controlWebTestUtils.js';

function buildPluginSnapshot(selectedId: string | null = 'openrouter') {
  return {
    generatedAt: '2026-04-02T12:00:00.000Z',
    summary: {
      total: 1,
      ready: 1,
      configurable: 0,
      templates: 0,
      workspaceExtensions: 0,
      trusted: 1,
      installed: 1,
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
            id: 'openrouter:remove',
            label: 'Remover cadastro local',
            command: '/plugins remove openrouter',
            kind: 'remove',
          },
        ],
        details: ['Trust: trusted'],
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
              id: 'openrouter:remove',
              label: 'Remover cadastro local',
              command: '/plugins remove openrouter',
              kind: 'remove',
            },
          ],
          details: ['Trust: trusted'],
        }
      : null,
    featuredIds: ['openrouter'],
    narrative: {
      headline: 'Zavorth expõe 1 item(ns) no plano de plugins, skills e extensoes.',
      operatorSummary: '1 registrado(s) e 1 trusted.',
    },
  };
}

describe('ZavorthControl plugin plane actions', () => {
  const logRepo = createTestLogRepo();
  const originalZavorthControlRuntimeStateFile = config.zavorthControlRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthControlRuntimeStateFile = originalZavorthControlRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('serves plugin plane snapshots and action results through the classic zavorthControl api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-plugin-plane-'));
    tempDirs.push(root);
    config.zavorthControlRuntimeStateFile = path.join(root, 'zavorthControl-runtime.json');

    const pluginRegistryService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildPluginSnapshot(selectedId || 'openrouter')),
    };
    const pluginActionService = {
      execute: jest.fn(() => ({
        generatedAt: '2026-04-02T12:06:00.000Z',
        pluginId: 'openrouter',
        actionId: 'remove',
        status: 'applied',
        ok: true,
        summary: 'OpenRouter removido do cadastro local do plugin plane.',
        details: ['Overrides locais foram esquecidos.'],
        selected: buildPluginSnapshot('openrouter').selected,
        snapshot: buildPluginSnapshot('openrouter'),
      })),
    };

    const service = new ZavorthControlService(logRepo, {
      pluginRegistryService: pluginRegistryService as any,
      pluginActionService: pluginActionService as any,
    });

    await service.start();
    const { status: pluginsStatus, payload: pluginsPayload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/plugins',
    );
    const { status: actionStatus, payload: actionPayload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/plugins/actions',
      {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pluginId: 'openrouter',
            actionId: 'remove',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(pluginsStatus).toBe(200);
    expect(pluginsPayload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 1,
          installed: 1,
        }),
        selected: expect.objectContaining({
          id: 'openrouter',
        }),
      }),
    );
    expect(actionStatus).toBe(200);
    expect(pluginActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: 'openrouter',
        actionId: 'remove',
        requestedBy: 'zavorthControl',
      }),
    );
    expect(actionPayload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'OpenRouter removido do cadastro local do plugin plane.',
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
