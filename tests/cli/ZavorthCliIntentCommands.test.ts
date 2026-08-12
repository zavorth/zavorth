import {
  formatConnectHelp,
  resolveConnectIntent,
  resolveLearnIntent,
} from '../../src/cli/ZavorthCliIntentCommands.js';

describe('ZavorthCliIntentCommands', () => {
  it('routes connect to channels, providers, connectors', () => {
    expect(resolveConnectIntent([])).toEqual({ kind: 'help-connect' });
    expect(resolveConnectIntent(['help'])).toEqual({ kind: 'help-connect' });
    expect(resolveConnectIntent(['telegram', '--apply'])).toEqual({
      kind: 'channels',
      args: ['telegram', '--apply'],
    });
    expect(resolveConnectIntent(['providers', 'list'])).toEqual({
      kind: 'providers',
      args: ['list'],
    });
    expect(resolveConnectIntent(['status'])).toEqual({
      kind: 'connectors',
      args: ['status'],
    });
    expect(resolveConnectIntent(['channel', 'list'])).toEqual({
      kind: 'channels',
      args: ['list'],
    });
  });

  it('routes bare learn to anyone digest', () => {
    expect(resolveLearnIntent('learn', [])).toEqual({ kind: 'anyone', args: ['digest'] });
    expect(resolveLearnIntent('learn', ['undo', 'pref-1'])).toEqual({
      kind: 'anyone',
      args: ['undo', 'pref-1'],
    });
    expect(resolveLearnIntent('learn', ['skill', 'x'])).toEqual({ kind: 'passthrough' });
    expect(resolveLearnIntent('learn', ['loop'])).toEqual({ kind: 'passthrough' });
    expect(resolveLearnIntent('mnemos-learning', [])).toEqual({ kind: 'passthrough' });
  });

  it('documents connect help with four-intent language', () => {
    const help = formatConnectHelp();
    expect(help).toContain('zavorth connect');
    expect(help).toContain('telegram');
    expect(help).toContain('providers');
    expect(help).toContain('zavorth help');
  });
});
