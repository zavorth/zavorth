import { ZavorthAgentPracticalityCompletionService } from '../../../src/services/ZavorthAgentPracticalityCompletionService.js';

describe('ZavorthAgentPracticalityCompletionService Runtime gateway', () => {
  it('certifies channel-neutral agent practicality without visual mutation', async () => {
    const snapshot = await new ZavorthAgentPracticalityCompletionService({
      now: () => new Date('2026-05-11T10:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.status).toBe('passed');
    expect(snapshot.runtimeSurface.commands).toEqual(expect.arrayContaining([
      '/agents status',
      '/agents spawn <task>',
      '/agents read latest',
      '/agents summarize latest',
      '/agents cancel latest',
    ]));
    expect(snapshot.surfaceProjections.map((surface) => surface.surface)).toEqual(expect.arrayContaining([
      'cli',
      'web',
      'telegram',
      'discord',
      'whatsapp',
      'signal',
      'imessage',
    ]));
    expect(snapshot.surfaceProjections.every((surface) => surface.fallbackTextAvailable)).toBe(true);
    expect(snapshot.zavorthControlProjection).toEqual(expect.objectContaining({
      available: true,
      timelineRequired: true,
      receiptsRequired: true,
      noVisualMutation: true,
    }));
    expect(snapshot.zavorthControlProjection.operationalFieldsRequired).toEqual(expect.arrayContaining([
      'operational.selectedSessionId',
      'actions',
      'timeline',
      'receipts',
    ]));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noWorkspaceMutation: true,
      noExternalIo: true,
      noRawSecretsSerialized: true,
      visualChangesRequireOwnerApproval: true,
    }));
    expect(snapshot.nextArchitectureSuggestion.shouldSuggestAfterStage6).toBe(true);
  });
});
