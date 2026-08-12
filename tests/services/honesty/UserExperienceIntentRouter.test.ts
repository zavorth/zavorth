import { UserExperienceIntentRouter } from '../../../src/services/UserExperienceIntentRouter.js';

describe('UserExperienceIntentRouter (no free-text feature keywords)', () => {
  const router = new UserExperienceIntentRouter();

  it('does not keyword-route free-text phrases into product features', () => {
    const phrases = [
      'resuma o estado atual e o link do PR',
      'compile uma equipe de agentes swarm',
      'promote this skill and forget the draft',
      'run the release checklist step by step',
      'what did we discuss about providers?',
    ];
    for (const text of phrases) {
      const d = router.decide({ text });
      expect(d.kind).toBe('answer');
      expect(d.confidence).toBe('low');
      expect(d.shouldUseTools).toBe(false);
      expect(d.explicitAction).toBe(false);
      expect(d.signals).toContain('free-text-model-owned');
      expect(d.reason).toMatch(/model-owned|keyword/i);
    }
  });

  it('honors structured explicitExecution without scanning free text', () => {
    const d = router.decide({
      text: 'anything here is ignored for feature routing',
      explicitExecution: true,
    });
    expect(d.kind).toBe('execute');
    expect(d.confidence).toBe('high');
    expect(d.shouldUseTools).toBe(true);
    expect(d.explicitAction).toBe(true);
    expect(d.signals).toContain('explicit-execution');
  });

  it('honors attachments as structural preview signal', () => {
    const d = router.decide({
      text: 'look at this',
      hasAttachments: true,
    });
    expect(d.kind).toBe('preview');
    expect(d.confidence).toBe('high');
    expect(d.signals).toContain('attachment');
  });

  it('empty input stays light conversation', () => {
    const d = router.decide({ text: '   ' });
    expect(d.kind).toBe('chat');
    expect(d.confidence).toBe('high');
    expect(d.shouldUseTools).toBe(false);
  });
});
