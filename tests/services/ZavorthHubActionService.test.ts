import { ZavorthHubActionService } from '../../src/services/ZavorthHubActionService.js';

describe('ZavorthHubActionService', () => {
  it('executes platform sync through the canonical Hub action plane', async () => {
    const buildSnapshot = jest.fn((input: any = {}) => ({
      generatedAt: '2026-04-12T20:00:00.000Z',
      query: input?.query || null,
      selectedId: input?.selectedId || null,
      recommendFor: input?.recommendFor || null,
      summary: {
        posture: 'attention',
        recommendedActions: 2,
      },
      sync: {
        status: 'stale',
        summary: 'Cache venceu.',
      },
      actions: [
        {
          id: 'platform-sync',
          label: 'Sincronizar registry remoto',
          surface: 'platform',
          kind: 'sync',
          rationale: 'Cache venceu.',
          command: '/hub run platform-sync',
        },
      ],
      narrative: {
        headline: 'Hub',
        operatorSummary: 'Sync pendente.',
        nextAction: 'Sincronizar registry remoto',
      },
    }));
    const sync = jest.fn(async () => ({
      ok: true,
      status: 'healthy',
      summary: 'Remote registry sincronizado.',
      entryCount: 8,
      collectionCount: 2,
      recipeCount: 3,
      error: null,
    }));
    const service = new ZavorthHubActionService({
      hubControlPlaneService: { buildSnapshot } as any,
      platformCatalogSyncService: { sync } as any,
    });

    const execution = await service.execute({ actionId: 'platform-sync' });

    expect(sync).toHaveBeenCalled();
    expect(execution.ok).toBe(true);
    expect(execution.status).toBe('completed');
    expect(execution.summary).toContain('sincronizado');
  });

  it('opens an integration draft from a Hub action', async () => {
    const buildDraft = jest.fn(() => ({
      manifest: { label: 'Discord' },
      resolution: { note: 'Discord detectado como canal alvo.' },
      selectedMode: 'native',
      enabledCapabilities: ['chat', 'agents'],
      unansweredQuestions: [{ id: 'bot-token' }],
    }));
    const service = new ZavorthHubActionService({
      hubControlPlaneService: {
        buildSnapshot: jest.fn((input: any = {}) => ({
          generatedAt: '2026-04-12T20:10:00.000Z',
          query: input?.query || null,
          selectedId: input?.selectedId || null,
          recommendFor: input?.recommendFor || null,
          summary: {
            posture: 'attention',
            recommendedActions: 1,
          },
          sync: {
            status: 'healthy',
            summary: 'Sync ok.',
          },
          actions: [
            {
              id: 'integration:discord',
              label: 'Close discord',
              surface: 'integrations',
              kind: 'open',
              rationale: 'Ainda falta close token e allowlist.',
              command: '/hub run integration:discord',
            },
          ],
          narrative: {
            headline: 'Hub',
            operatorSummary: 'Discord em preparo.',
            nextAction: 'Responder as perguntas do draft.',
          },
        })),
      } as any,
      integrationHubService: { buildDraft } as any,
    });

    const execution = await service.execute({
      actionId: 'integration:discord',
      requestedBy: 'telegram-user',
    });

    expect(buildDraft).toHaveBeenCalledWith({
      requestedId: 'discord',
      requestedBy: 'telegram-user',
      persist: true,
    });
    expect(execution.ok).toBe(true);
    expect(execution.summary).toContain('Discord');
    expect(execution.details.join(' ')).toContain('pergunta');
  });

  it('keeps skills actions as guided/manual when no direct mutator exists', async () => {
    const service = new ZavorthHubActionService({
      hubControlPlaneService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-12T20:15:00.000Z',
          query: null,
          selectedId: null,
          recommendFor: null,
          summary: {
            posture: 'healthy',
            recommendedActions: 1,
          },
          sync: {
            status: 'healthy',
            summary: 'Sync ok.',
          },
          actions: [
            {
              id: 'skills:skills-library',
              label: 'Abrir biblioteca de skills',
              surface: 'skills',
              kind: 'inspect',
              rationale: 'Ha ready recipes para revisar.',
              command: '/hub run skills:skills-library',
            },
          ],
          narrative: {
            headline: 'Hub',
            operatorSummary: 'Skill plane ready.',
            nextAction: 'Abrir biblioteca.',
          },
        })),
      } as any,
    });

    const execution = await service.execute({ actionId: 'skills:skills-library' });

    expect(execution.ok).toBe(true);
    expect(execution.status).toBe('manual');
    expect(execution.details.join(' ')).toContain('/hub run skills:skills-library');
  });
});
