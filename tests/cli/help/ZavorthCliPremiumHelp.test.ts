import {
  buildCliHelpSnapshot,
  formatCliHelp,
  resolveCliHelpTopic,
} from '../../../src/cli/ZavorthCliSurfaceHelpers';

describe('Zavorth premium CLI help', () => {
  test('keeps root help on four intents (phase 2–3)', () => {
    const help = formatCliHelp();

    expect(help).toContain('Usage: zavorth [options] [command]');
    expect(help).toContain('Commands:');
    expect(help).toContain('zavorth ask');
    expect(help).toContain('zavorth connect');
    expect(help).toContain('zavorth learn');
    expect(help).toContain('zavorth ready');
    expect(help).toContain('zavorth setup');
    expect(help).toContain('zavorth help advanced');
    expect(help).toMatch(/Four intents|ask · connect · learn · ready/i);
    // Platform clutter stays out of root
    expect(help).not.toContain('nodeinvoke');
    expect(help).not.toContain('ops run <actionId>');
    expect(help).not.toContain('models *');
    expect(help).not.toContain('plugins *');
    expect(help).not.toContain('sandbox *');
    expect(help).not.toContain('Comece por aqui');
    expect(help).not.toContain('Trabalho diario');
    expect(help).toContain('zavorth reach|where');
  });

  test('advanced help is the door to operator surface', () => {
    const advanced = formatCliHelp('advanced');
    expect(advanced).toMatch(/advanced|operator|platform/i);
    expect(advanced).toContain('zavorth help');
    expect(advanced).toMatch(/connect|learn|ops/i);
  });

  test('resolves and renders dedicated home, hatch and quickstart pages', () => {
    expect(resolveCliHelpTopic('home')).toBe('home');
    expect(resolveCliHelpTopic('hatch')).toBe('hatch');
    expect(resolveCliHelpTopic('quickstart')).toBe('quickstart');
    expect(resolveCliHelpTopic('configure')).toBe('quickstart');

    const home = buildCliHelpSnapshot('home');
    const hatch = formatCliHelp('hatch');
    const quickstart = formatCliHelp('quickstart');

    expect(home.topic).toBe('home');
    expect(home.title).toBe('zavorth');
    expect(hatch).toContain('zavorth hatch --start');
    expect(hatch).toContain('Hatch does not apply host mutations');
    expect(quickstart).toContain('zavorth providers add --provider openai --model gpt-4.1');
    expect(quickstart).toContain('zavorth channels telegram --allowed-users <id> --apply');
    expect(quickstart).toContain('preview-first');
  });

  test('keeps setup help compatible with First Light onboarding expectations', () => {
    const setup = formatCliHelp('setup');

    expect(setup).toContain('zavorth setup');
    expect(setup).toContain('First Light');
    expect(setup).toContain('zavorth onboard --dry-run');
    expect(setup).toContain('zavorth ready');
    expect(setup).toContain('zavorth start');
    expect(setup).toContain('zavorth open');
  });

  test('renders consistency command namespaces as Zavorth-native help pages', () => {
    const plugins = formatCliHelp('plugins');
    const message = formatCliHelp('message');
    const backup = formatCliHelp('backup');

    expect(plugins).toContain('Usage: zavorth plugins [command]');
    expect(plugins).toContain('Zavorth-native namespace prepared');
    expect(message).toContain('Usage: zavorth message [command]');
    expect(message).toContain('zavorth message send');
    expect(backup).toContain('Usage: zavorth backup [command]');
    expect(backup).toContain('backup and verification flows');
  });
});
