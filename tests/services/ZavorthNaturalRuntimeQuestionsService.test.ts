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

  it('does not misroute channel readiness questions to providers', () => {
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: 'Which channels are ready?',
    });

    expect(snapshot.intent).toBe('channels_ready');
    expect(snapshot.answer.cards).toHaveLength(1);
    expect(snapshot.answer.cards[0]?.id).toBe('channels');
  });

  it('keeps unknown questions helpful and redacts secrets', () => {
    const googleToken = ['AI', 'za', '123456789012345678901234567890'].join('');
    const snapshot = new ZavorthNaturalRuntimeQuestionsService().buildSnapshot({
      question: `sk-secretshouldnotleak123456789 ${googleToken} Bearer abc.def.ghi what can you explain?`,
    });
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.intent).toBe('unknown');
    expect(snapshot.confidence).toBe('low');
    expect(snapshot.answer.askableFollowups.length).toBeGreaterThan(2);
    expect(serialized).not.toContain('sk-secretshouldnotleak');
    expect(serialized).not.toContain(googleToken);
    expect(serialized).not.toContain('abc.def.ghi');
    expect(serialized).toContain('[REDACTED_SECRET]');
  });
});
