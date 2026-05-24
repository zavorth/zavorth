import {
  renderZavorthQaGuide,
  resolveZavorthSimpleCommand,
} from '../../src/cli/SimpleCommandRouter.js';

describe('SimpleCommandRouter', () => {
  it('maps friendly aliases without removing advanced commands', () => {
    expect(resolveZavorthSimpleCommand(['chat'])).toEqual({
      kind: 'passthrough',
      args: ['hatch'],
    });
    expect(resolveZavorthSimpleCommand(['status', '--json'])).toEqual({
      kind: 'passthrough',
      args: ['ready', '--json'],
    });
    expect(resolveZavorthSimpleCommand(['providers', 'list'])).toEqual({
      kind: 'passthrough',
      args: ['providers', 'list'],
    });
  });

  it('maps common typos to the intended friendly command instead of falling into natural routing', () => {
    expect(resolveZavorthSimpleCommand(['setu'])).toEqual({
      kind: 'passthrough',
      args: ['setup'],
    });
    expect(resolveZavorthSimpleCommand(['opne'])).toEqual({
      kind: 'passthrough',
      args: ['open'],
    });
    expect(resolveZavorthSimpleCommand(['channles', 'catalog'])).toEqual({
      kind: 'passthrough',
      args: ['channels', 'catalog'],
    });
  });

  it('exposes memorable test suites', () => {
    const plan = resolveZavorthSimpleCommand(['test', 'setup']);

    expect(plan.kind).toBe('npm-script');
    if (plan.kind === 'npm-script') {
      expect(plan.scripts).toEqual([
        'zavorth:setup-studio-command:check',
        'zavorth:setup-studio-premium:check',
      ]);
    }
  });

  it('renders a concise QA guide', () => {
    const guide = renderZavorthQaGuide('daily');

    expect(guide).toContain('Zavorth QA Guide');
    expect(guide).toContain('zavorth ready');
    expect(guide).toContain('zavorth test runtime');
  });
});
