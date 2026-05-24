import fs from 'fs';
import path from 'path';
import type { ZavorthSetupStudioExistingConfig } from './ZavorthSetupStudioSchema.js';

export class ZavorthSetupStudioConfigStore {
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot || process.cwd());
  }

  public inspect(): ZavorthSetupStudioExistingConfig {
    const envPath = path.join(this.projectRoot, '.env');
    const profileCandidates = [
      path.join(this.projectRoot, '.zavorth', 'first-run-profile.json'),
      path.join(this.projectRoot, 'data', 'runtime', 'first-run-profile.json'),
      path.join(this.projectRoot, 'data', 'runtime', 'first-run', 'profile.json'),
    ];
    const env = this.readEnv(envPath);
    const provider = env.ZAVORTH_DEFAULT_PROVIDER || env.DEFAULT_LLM_PROVIDER || null;
    const model = this.resolveModel(env, provider);
    const configuredChannels = [
      env.TELEGRAM_BOT_TOKEN ? 'telegram' : null,
      env.DISCORD_BOT_TOKEN ? 'discord' : null,
      env.SLACK_BOT_TOKEN ? 'slack' : null,
      env.WHATSAPP_BOT_TOKEN ? 'whatsapp' : null,
      env.EMAIL_SMTP_URL ? 'email' : null,
    ].filter(Boolean) as string[];
    const profileExists = profileCandidates.some((candidate) => fs.existsSync(candidate));
    const warnings = [
      env.OPENAI_API_KEY && env.OPENAI_API_KEY.length < 12 ? 'OPENAI_API_KEY parece curta demais.' : null,
      env.TELEGRAM_BOT_TOKEN && !env.TELEGRAM_ALLOWED_USER_IDS ? 'Telegram has a token but no user allowlist.' : null,
      env.MNEMOS_SCAN_DIRS && env.MNEMOS_SCAN_DIRS.includes(path.parse(this.projectRoot).root)
        ? 'Mnemos may be configured with a broad scope.'
        : null,
    ].filter(Boolean) as string[];

    return {
      profileExists,
      envExists: fs.existsSync(envPath),
      configuredProvider: provider,
      configuredModel: model,
      configuredChannels,
      warnings,
    };
  }

  private readEnv(envPath: string): Record<string, string> {
    if (!fs.existsSync(envPath)) {
      return {};
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const entries: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) {
        continue;
      }
      entries[match[1]] = this.unquote(match[2]);
    }
    return entries;
  }

  private resolveModel(env: Record<string, string>, provider: string | null): string | null {
    if (!provider) {
      return null;
    }
    const key = `${provider.toUpperCase()}_MODEL`;
    return env[key] || env.ZAVORTH_DEFAULT_MODEL || null;
  }

  private unquote(value: string): string {
    const trimmed = String(value || '').trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}
