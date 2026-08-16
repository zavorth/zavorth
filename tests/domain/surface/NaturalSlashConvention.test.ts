import {
  naturalizeSharedSurfaceArgs,
  getNaturalSlashPolicy,
  registerNaturalSlashPolicy,
  DEFAULT_NATURAL_SLASH_POLICY,
  formatNaturalSlashConventionHelp,
} from '../../../src/domain/surface/presentation/shared-surface/NaturalSlashConvention.js';

describe('NaturalSlashConvention (all commands)', () => {
  it('empty args become home/status when policy defines emptyRewrite', () => {
    expect(naturalizeSharedSurfaceArgs('/model', '').args).toBe('status');
    expect(naturalizeSharedSurfaceArgs('/memory', '').args).toBe('status');
    expect(naturalizeSharedSurfaceArgs('/watchmode', '').args).toBe('status');
  });

  it('free text becomes primary without requiring run', () => {
    expect(naturalizeSharedSurfaceArgs('/hub', 'platform-sync').args).toBe('run platform-sync');
    expect(naturalizeSharedSurfaceArgs('/hub', 'melhor plugin para llm').args).toBe(
      'recommend melhor plugin para llm',
    );
    expect(naturalizeSharedSurfaceArgs('/skills', 'automate releases').args).toBe(
      'recommend automate releases',
    );
    expect(naturalizeSharedSurfaceArgs('/memory', 'gateway release').args).toBe(
      'search gateway release',
    );
    expect(naturalizeSharedSurfaceArgs('/plugins', 'openrouter').args).toBe('search openrouter');
  });

  it('preserves explicit control verbs and multi-word controls', () => {
    expect(naturalizeSharedSurfaceArgs('/hub', 'run platform-sync').rewritten).toBe(false);
    expect(naturalizeSharedSurfaceArgs('/hub', 'status').rewritten).toBe(false);
    expect(naturalizeSharedSurfaceArgs('/watchmode', 'allow-app Chrome').rewritten).toBe(false);
    expect(naturalizeSharedSurfaceArgs('/learn-skill', 'apply ./pack --consent').rewritten).toBe(false);
    expect(naturalizeSharedSurfaceArgs('/codexremote', 'sessions').rewritten).toBe(false);
    expect(naturalizeSharedSurfaceArgs('/codexremote', 'profiles').rewritten).toBe(false);
    expect(naturalizeSharedSurfaceArgs('/codexremote', 'approvals').rewritten).toBe(false);
  });

  it('sessionsend free text inserts -- separator', () => {
    expect(naturalizeSharedSurfaceArgs('/sessionsend', 'web:demo continue o plano').args).toBe(
      'web:demo -- continue o plano',
    );
    expect(naturalizeSharedSurfaceArgs('/sessionsend', 'web:demo -- already').args).toBe(
      'web:demo -- already',
    );
  });

  it('codexremote free prompt becomes start --', () => {
    expect(naturalizeSharedSurfaceArgs('/codexremote', 'fix the flaky test').args).toBe(
      'start -- fix the flaky test',
    );
  });

  it('watchmode free text maps to allow-app / allow-site', () => {
    expect(naturalizeSharedSurfaceArgs('/watchmode', 'Chrome').args).toBe('allow-app Chrome');
    expect(naturalizeSharedSurfaceArgs('/watchmode', 'github.com').args).toBe('allow-site github.com');
    expect(naturalizeSharedSurfaceArgs('/watchmode', 'allow app Slack').args).toBe('allow-app Slack');
    expect(naturalizeSharedSurfaceArgs('/watchmode', 'allow site example.com').args).toBe(
      'allow-site example.com',
    );
  });

  it('workspace bare preset becomes optimize', () => {
    expect(naturalizeSharedSurfaceArgs('/workspace', 'zavorthBridge').args).toBe(
      'optimize zavorthBridge',
    );
    expect(naturalizeSharedSurfaceArgs('/workspace', 'vscode apply plan-1').args).toBe(
      'optimize vscode apply plan-1',
    );
  });

  it('enable/disable and workspace free text stay as primary payload', () => {
    expect(naturalizeSharedSurfaceArgs('/enable', 'sandbox once').args).toBe('sandbox once');
    expect(naturalizeSharedSurfaceArgs('/disable', 'sandbox').args).toBe('sandbox');
    // Bare preset becomes optimize <preset> so pack primary path is free-text friendly
    expect(naturalizeSharedSurfaceArgs('/workspace', 'zavorthBridge').args).toBe(
      'optimize zavorthBridge',
    );
    expect(naturalizeSharedSurfaceArgs('/workspace', 'C:/workspace/demo').args).toBe(
      'C:/workspace/demo',
    );
    expect(naturalizeSharedSurfaceArgs('/schedule', 'every 1h /status').args).toBe('every 1h /status');
    expect(naturalizeSharedSurfaceArgs('/report', 'ultimas noticias de IA').args).toBe(
      'ultimas noticias de IA',
    );
    expect(naturalizeSharedSurfaceArgs('/schedule', '').args).toBe('status');
    expect(naturalizeSharedSurfaceArgs('/report', '').args).toBe('status');
    expect(naturalizeSharedSurfaceArgs('/workspace', '').args).toBe('doctor');
  });

  it('unknown future commands still get a safe default policy', () => {
    const policy = getNaturalSlashPolicy('/brand-new-future-command');
    expect(policy).toEqual(DEFAULT_NATURAL_SLASH_POLICY);
    const result = naturalizeSharedSurfaceArgs('/brand-new-future-command', 'do the thing');
    expect(result.args).toBe('do the thing');
    expect(result.reason).toMatch(/passthrough|primary/);
  });

  it('registerNaturalSlashPolicy overrides for plugins/tests', () => {
    registerNaturalSlashPolicy('/custom-test-cmd', {
      emptyRewrite: 'status',
      controlVerbs: ['status', 'run'],
      freeText: { kind: 'prefix', verb: 'run' },
    });
    expect(naturalizeSharedSurfaceArgs('/custom-test-cmd', '').args).toBe('status');
    expect(naturalizeSharedSurfaceArgs('/custom-test-cmd', 'hello').args).toBe('run hello');
  });

  it('documents the convention for users', () => {
    const help = formatNaturalSlashConventionHelp();
    expect(help).toMatch(/plain language/i);
    expect(help).not.toMatch(/must type run/i);
  });
});
