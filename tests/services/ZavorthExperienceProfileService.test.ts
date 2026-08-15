import { ZavorthExperienceProfileService } from '../../src/services/ZavorthExperienceProfileService';

describe('ZavorthExperienceProfileService', () => {
  const service = new ZavorthExperienceProfileService();

  it('exposes the five experience profiles without changing authority', () => {
    const contract = service.buildContract();

    expect(contract.profiles.map((profile) => profile.id)).toEqual([
      'personal',
      'creator',
      'developer',
      'business',
      'power',
    ]);
    expect(contract.invariants.join(' ')).toContain('not execution authority');
    expect(contract.invariants.join(' ')).toContain('Policy Broker');
  });

  it('keeps Personal/Governed as the security posture beneath experience profiles', () => {
    const developer = service.buildContract({ profile: 'developer' });
    const business = service.buildContract({ profile: 'business' });

    expect(developer.selected).toMatchObject({
      profileId: 'developer',
      dailyMode: 'personal',
      detailMode: 'advanced',
      autonomy: 'advanced',
      explanation: 'technical',
    });
    expect(business.selected).toMatchObject({
      profileId: 'business',
      dailyMode: 'governed',
      detailMode: 'advanced',
      autonomy: 'business',
      explanation: 'audit',
    });
  });

  it('falls back to personal when intent is provided without explicit profile (LLM resolves intent upstream)', () => {
    const intents = [
      'quero algo simples para meu dia a dia',
      'I am doing vibe coding in this repo',
      'quero modo empresa com auditoria e compliance',
      'I need scripts, posts and content research',
    ];
    for (const intent of intents) {
      const contract = service.buildContract({ intent });
      expect(contract.selected.profileId).toBe('personal');
      expect(contract.resolution.confidence).toBe('fallback');
      expect(contract.resolution.reason).toMatch(/LLM agent/i);
    }
  });

  it('allows explicit profile and detail overrides', () => {
    const contract = service.buildContract({
      profile: 'personal',
      dailyMode: 'governed',
      detailMode: 'advanced',
    });

    expect(contract.resolution.confidence).toBe('explicit');
    expect(contract.selected).toMatchObject({
      profileId: 'personal',
      dailyMode: 'governed',
      detailMode: 'advanced',
    });
  });

  it('falls back safely to personal when the intent is unclear', () => {
    const contract = service.buildContract({ intent: 'hello there' });

    expect(contract.selected.profileId).toBe('personal');
    expect(contract.resolution.confidence).toBe('fallback');
  });
});
