import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildZavorthSetupStudioDryRunScreen,
  buildZavorthSetupStudioSnapshot,
} from '../../../src/cli/setup-studio';

describe('Zavorth Setup Studio premium flow', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('builds a redacted dry-run snapshot from existing config', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-studio-'));
    tempDirs.push(root);
    fs.writeFileSync(path.join(root, '.env'), [
      'ZAVORTH_DEFAULT_PROVIDER=openai',
      'OPENAI_MODEL=gpt-4.1',
      'OPENAI_API_KEY=sk-secret-value',
      'TELEGRAM_BOT_TOKEN=telegram-secret',
      'TELEGRAM_ALLOWED_USER_IDS=123',
    ].join('\n'), 'utf8');

    const snapshot = buildZavorthSetupStudioSnapshot({
      projectRoot: root,
      dryRun: true,
      now: () => new Date('2026-05-22T10:00:00.000Z'),
    });

    expect(snapshot.contractVersion).toBe('zavorth-setup-studio-snapshot/1');
    expect(snapshot.existingConfig.configuredProvider).toBe('openai');
    expect(snapshot.existingConfig.configuredModel).toBe('gpt-4.1');
    expect(snapshot.existingConfig.configuredChannels).toEqual(['telegram']);
    expect(snapshot.safety.noSecretInOutput).toBe(true);
    expect(snapshot.steps.map((step) => step.id)).toContain('provider');
  });

  it('renders a premium setup dry-run without leaking secrets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-render-'));
    tempDirs.push(root);
    const output = buildZavorthSetupStudioDryRunScreen({
      projectRoot: root,
      providerId: 'openai',
      modelId: 'gpt-4.1',
      providerSecret: 'sk-very-secret-value',
      telegramBotToken: 'telegram-secret-token',
      telegramAllowedUserIds: '123',
      discordBotToken: 'discord-secret-token',
      slackBotToken: 'slack-secret-token',
      emailSmtpUrl: 'smtp://user:pass@example.test:587',
      searchProvider: 'google',
      searchSecret: 'google-secret-value',
      enableHooks: true,
      memoryMode: 'local-metadata',
      vaultScope: 'skip',
      dryRun: true,
    });

    expect(output).toContain('Setup Studio');
    expect(output).toContain('Security warning');
    expect(output).toContain('Web search');
    expect(output).toContain('Skills status');
    expect(output).toContain('Gateway service runtime');
    expect(output).toContain('Automation templates');
    expect(output).toContain('Hatch your agent');
    expect(output).toContain('zavorth setup');
    expect(output).toContain('OPENAI_API_KEY=sk-...lue');
    expect(output).toContain('GEMINI_API_KEY=goo...lue');
    expect(output).not.toContain('sk-very-secret-value');
    expect(output).not.toContain('telegram-secret-token');
    expect(output).not.toContain('discord-secret-token');
    expect(output).not.toContain('slack-secret-token');
    expect(output).not.toContain('user:pass');
    expect(output).not.toContain('google-secret-value');
  });
});
