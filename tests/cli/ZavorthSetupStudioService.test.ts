import path from 'path';
import {
  buildZavorthSetupStudioPlan,
  mergeEnvContent,
  renderZavorthSetupStudioPlan,
} from '../../src/cli/ZavorthSetupStudioService';

describe('Zavorth Setup Studio service', () => {
  it('builds provider, model, channel and Mnemos env updates without leaking secrets in text', () => {
    const plan = buildZavorthSetupStudioPlan({
      projectRoot: 'C:/workspace/zavorth',
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
      providerSecret: 'sk-test-secret-value-123456789',
      telegramBotToken: '123456:telegram-secret-token',
      telegramAllowedUserIds: '42',
      memoryMode: 'local-summary',
      vaultScope: 'custom',
      scanDirs: ['C:/Users/operator/Downloads'],
    });
    const rendered = renderZavorthSetupStudioPlan(plan);

    expect(plan.provider).toEqual(expect.objectContaining({
      id: 'gemini',
      modelId: 'gemini-2.5-flash',
      secretStored: true,
      secretEnvKey: 'GEMINI_API_KEY',
    }));
    expect(plan.envUpdates.map((entry) => entry.key)).toEqual(expect.arrayContaining([
      'ZAVORTH_DEFAULT_PROVIDER',
      'GEMINI_MODEL',
      'GEMINI_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ALLOWED_USER_IDS',
      'MNEMOS_SCAN_DIRS',
    ]));
    expect(rendered).not.toContain('sk-test-secret-value-123456789');
    expect(rendered).not.toContain('telegram-secret-token');
    expect(rendered).toContain('Mnemos Memory: local-summary / custom');
    expect(plan.safety.rawSecretsInPlan).toBe(false);
    expect(plan.safety.providerExecutionPerformed).toBe(false);
    expect(plan.safety.runtimePersistentStartPerformed).toBe(false);
  });

  it('updates existing env content without duplicating keys', () => {
    const plan = buildZavorthSetupStudioPlan({
      projectRoot: 'C:/workspace/zavorth',
      providerId: 'openrouter',
      modelId: 'openrouter/auto',
      providerSecret: 'or-secret-value-123456789',
      memoryMode: 'local-metadata',
      vaultScope: 'downloads',
      scanDirs: [path.join('C:/Users/operator', 'Downloads')],
    });

    const merged = mergeEnvContent('OPENROUTER_MODEL=old\nUNCHANGED=yes\n', plan.envUpdates);

    expect(merged).toContain('OPENROUTER_MODEL=openrouter/auto');
    expect(merged).toContain('OPENROUTER_API_KEY=or-secret-value-123456789');
    expect(merged).toContain('UNCHANGED=yes');
    expect(merged.match(/OPENROUTER_MODEL=/g)).toHaveLength(1);
  });
});
