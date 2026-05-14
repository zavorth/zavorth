import { DashboardService } from '../../src/services/DashboardService';
import {
  createTestLogRepo,
  fetchDashboardJson,
  fetchNoKeepAlive,
} from '../helpers/dashboardWebTestUtils.js';

describe('DashboardService operations report', () => {
  const logRepo = createTestLogRepo();

  it('serves the consolidated report endpoint and references it from the dashboard html', async () => {
    const reportSnapshot = {
      generatedAt: new Date().toISOString(),
      headline: 'Runtime estavel.',
      continuity: {
        suggestedAction: {
          kind: 'review-latest',
          label: 'Revisar abc12345',
          reason: 'A ultima tarefa conhecida veio de telegram.',
        },
        focusTask: {
          shortId: 'abc12345',
          source: 'telegram',
          status: 'completed',
        },
        surfaces: {
          telegram: 2,
          web: 1,
          other: 0,
        },
      },
      executiveSummary: ['Tudo sob controle.'],
      runtime: {
        uptimeLabel: '3h 0m',
        memoryLabel: '256 MB RSS',
        platformLabel: 'win32 / x64',
      },
      operations: {
        sidecarsLabel: '2/2 prontos',
        publishLabel: 'agora',
        storageLabel: '78% livre',
        automationLabel: 'ativa',
      },
      tasks: {
        activeCount: 2,
        completedLast24h: 6,
        failedLast24h: 1,
        waitingApprovalLast24h: 1,
        topExecutors: ['codex:4', 'external_executor:2'],
      },
      pendingPermissions: [],
      alerts: [],
      actions: [
        {
          label: 'Rodar manutencao operacional',
          command: 'npm run ops:maintain',
          reason: 'Fluxo padrao.',
        },
      ],
      text: 'Relatorio consolidado do Zavorth',
    };

    const buildSnapshot = jest.fn().mockResolvedValue(reportSnapshot);
    const service = new DashboardService(logRepo, {
      operationsReportService: {
        buildSnapshot,
      } as any,
    });

    await service.start();
    const baseUrl = service.getUrl();
    const [pageResponse, { status: reportStatus, payload: report }] = await Promise.all([
      fetchNoKeepAlive(`${baseUrl}/classic`),
      fetchDashboardJson(baseUrl, '/api/operations/report'),
    ]);
    const html = await pageResponse.text();
    await service.stopAsync();

    expect(pageResponse.status).toBe(200);
    expect(reportStatus).toBe(200);
    expect(html).toContain('/api/operations/report');
    expect(html).toContain('Carregando relatorio consolidado');
    expect(html).toContain('copyOperationsReport');
    expect(report).toEqual(
      expect.objectContaining({
        headline: 'Runtime estavel.',
        text: 'Relatorio consolidado do Zavorth',
        continuity: expect.objectContaining({
          suggestedAction: expect.objectContaining({
            kind: 'review-latest',
          }),
        }),
      }),
    );
    expect(buildSnapshot).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        readOperationalOverviewSnapshot: expect.any(Function),
        readTrustOverviewSnapshot: expect.any(Function),
        readProductOverviewSnapshot: expect.any(Function),
      }),
    );
  });
});
