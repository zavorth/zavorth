import {
  buildCliHelpSnapshot,
  formatCliHelp,
  resolveCliHelpTopic,
} from '../../../src/cli/ZavorthCliSurfaceHelpers';

describe('Zavorth premium CLI help', () => {
  test('keeps root help focused on the new natural-first flow', () => {
    const help = formatCliHelp();

    expect(help).toContain('Usage: zavorth [options] [command]');
    expect(help).toContain('Commands:');
    expect(help).toContain('zavorth setup');
    expect(help).toContain('zavorth chat');
    expect(help).toContain('zavorth help advanced');
    expect(help).toContain('zavorth help reference');
    expect(help).toContain('zavorth native catalog');
    expect(help).not.toContain('models *');
    expect(help).not.toContain('channels *');
    expect(help).not.toContain('plugins *');
    expect(help).not.toContain('message *');
    expect(help).not.toContain('sandbox *');
    expect(help).not.toContain('ops run <actionId>');
    expect(help).not.toContain('nodeinvoke');
    expect(help).not.toContain('Comece por aqui');
    expect(help).not.toContain('Trabalho diario');
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

  test('keeps setup help compatible with existing onboarding expectations', () => {
    const setup = formatCliHelp('setup');

    expect(setup).toContain('zavorth setup');
    expect(setup).toContain('Setup Studio');
    expect(setup).toContain('zavorth onboard --dry-run');
    expect(setup).toContain('zavorth ready');
    expect(setup).toContain('zavorth start');
    expect(setup).toContain('zavorth open');
  });

  test('renders parity command namespaces as Zavorth-native help pages', () => {
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
