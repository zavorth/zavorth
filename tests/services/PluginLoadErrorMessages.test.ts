import {
  humanizePluginLoadFailure,
  withHumanizedPluginLoadFindings,
} from '../../src/services/PluginLoadErrorMessages.js';
import {
  formatPluginLoadTip,
  resolvePluginLoadLocale,
} from '../../src/services/plugin-i18n/PluginLoadTipsI18n.js';

describe('PluginLoadErrorMessages', () => {
  it('maps technical findings to actionable tips', () => {
    const tips = humanizePluginLoadFailure([
      'entrypoint export not found (tried: register, default)',
      'no capability handlers registered',
      'bindCapability rejected undeclared capability: extra.ping',
      'sandbox requires approval before enable',
      'plugin is not load eligible',
      'entrypoint module not found: /tmp/x/index.js',
      'manifest declares no capabilities',
      'missing handlers for capabilities: main.run',
    ], { pluginId: 'demo-plugin', locale: 'en' });

    expect(tips.some((tip) => /Export `register`/i.test(tip))).toBe(true);
    expect(tips.some((tip) => /bindCapability/i.test(tip))).toBe(true);
    expect(tips.some((tip) => /extra\.ping|manifest\.json/i.test(tip))).toBe(true);
    expect(tips.some((tip) => /plugins enable demo-plugin/i.test(tip))).toBe(true);
    expect(tips.some((tip) => /entrypoint\.module/i.test(tip))).toBe(true);
    expect(tips.some((tip) => /at least one capability/i.test(tip))).toBe(true);
  });

  it('appends tip: prefixes without removing technical findings', () => {
    const merged = withHumanizedPluginLoadFindings(
      ['entrypoint export not found (tried: register)'],
      { pluginId: 'x', locale: 'en' },
    );
    expect(merged[0]).toMatch(/entrypoint export not found/i);
    expect(merged.some((item) => item.startsWith('tip:'))).toBe(true);
  });

  it('returns empty tips for unknown findings', () => {
    expect(humanizePluginLoadFailure(['totally unknown finding'])).toEqual([]);
  });

  it('returns non-English tips for several locales', () => {
    const findings = ['entrypoint export not found (tried: register)'];
    const pt = humanizePluginLoadFailure(findings, { locale: 'pt' });
    const es = humanizePluginLoadFailure(findings, { locale: 'es' });
    const ja = humanizePluginLoadFailure(findings, { locale: 'ja' });
    const zh = humanizePluginLoadFailure(findings, { locale: 'zh' });

    expect(pt[0]).not.toEqual(humanizePluginLoadFailure(findings, { locale: 'en' })[0]);
    expect(pt[0]).toMatch(/Exporte|export/i);
    expect(es[0]).toMatch(/Exporte/i);
    expect(ja[0]).toMatch(/エクスポート|register/);
    expect(zh[0]).toMatch(/导出|register/);
  });

  it('falls back to en for unknown locale', () => {
    const tips = humanizePluginLoadFailure(
      ['no capability handlers registered'],
      { locale: 'xx-unknown' },
    );
    expect(tips[0]).toMatch(/bindCapability/i);
    expect(resolvePluginLoadLocale('xx-unknown')).toBe('en');
  });

  it('supports pt and pt-BR locale matching', () => {
    const findings = ['sandbox requires approval before enable'];
    const pt = humanizePluginLoadFailure(findings, { pluginId: 'demo', locale: 'pt' });
    const ptBR = humanizePluginLoadFailure(findings, { pluginId: 'demo', locale: 'pt-BR' });
    expect(pt[0]).toMatch(/plugins enable demo/i);
    expect(ptBR[0]).toMatch(/plugins enable demo/i);
    expect(pt[0]).not.toMatch(/^Run:/);
    expect(formatPluginLoadTip('tip.bind_capability', {}, 'pt')).toMatch(/Cthere isme|bindCapability/i);
  });
});
