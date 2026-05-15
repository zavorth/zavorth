import { ZavorthNaturalRuntimeQuestionsService } from '../../src/services/ZavorthNaturalRuntimeQuestionsService';

describe('ZavorthNaturalRuntimeQuestionsService', () => {
  it('answers provider questions without live execution authority', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService({
      now: () => new Date('2026-05-15T12:00:00.000Z'),
    }).buildSnapshot({ question: 'Which providers are ready?' });

    expect(snapshot.surface).toBe('natural-runtime-questions');
    expect(snapshot.intent).toBe('providers_ready');
    expect(snapshot.runtimeProjection.executionAuthority).toBe(false);
    expect(snapshot.safety.projectionOnly).toBe(true);
    expect(snapshot.safety.noLiveNetworkByDefault).toBe(true);
    expect(snapshot.answer.cards).toHaveLength(1);
    expect(snapshot.answer.cards[0]?.id).toBe('providers');
  });

  it('routes approval questions to the Satellite approval projection', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: 'Do I have pending approvals?',
    });

    expect(snapshot.intent).toBe('approvals_pending');
    expect(snapshot.answer.cards[0]?.id).toBe('approvals');
    expect(snapshot.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'approvals',
        surface: 'satellite-approval-companion',
        route: '/satellite',
        executionAuthority: false,
      }),
    ]));
  });

  it('keeps unknown questions helpful and redacts secrets', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: 'sk-secretshouldnotleak123456789 what can you explain?',
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.intent).toBe('unknown');
    expect(snapshot.confidence).toBe('low');
    expect(snapshot.answer.askableFollowups.length).toBeGreaterThan(2);
    expect(serialized).not.toContain('sk-secretshouldnotleak');
    expect(serialized).toContain('[REDACTED_SECRET]');
  });
});
