import {
  buildZavorthControlZavorthControlViewModel,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js';

describe('ZavorthControl profile language projection', () => {
  it('projects profile-specific language so the chat can stay calm without losing precision', () => {
    const personal = buildZavorthControlZavorthControlViewModel({
      identity: { experienceProfile: 'personal' },
    });
    const developer = buildZavorthControlZavorthControlViewModel({
      identity: { experienceProfile: 'developer' },
    });
    const business = buildZavorthControlZavorthControlViewModel({
      identity: { experienceProfile: 'business' },
    });

    expect(personal.profileLanguage).toEqual(expect.objectContaining({
      profile: 'personal',
      approvalLabel: 'Revisar antes de mudar',
      emptyGreeting: expect.stringContaining('pedir algo direto'),
    }));
    expect(developer.profileLanguage).toEqual(expect.objectContaining({
      profile: 'developer',
      approvalLabel: 'Preview de diff e comando',
      emptyGreeting: expect.stringContaining('diff'),
    }));
    expect(business.profileLanguage).toEqual(expect.objectContaining({
      profile: 'business',
      approvalLabel: 'Review com evidence',
      emptyGreeting: expect.stringContaining('evidence'),
    }));
  });
});
