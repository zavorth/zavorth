import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

function buildToolSurfaceSnapshot(selectedId: string | null = 'read_file', query: string | null = null) {
  return {
    generatedAt: '2026-04-02T12:00:00.000Z',
    summary: {
      families: 4,
      ready: 3,
      partial: 1,
      planned: 0,
      explicitTools: 9,
    },
    families: [
      {
        id: 'runtime',
        label: 'Runtime Tools',
        status: 'ready',
        total: 2,
        summary: 'Runtime Tools exposes 2 item(s), with 2 ready item(s) in the current plane.',
        examples: ['read_file', 'web_search'],
      },
    ],
    catalog: {
      generatedAt: '2026-04-02T12:00:00.000Z',
      summary: {
        totalFamilies: 4,
        readyFamilies: 3,
        partialFamilies: 1,
        plannedFamilies: 0,
        totalTools: 9,
        visibleTools: 1,
      },
      families: [],
      entries: [
        {
          id: 'read_file',
          label: 'read_file',
          familyId: 'runtime',
          familyLabel: 'Runtime Tools',
          kind: 'runtime-tool',
          source: 'runtime:registry',
          readiness: 'ready',
          summary: 'Le um file do workspace.',
          command: null,
          details: ['1 parametro(s).', '1 required(s).'],
          searchText: 'read_file runtime',
        },
      ],
      selected: selectedId
        ? {
            id: 'read_file',
            label: 'read_file',
            familyId: 'runtime',
            familyLabel: 'Runtime Tools',
            kind: 'runtime-tool',
            source: 'runtime:registry',
            readiness: 'ready',
            summary: 'Le um file do workspace.',
            command: null,
            details: ['1 parametro(s).', '1 required(s).'],
            searchText: 'read_file runtime',
          }
        : null,
      featuredIds: ['read_file'],
      query,
      narrative: {
        headline: query ? `Tool surface com 1 item(s) visible para "${query}".`
          : 'Surface explicita com 9 tool(s).',
        operatorSummary: 'Runtime Tools em foco.',
      },
    },
    narrative: {
      headline: 'Zavorth exposes 4 tool families in the current plane.',
      operatorSummary: '3 ready family/families, 1 partial e 0 planned.',
    },
  };
}

describe('WebApp tool surface endpoint', () => {
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

  it('serves the tool surface with selectedId/query through the web endpoint', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-tool-surface-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const toolSurfaceService = {
      buildSnapshot: jest.fn(({ selectedId, query }: any = {}) => buildToolSurfaceSnapshot(selectedId || 'read_file', query || null)),
    };

    const service = new DashboardService(logRepo, {
      toolSurfaceService: toolSurfaceService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/tools-selectedId=read_file&q=read_file',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(toolSurfaceService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'read_file',
        query: 'read_file',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        tools: expect.objectContaining({
          catalog: expect.objectContaining({
            query: 'read_file',
            selected: expect.objectContaining({
              id: 'read_file',
              familyId: 'runtime',
            }),
          }),
        }),
      }),
    );
  });
});
