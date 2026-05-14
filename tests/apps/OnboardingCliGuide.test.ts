import {
  buildOnboardingGuide,
  normalizeOnboardingProfile,
  renderOnboardingGuide,
} from '../../apps/onboarding/cli-guide';

describe('OnboardingCliGuide', () => {
  it('normalizes known profile aliases', () => {
    expect(normalizeOnboardingProfile('developer')).toBe('dev');
    expect(normalizeOnboardingProfile('ops')).toBe('operator');
    expect(normalizeOnboardingProfile('terminal')).toBe('headless');
  });

  it('builds operator guide with pairing flow', () => {
    const guide = buildOnboardingGuide({
      profile: 'operator',
      baseUrl: 'http://127.0.0.1:33333',
    });
    expect(guide.commands.some((command) => command.includes('nodepair'))).toBe(true);
    expect(guide.commands.some((command) => command.includes('companion:start'))).toBe(true);
    expect(guide.nextAction).toBe('npm run ops:ready');
    expect(guide.artifacts.some((artifact) => artifact.includes('companion-start'))).toBe(true);
  });

  it('renders a readable guide body', () => {
    const rendered = renderOnboardingGuide(buildOnboardingGuide({
      profile: 'dev',
      baseUrl: 'http://127.0.0.1:33333',
    }));
    expect(rendered).toContain('Zavorth Developer Guide');
    expect(rendered).toContain('Proximo comando: npm run cli:fast -- status --json');
    expect(rendered).toContain('Artefatos locais');
  });
});
