import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthProviderChannelWizardService } from '../../src/cli/ZavorthProviderChannelWizardService';


describe('ZavorthProviderChannelWizardService', () => {
  const service = new ZavorthProviderChannelWizardService();

  it('builds provider previews without leaking raw secrets', () => {
    const secret = 'sk-test-provider-secret-123456';
    const result = service.buildProvider({
      projectRoot: __dirname,
      action: 'add',
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
      providerSecret: secret,
      apply: false,
    });
    const rendered = service.render(result);

    expect(result.status).toBe('preview');
    expect(result.updates.map((entry) => entry.key)).toEqual(expect.arrayContaining([
      'ZAVORTH_DEFAULT_PROVIDER',
      'GEMINI_MODEL',
      'GEMINI_API_KEY',
    ]));
    expect(rendered).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.safety).toMatchObject({
      noSecretInOutput: true,
      noLiveProbe: true,
      noRuntimeStart: true,
      writesRequireApply: true,
    });
  });

  it('builds channel previews with policy allowlists and redacted tokens', () => {
    const token = 'telegram-token-secret-abcdef';
    const result = service.buildChannel({
      projectRoot: __dirname,
      channelId: 'telegram',
      token,
      allowedUserIds: '123,456',
      apply: false,
    });
    const rendered = service.render(result);

    expect(result.status).toBe('preview');
    expect(result.updates.map((entry) => entry.key)).toEqual(expect.arrayContaining([
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_ALLOWED_USER_IDS',
      'ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED',
    ]));
    expect(rendered).not.toContain(token);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(rendered).toContain('zavorth connectors doctor telegram');
  });

  it('writes only when apply is explicit', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'zavorth-wizard-'));
    try {
      const preview = service.buildProvider({
        projectRoot: tempDir,
        action: 'switch',
        providerId: 'openrouter',
        modelId: 'openrouter/auto',
        providerSecret: 'secret-that-must-not-render',
        apply: false,
      });
      expect(preview.status).toBe('preview');

      const applied = service.buildProvider({
        projectRoot: tempDir,
        action: 'switch',
        providerId: 'openrouter',
        modelId: 'openrouter/auto',
        providerSecret: 'secret-that-must-not-render',
        apply: true,
      });
      expect(applied.status).toBe('applied');
      expect(applied.envFile).toBe(path.join(tempDir, '.env'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
