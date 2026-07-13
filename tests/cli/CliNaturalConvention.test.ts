import {
  naturalizeCliArgv,
  naturalizeCliSurfaceText,
  mapCliCommandToSlash,
  isNaturalCliCommand,
  formatCliNaturalConventionHelp,
} from '../../src/cli/CliNaturalConvention.js';

describe('CliNaturalConvention (aligned with slash)', () => {
  it('maps CLI names to slash types', () => {
    expect(mapCliCommandToSlash('hub')).toBe('/hub');
    expect(mapCliCommandToSlash('consensus')).toBe('/consensus');
    expect(mapCliCommandToSlash('skills')).toBe('/skills');
    expect(mapCliCommandToSlash('learn-skill')).toBe('/learn-skill');
    expect(isNaturalCliCommand('memory')).toBe(true);
  });

  it('naturalizes CLI argv free text like slash', () => {
    expect(naturalizeCliArgv(['hub', 'platform-sync']).argv).toEqual([
      'hub',
      'run',
      'platform-sync',
    ]);
    expect(naturalizeCliArgv(['skills', 'automate', 'releases']).argv.slice(0, 2)).toEqual([
      'skills',
      'recommend',
    ]);
    expect(naturalizeCliArgv(['memory', 'gateway', 'release']).argv[1]).toBe('search');
    // CLI model empty stays empty (help), unlike slash /model → status
    expect(naturalizeCliArgv(['model']).argv).toEqual(['model']);
  });

  it('preserves flags after naturalization', () => {
    const result = naturalizeCliArgv([
      'hub',
      'platform-sync',
      '--json',
    ]);
    expect(result.argv).toContain('--json');
    expect(result.argv).toContain('run');
    expect(result.argv).toContain('platform-sync');
  });

  it('preserves explicit control verbs', () => {
    expect(naturalizeCliArgv(['hub', 'status']).rewritten).toBe(false);
    expect(naturalizeCliArgv(['hub', 'run', 'platform-sync']).rewritten).toBe(false);
  });

  it('naturalizes surface text lines', () => {
    expect(naturalizeCliSurfaceText('/hub platform-sync').text).toBe('/hub run platform-sync');
    expect(naturalizeCliSurfaceText('skills automate releases').text).toMatch(
      /^\/skills recommend automate releases$/,
    );
  });

  it('documents CLI + chat parity', () => {
    const help = formatCliNaturalConventionHelp();
    expect(help).toMatch(/zavorth <command>/);
    expect(help).toMatch(/NaturalSlashConvention/);
  });
});
