import { resolveZavorthSimpleCommand } from '../../src/cli/SimpleCommandRouter.js';

describe('SimpleCommandRouter', () => {
  it('keeps core aliases', () => {
    expect(resolveZavorthSimpleCommand(['chat'])).toEqual({
      kind: 'passthrough',
      args: ['chat'],
    });
    expect(resolveZavorthSimpleCommand(['providers', 'list'])).toEqual({
      kind: 'passthrough',
      args: ['providers', 'list'],
    });
  });

  it('maps health/status typos to ready (health intent health intent)', () => {
    expect(resolveZavorthSimpleCommand(['stats', '--json'])).toEqual({
      kind: 'passthrough',
      args: ['ready', '--json'],
    });
    expect(resolveZavorthSimpleCommand(['health'])).toEqual({
      kind: 'passthrough',
      args: ['ready'],
    });
  });

  it('maps EN talk/run/where intents (no multi-language CLI synonym packs)', () => {
    expect(resolveZavorthSimpleCommand(['run', 'review this'])).toEqual({
      kind: 'passthrough',
      args: ['ask', 'review this'],
    });
    expect(resolveZavorthSimpleCommand(['where'])).toEqual({
      kind: 'passthrough',
      args: ['reach'],
    });
    expect(resolveZavorthSimpleCommand(['reach-fabric', 'status'])).toEqual({
      kind: 'passthrough',
      args: ['reach', 'status'],
    });
    // Non-English first tokens are not rewritten (use EN commands or free text → agent).
    expect(resolveZavorthSimpleCommand(['conectar', 'telegram'])).toEqual({
      kind: 'passthrough',
      args: ['conectar', 'telegram'],
    });
    expect(resolveZavorthSimpleCommand(['aprender'])).toEqual({
      kind: 'passthrough',
      args: ['aprender'],
    });
  });

  it('fixes common typos', () => {
    expect(resolveZavorthSimpleCommand(['setu'])).toEqual({
      kind: 'passthrough',
      args: ['setup'],
    });
    expect(resolveZavorthSimpleCommand(['opne'])).toEqual({
      kind: 'passthrough',
      args: ['open'],
    });
    expect(resolveZavorthSimpleCommand(['channels', 'catalog'])).toEqual({
      kind: 'passthrough',
      args: ['channels', 'catalog'],
    });
  });

  it('resolves safe test suites', () => {
    const plan = resolveZavorthSimpleCommand(['test', 'setup']);
    expect(plan.kind).toBe('npm-script');
    if (plan.kind === 'npm-script') {
      expect(plan.scripts.length).toBeGreaterThan(0);
    }
  });

  it('does not map qa to a daily alias (may naturalize to status subpath)', () => {
    const plan = resolveZavorthSimpleCommand(['qa']);
    expect(plan.kind).toBe('passthrough');
    if (plan.kind === 'passthrough') {
      expect(plan.args[0]).toBe('qa');
    }
  });
});
