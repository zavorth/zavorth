import { ZavorthControlService } from '../../src/services/ZavorthControlService.js';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
} from '../helpers/zavorthControlWebTestUtils.js';

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
        summary: 'Runtime Tools expõe 2 item(ns), com 2 pronto(s) no plano atual.',
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
          summary: 'Le um arquivo do workspace.',
          command: null,
          details: ['1 parametro(s).', '1 obrigatorio(s).'],
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
            summary: 'Le um arquivo do workspace.',
            command: null,
            details: ['1 parametro(s).', '1 obrigatorio(s).'],
            searchText: 'read_file runtime',
          }
        : null,
      featuredIds: ['read_file'],
      query,
      narrative: {
        headline: query
          ? `Tool surface com 1 item(ns) visivel(is) para "${query}".`
          : 'Surface explicita com 9 tool(s).',
        operatorSummary: 'Runtime Tools em foco.',
      },
    },
    narrative: {
      headline: 'Zavorth expõe 4 familias de tools no plano atual.',
      operatorSummary: '3 familia(s) prontas, 1 parcial(is) e 0 planejada(s).',
    },
  };
}

describe('ZavorthControl tool surface endpoint', () => {
  const logRepo = createTestLogRepo();

  it('serves the tool surface with selectedId/query through operations endpoint', async () => {
    const toolSurfaceService = {
      buildSnapshot: jest.fn(({ selectedId, query }: any = {}) => buildToolSurfaceSnapshot(selectedId || 'read_file', query || null)),
    };

    const service = new ZavorthControlService(logRepo, {
      toolSurfaceService: toolSurfaceService as any,
    });

    await service.start();
    const { status, payload } = await fetchZavorthControlJson(
      service.getUrl(),
      '/api/operations/tools?selectedId=read_file&q=read_file',
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
        catalog: expect.objectContaining({
          query: 'read_file',
          selected: expect.objectContaining({
            id: 'read_file',
            familyId: 'runtime',
          }),
        }),
      }),
    );
  });
});
