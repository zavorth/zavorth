import { WebAppGatewayControlService } from '../../src/domain/surface/presentation/web-app/WebAppGatewayControlService.js';
import type { WebAppRuntimeRouteDeps } from '../../src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.js';

describe('WebAppGatewayControlService', () => {
  it('returns a safe fallback when hybrid memory preview is unavailable', async () => {
    const service = new WebAppGatewayControlService();
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        webUserId: 'telegram-admin',
      } as any,
      realtime: {
        getChatId: jest.fn(() => 'web:session-web-1'),
      } as any,
      hybridMemory: null,
    } as any;

    const result = await service.previewGatewayMemoryRecall(
      {
        sessionId: 'session-web-1',
        query: 'como ficou a ultima task?',
      },
      deps,
    );

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      sessionId: 'session-web-1',
      query: 'como ficou a ultima task?',
      warnings: expect.arrayContaining([
        'Hybrid Memory Service indisponivel neste runtime.',
      ]),
    }));
  });

  it('passes memory source listing through the hybrid memory service with canonical web defaults', async () => {
    const service = new WebAppGatewayControlService();
    const listSources = jest.fn(async () => ({
      ok: true,
      contractVersion: 'hybrid-memory-v1',
      generatedAt: '2026-04-16T12:00:00.000Z',
      sessionId: 'session-web-1',
      sources: [{ id: 'ledger-1', label: 'Ledger', summary: 'ok' }],
      warnings: [],
    }));
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        webUserId: 'telegram-admin',
      } as any,
      realtime: {
        getChatId: jest.fn(() => 'web:session-web-1'),
      } as any,
      hybridMemory: {
        listSources,
      } as any,
    } as any;

    const result = await service.listGatewayMemorySources(
      {
        sessionId: 'session-web-1',
      },
      deps,
    );

    expect(listSources).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-web-1',
      chatId: 'web:session-web-1',
      userId: 'telegram-admin',
      platform: 'web',
      workspaceHint: null,
    }));
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      sessionId: 'session-web-1',
      sources: expect.arrayContaining([
        expect.objectContaining({ id: 'ledger-1' }),
      ]),
    }));
  });

  it('does not expose tool-run artifacts when the backend artifact policy blocks them', async () => {
    const service = new WebAppGatewayControlService();
    const deps: WebAppRuntimeRouteDeps = {
      runtime: {
        webUserId: 'telegram-admin',
      } as any,
      realtime: {
        getResolvedSnapshot: jest.fn(async () => ({
          toolRuns: [
            {
              runId: 'tool-run-chat',
              summary: 'Conversa simples.',
              artifacts: [{ id: 'artifact-chat', title: 'Nao deveria aparecer' }],
              filesTouched: ['chat.md'],
              metadata: {
                artifactPolicy: {
                  shouldCreateArtifact: false,
                  shouldShowArtifactInChat: false,
                  reason: 'conversation-response-does-not-create-artifact',
                },
              },
            },
            {
              runId: 'tool-run-report',
              summary: 'Relatorio real.',
              artifacts: [{ id: 'artifact-report', title: 'Relatorio real' }],
              filesTouched: ['report.pdf'],
              metadata: {
                artifactPolicy: {
                  shouldCreateArtifact: true,
                  shouldShowArtifactInChat: true,
                  reason: 'deliverable-artifact-requested',
                },
              },
            },
          ],
        })),
      } as any,
    } as any;

    const result = await service.listGatewayArtifacts('session-web-1', deps);

    expect(result.artifacts).toEqual([
      expect.objectContaining({ id: 'artifact-report' }),
    ]);
    expect(result.filesTouched).toEqual(['report.pdf']);
  });
});

