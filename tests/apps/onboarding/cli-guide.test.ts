import { buildOnboardingGuide } from '../../../apps/onboarding/cli-guide';

describe('buildOnboardingGuide', () => {
  it('teaches the developer flow to stay in core and use desktop/workspace doctor commands', () => {
    const guide = buildOnboardingGuide({
      profile: 'dev',
      baseUrl: 'http://127.0.0.1:33333',
      installSummary: {},
    });

    expect(guide.summary).toContain('core');
    expect(guide.summary).toContain('Telegram');
    expect(guide.steps.join(' ')).toContain('core');
    expect(guide.steps.join(' ')).toContain('/zavorthControl');
    expect(guide.commands).toEqual(expect.arrayContaining([
      'npm run profile:status',
      'npm run ops:doctor:desktop',
      'npm run ops:workspace:doctor',
      'npm run ops:workspace:optimize -- zavorthBridge',
      'npm run channels:install -- --channel telegram --mode native --apply',
    ]));
  });

  it('teaches the operator flow to inspect companions before blaming Zavorth for RAM pressure', () => {
    const guide = buildOnboardingGuide({
      profile: 'operator',
      baseUrl: 'http://127.0.0.1:33333',
      installSummary: {},
    });

    expect(guide.summary).toContain('companions');
    expect(guide.summary).toContain('Telegram');
    expect(guide.commands).toEqual(expect.arrayContaining([
      'npm run ops:doctor:desktop',
      'npm run ops:workspace:doctor',
      'npm run ops:workspace:optimize -- zavorthBridge',
      'npm run channels:install -- --channel telegram --mode native --apply',
    ]));
  });
});
