import {
  buildZavorthControlZavorthControlViewModel,
} from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';

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
      approvalLabel: 'review before changing',
      emptyGreeting: expect.stringContaining('something direct'),
    }));
    expect(developer.profileLanguage).toEqual(expect.objectContaining({
      profile: 'developer',
      approvalLabel: 'Diff and command preview',
      emptyGreeting: expect.stringContaining('diff'),
    }));
    expect(business.profileLanguage).toEqual(expect.objectContaining({
      profile: 'business',
      approvalLabel: 'Review com evidence',
      emptyGreeting: expect.stringContaining('evidence'),
    }));
  });
});
