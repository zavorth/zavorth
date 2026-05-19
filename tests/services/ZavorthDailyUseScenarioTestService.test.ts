import { ZavorthDailyUseScenarioTestService } from '../../src/services/ZavorthDailyUseScenarioTestService.js';

describe('ZavorthDailyUseScenarioTestService', () => {
  it('simulates the five daily-use scenarios without hidden execution', async () => {
    const service = new ZavorthDailyUseScenarioTestService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
      providerCatalog: {
        buildSnapshot: async () => ({
          summary: {
            providerRoutes: 71,
            liveReadyRoutes: 6,
            defaultRouteAllowed: 2,
          },
          nextAction: 'Provider ready.',
        }),
      } as any,
      skillCurator: {
        buildSnapshot: () => ({
          summary: {
            metadataRepairs: 0,
            destructiveProposals: 12,
          },
          apply: {
            safeMetadataApplyRequested: false,
            receiptPath: 'data/skill-curator/skill-curator-receipt.json',
          },
          evolution: {
            receiptBacked: false,
          },
          safety: {
            noSilentMerge: true,
          },
        }),
      } as any,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-daily-use-scenario-test/1');
    expect(snapshot.summary.scenarios).toBe(5);
    expect(snapshot.summary.failed).toBe(0);
    expect(snapshot.scenarios.map((scenario) => scenario.id)).toEqual([
      'faculdade-documentos',
      'provider-llm',
      'skill-curator',
      'telegram-remoto',
      'agent-review-swarm',
    ]);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      simulationOnly: true,
      noLiveProviderProbeByDefault: true,
      noTelegramMessageSent: true,
      noExternalAgentStarted: true,
      noSkillMergeApplied: true,
    }));
    expect(snapshot.scenarios.every((scenario) => scenario.safety.hiddenExecution === false)).toBe(true);
    expect(snapshot.scenarios.every((scenario) => scenario.safety.rawSecretsSerialized === false)).toBe(true);
    expect(snapshot.scenarios.every((scenario) => scenario.nextAction.length > 0)).toBe(true);
  });

  it('reports confusion signals as attention instead of pretending the UX is perfect', async () => {
    const service = new ZavorthDailyUseScenarioTestService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
      providerCatalog: {
        buildSnapshot: async () => ({
          summary: {
            providerRoutes: 71,
            liveReadyRoutes: 0,
            defaultRouteAllowed: 0,
          },
          nextAction: 'Configure provider credentials.',
        }),
      } as any,
      skillCurator: {
        buildSnapshot: () => ({
          summary: {
            metadataRepairs: 2,
            destructiveProposals: 1,
          },
          apply: {
            safeMetadataApplyRequested: false,
            receiptPath: 'data/skill-curator/skill-curator-receipt.json',
          },
          evolution: {
            receiptBacked: false,
          },
          safety: {
            noSilentMerge: true,
          },
        }),
      } as any,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.findings.length).toBeGreaterThan(0);
    expect(snapshot.scenarios.find((scenario) => scenario.id === 'provider-llm')?.confusionSignals).toContain('Nenhum provider liberado como rota default.');
    expect(snapshot.scenarios.find((scenario) => scenario.id === 'skill-curator')?.confusionSignals.some((signal) => signal.includes('reparos de metadata'))).toBe(true);
  });
});
