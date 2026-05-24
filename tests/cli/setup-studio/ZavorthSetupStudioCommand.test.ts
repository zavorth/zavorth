import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS } from '../../../src/cli/ZavorthSetupStudioService.js';
import {
  renderZavorthSetupCancelledMessage,
  runZavorthSetupStudioCommand,
} from '../../../src/cli/setup-studio/ZavorthSetupStudioCommand.js';

describe('Zavorth Setup Studio command', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir && fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('keeps cancellation output concise instead of replaying the full setup preview', () => {
    const output = renderZavorthSetupCancelledMessage();

    expect(output).toContain('Setup cancelled.');
    expect(output).toContain('Nothing was changed.');
    expect(output).toContain('zavorth onboarding');
    expect(output).not.toContain('Setup Studio will prepare');
    expect(output).not.toContain('Skills status');
    expect(output).not.toContain('Gateway service runtime');
  });

  it('renders premium preview by default without writing .env or leaking secrets', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-command-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: [
        '--provider', 'openai',
        '--model', 'gpt-4.1',
        '--secret', 'sk-secret-value-for-test',
        '--telegram-token', 'telegram-secret-token',
        '--telegram-users', '123',
        '--discord-token', 'discord-secret-token',
        '--slack-token', 'slack-secret-token',
        '--email-smtp-url', 'smtp://user:pass@example.test:587',
        '--search-provider', 'brave',
        '--search-secret', 'brave-secret-value',
        '--enable-hooks',
      ],
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.applied).toBe(false);
    expect(fs.existsSync(path.join(root, '.env'))).toBe(false);
    expect(result.output).toContain('Setup Studio');
    expect(result.output).toContain('Dry-run preview');
    expect(result.output).toContain('OPENAI_API_KEY=sk-...est');
    expect(result.output).toContain('BRAVE_SEARCH_API_KEY=bra...lue');
    expect(result.output).toContain('Discord: configured-secret');
    expect(result.output).toContain('Slack: configured-secret');
    expect(result.output).toContain('Email: configured-secret');
    expect(result.output).toContain('Automation templates: 2 prepared, disabled by default');
    expect(result.output).toContain('Setup Studio will prepare');
    expect(result.output).not.toContain('sk-secret-value-for-test');
    expect(result.output).not.toContain('telegram-secret-token');
    expect(result.output).not.toContain('discord-secret-token');
    expect(result.output).not.toContain('slack-secret-token');
    expect(result.output).not.toContain('user:pass');
    expect(result.output).not.toContain('brave-secret-value');
  });

  it('applies .env changes only with --apply', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-apply-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: [
        '--apply',
        '--provider=openai',
        '--model=gpt-4.1',
        '--secret=sk-secret-value-for-test',
        '--memory-mode=local-summary',
        '--enable-hooks',
      ],
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
    expect(result.exitCode).toBe(0);
    expect(result.applied).toBe(true);
    expect(result.writtenKeys).toContain('ZAVORTH_DEFAULT_PROVIDER');
    expect(result.writtenKeys).toContain('OPENAI_API_KEY');
    expect(env).toContain('ZAVORTH_DEFAULT_PROVIDER=openai');
    expect(env).toContain('OPENAI_MODEL=gpt-4.1');
    expect(env).toContain('OPENAI_API_KEY=sk-secret-value-for-test');
    expect(fs.existsSync(path.join(root, '.zavorth', 'hooks', 'after-run-summary.json'))).toBe(true);
    const hook = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'hooks', 'after-run-summary.json'), 'utf8'));
    expect(hook.contractVersion).toBe('zavorth-automation-hook/1');
    expect(hook.event).toBe('runtime.after_execute');
    expect(hook.actions.length).toBeGreaterThan(0);
    expect(result.output).not.toContain('sk-secret-value-for-test');
  });

  it('keeps apply output compact instead of replaying the full onboarding screen', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-compact-apply-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: ['--apply', '--provider=local'],
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Setup complete');
    expect(result.output).toContain('Next commands');
    expect(result.output).not.toContain('Security warning - please read');
    expect(result.output).not.toContain('Hatch your agent');
    expect(result.output).not.toContain('Skills status');
  });

  it('upgrades legacy empty hook templates without overwriting user automation hooks', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-hook-upgrade-'));
    tempDirs.push(root);
    const hooksRoot = path.join(root, '.zavorth', 'hooks');
    fs.mkdirSync(hooksRoot, { recursive: true });
    fs.writeFileSync(path.join(hooksRoot, 'after-run-summary.json'), `${JSON.stringify({
      contractVersion: 'zavorth-hook-template/1',
      name: 'after-run-summary',
      enabled: false,
      actions: [],
    })}\n`, 'utf8');
    fs.writeFileSync(path.join(hooksRoot, 'approval-expiry-notice.json'), `${JSON.stringify({
      contractVersion: 'zavorth-automation-hook/1',
      id: 'custom-user-hook',
      title: 'Custom',
      enabled: false,
      event: 'custom.event',
      safety: {
        noSecrets: true,
        requiresPolicy: true,
        canSendExternalData: false,
      },
      actions: [{ type: 'receipt.create' }],
    })}\n`, 'utf8');

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: ['--apply', '--provider=local', '--enable-hooks'],
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.exitCode).toBe(0);
    const upgraded = JSON.parse(fs.readFileSync(path.join(hooksRoot, 'after-run-summary.json'), 'utf8'));
    const preserved = JSON.parse(fs.readFileSync(path.join(hooksRoot, 'approval-expiry-notice.json'), 'utf8'));
    expect(upgraded.contractVersion).toBe('zavorth-automation-hook/1');
    expect(upgraded.actions.length).toBeGreaterThan(0);
    expect(preserved.id).toBe('custom-user-hook');
    expect(preserved.event).toBe('custom.event');
  });

  it('exports stable json preview', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-json-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: ['--json', '--provider=local'],
      json: true,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.contractVersion).toBe('zavorth-setup-studio-snapshot/1');
    expect(parsed.plan.provider.id).toBe('local');
    expect(parsed.plan.webSearch.provider).toBe('local');
    expect(parsed.hooks.available).toBe(true);
    expect(parsed.safety.noSecretInOutput).toBe(true);
  });

  it('redacts secrets in json preview payloads', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-json-secret-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: [
        '--json',
        '--provider=openai',
        '--secret=sk-json-secret-value',
        '--discord-token=discord-json-secret',
      ],
      json: true,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    expect(result.output).not.toContain('sk-json-secret-value');
    expect(result.output).not.toContain('discord-json-secret');
    expect(result.output).toContain('sk-...lue');
    expect(result.output).toContain('dis...ret');
  });

  it('resolves provider by query for quick searchable setup flows', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-provider-query-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: ['--json', '--provider-query=anthro'],
      json: true,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.plan.provider.id).toBe('anthropic');
  });

  it('exposes the expanded provider and channel catalogs in setup instead of the tiny quickstart list', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-expanded-catalog-'));
    tempDirs.push(root);

    const result = await runZavorthSetupStudioCommand({
      projectRoot: root,
      args: ['--json', '--provider=local'],
      json: true,
      now: () => new Date('2026-05-22T12:00:00.000Z'),
    });
    const parsed = JSON.parse(result.output);
    const providerIds = ZAVORTH_SETUP_STUDIO_PROVIDER_OPTIONS.map((provider) => provider.id);
    const channelIds = parsed.channelGuide.map((channel: { id: string }) => channel.id);

    expect(providerIds.length).toBeGreaterThanOrEqual(40);
    expect(providerIds).toEqual(expect.arrayContaining([
      'openai',
      'anthropic',
      'openrouter',
      'elevenlabs',
      'deepgram',
      'runway',
      'fal',
    ]));
    expect(channelIds.length).toBeGreaterThanOrEqual(20);
    expect(channelIds).toEqual(expect.arrayContaining([
      'telegram',
      'discord',
      'slack',
      'email',
      'matrix',
      'line',
      'feishu',
      'msteams',
      'whatsapp-cloud',
      'whatsapp-baileys',
    ]));
  });

  it('falls back to premium text output for fullscreen setup when Ink is disabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-setup-fullscreen-fallback-'));
    tempDirs.push(root);
    const previous = process.env.ZAVORTH_DISABLE_INK;
    process.env.ZAVORTH_DISABLE_INK = '1';
    try {
      const result = await runZavorthSetupStudioCommand({
        projectRoot: root,
        args: ['--fullscreen', '--provider=local'],
        now: () => new Date('2026-05-22T12:00:00.000Z'),
      });

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Setup Studio');
      expect(result.output).toContain('Dry-run preview');
    } finally {
      if (previous === undefined) {
        delete process.env.ZAVORTH_DISABLE_INK;
      } else {
        process.env.ZAVORTH_DISABLE_INK = previous;
      }
    }
  });
});
