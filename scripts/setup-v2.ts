#!/usr/bin/env node
import { asErrorLike } from '../src/utils/errorLike';

import path from 'path';
import readline from 'readline';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { type EnvFileEntry, EnvFileService } from '../src/services/EnvFileService.js';
import { ChannelInstallScaffoldService } from '../src/services/ChannelInstallScaffoldService.js';

const ENV_PATH = path.resolve(__dirname, '..', '.env');
const execFileAsync = promisify(execFile);

const STATIC_DEFAULTS: Record<string, string> = {
  MAX_ITERATIONS: '5',
  MEMORY_WINDOW_SIZE: '20',
  MAX_TOKENS: '8000',
  VIDEO_CHUNK_CONCURRENCY: '2',
  VIDEO_CONTEXT_RETENTION_DAYS: '30',
  VIDEO_CONTEXT_MAX_FILES: '120',
  TEMP_FILE_RETENTION_HOURS: '2',
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_TRANSCRIPTION_MODEL: 'gemini-2.5-flash',
  DEEPSEEK_MODEL: 'deepseek-chat',
  OPENAI_MODEL: 'gpt-4o-mini',
  QWEN_MODEL: 'openrouter:qwen/qwen-plus',
  OPENROUTER_MODEL: 'minimax/minimax-m2.7',
};

type ProviderId = 'gemini' | 'deepseek' | 'openai' | 'minimax' | 'openrouter' | 'qwen';
type SetupVariant = 'full' | 'channels-only';
type ZavorthProfile = 'consumer' | 'power-user';

class SetupWizard {
  private readonly rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  private readonly envFiles = new EnvFileService();
  private readonly channelInstall = new ChannelInstallScaffoldService({ envFilePath: ENV_PATH });
  private env = this.envFiles.readMap(ENV_PATH);
  private readonly variant: SetupVariant;

  constructor(variant: SetupVariant = 'full') {
    this.variant = variant;
  }

  public async run(): Promise<void> {
    this.printBanner();

    let profile: ZavorthProfile = 'power-user';

    if (this.variant === 'full') {
      profile = await this.askChoice<ZavorthProfile>(
        'Selecione o profile do Zavorth',
        ['consumer', 'power-user'],
        (this.readEnv('ZAVORTH_PROFILE') as ZavorthProfile) || 'power-user'
      );

      const profileEntries: EnvFileEntry[] = [
        { key: 'ZAVORTH_PROFILE', value: profile, overwrite: true },
        {
            key: 'ZAVORTH_UI_MODE',
            value: profile === 'consumer' ? 'minimal' : 'operational',
            overwrite: true
        },
        {
            key: 'ZAVORTH_CAPABILITY_POLICY',
            value: profile === 'consumer' ? 'ask-on-demand' : 'owner_trusted',
            overwrite: true
        }
      ];
      this.envFiles.upsertEntries(ENV_PATH, profileEntries);
      this.refreshEnv();

      await this.configureBaseRuntime();
    }

    const optionalChannels: string[] = [];

    const telegram = await this.configureTelegram();
    if (telegram) {
      optionalChannels.push(telegram);
    }

    const discord = await this.configureDiscord();
    if (discord) {
      optionalChannels.push(discord);
    }

    const slack = await this.configureSlack();
    if (slack) {
      optionalChannels.push(slack);
    }

    const whatsapp = await this.configureWhatsApp();
    if (whatsapp) {
      optionalChannels.push(whatsapp);
    }

    const signal = await this.configureSignal();
    if (signal) {
      optionalChannels.push(signal);
    }

    const imessage = await this.configureIMessage();
    if (imessage) {
      optionalChannels.push(imessage);
    }

    const teams = await this.configureTeams();
    if (teams) {
      optionalChannels.push(teams);
    }

    const email = await this.configureEmail();
    if (email) {
      optionalChannels.push(email);
    }

    this.printSuccess(optionalChannels);
    this.rl.close();
  }

  private async configureBaseRuntime(): Promise<void> {
    const provider = await this.askChoice<ProviderId>(
      'Provider principal de IA',
      ['gemini', 'deepseek', 'openai', 'minimax', 'openrouter', 'qwen'],
      this.readEnv('LLM_PROVIDER', 'gemini') as ProviderId,
    );

    const baseValues: Record<string, string | undefined> = {
      LLM_PROVIDER: provider,
      GEMINI_API_KEY: provider === 'gemini'
        ? await this.askRequired('GEMINI_API_KEY', 'Chave do Gemini', this.readEnv('GEMINI_API_KEY'))
        : this.readEnv('GEMINI_API_KEY'),
      DEEPSEEK_API_KEY: provider === 'deepseek'
        ? await this.askRequired('DEEPSEEK_API_KEY', 'Chave do DeepSeek', this.readEnv('DEEPSEEK_API_KEY'))
        : this.readEnv('DEEPSEEK_API_KEY'),
      OPENAI_API_KEY: provider === 'openai'
        ? await this.askRequired('OPENAI_API_KEY', 'Chave da OpenAI', this.readEnv('OPENAI_API_KEY'))
        : this.readEnv('OPENAI_API_KEY'),
      MINIMAX_API_KEY: provider === 'minimax'
        ? await this.askRequired('MINIMAX_API_KEY', 'Chave do MiniMax', this.readEnv('MINIMAX_API_KEY'))
        : this.readEnv('MINIMAX_API_KEY'),
      OPENROUTER_API_KEY: provider === 'openrouter'
        ? await this.askRequired('OPENROUTER_API_KEY', 'Chave do OpenRouter', this.readEnv('OPENROUTER_API_KEY'))
        : this.readEnv('OPENROUTER_API_KEY'),
      PUTER_AUTH_TOKEN: provider === 'qwen'
        ? await this.askRequired('PUTER_AUTH_TOKEN', 'Token do Puter/Qwen', this.readEnv('PUTER_AUTH_TOKEN'))
        : this.readEnv('PUTER_AUTH_TOKEN'),
    };

    const entries: EnvFileEntry[] = [];
    for (const [key, value] of Object.entries(baseValues)) {
      if (value !== undefined) {
        entries.push({ key, value, overwrite: true });
      }
    }
    for (const [key, value] of Object.entries(STATIC_DEFAULTS)) {
      entries.push({ key, value, overwrite: false });
    }
    entries.push({
      key: 'MINIMAX_BASE_URL',
      value: this.readEnv('MINIMAX_BASE_URL', 'https://api.minimax.io/v1'),
      overwrite: false,
    });
    entries.push({
      key: 'MINIMAX_MODEL',
      value: this.readEnv('MINIMAX_MODEL', 'MiniMax-M2.7'),
      overwrite: false,
    });
    this.envFiles.upsertEntries(ENV_PATH, entries);
    this.refreshEnv();
  }

  private async configureTelegram(): Promise<string | null> {
    const prepareTelegram = await this.askYesNo(
      'Prepare Telegram now',
      this.hasValue(this.readEnv('TELEGRAM_BOT_TOKEN')),
    );
    if (!prepareTelegram) {
      return null;
    }

    const report = this.channelInstall.applyScaffold({
      channelId: 'telegram',
      mode: 'native',
      extraEntries: this.buildPromptedEntries({
        TELEGRAM_BOT_TOKEN: await this.askRequired(
          'TELEGRAM_BOT_TOKEN',
          'Token do bot do Telegram',
          this.readEnv('TELEGRAM_BOT_TOKEN'),
        ),
        TELEGRAM_ALLOWED_USER_IDS: await this.askRequired(
          'TELEGRAM_ALLOWED_USER_IDS',
          'Allowed Telegram user IDs (csv)',
          this.readEnv('TELEGRAM_ALLOWED_USER_IDS'),
        ),
        TELEGRAM_USER_ROLES: await this.askOptional(
          'TELEGRAM_USER_ROLES',
          'Telegram roles by user (optional, example: 123:admin|operator)',
          this.readEnv('TELEGRAM_USER_ROLES'),
        ),
      }),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureDiscord(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'native' | 'bridge'>(
      'Prepare Discord now',
      ['none', 'native', 'bridge'],
      this.hasValue(this.readEnv('DISCORD_BOT_TOKEN')) ? 'native'
        : (this.readEnv('DISCORD_BRIDGE_ENABLED', 'false') === 'true' ? 'bridge' : 'none'),
    );
    if (mode === 'none') {
      return null;
    }

    const values: Record<string, string | undefined> = {
      DISCORD_ALLOWED_GUILD_IDS: await this.askOptional(
        'DISCORD_ALLOWED_GUILD_IDS',
        'Guild IDs permitidos no Discord (csv)',
        this.readEnv('DISCORD_ALLOWED_GUILD_IDS'),
      ),
      DISCORD_ALLOWED_CHANNEL_IDS: await this.askOptional(
        'DISCORD_ALLOWED_CHANNEL_IDS',
        'Channel IDs permitidos no Discord (csv, optional)',
        this.readEnv('DISCORD_ALLOWED_CHANNEL_IDS'),
      ),
      DISCORD_OWNER_USER_IDS: await this.askOptional(
        'DISCORD_OWNER_USER_IDS',
        'Owner user IDs do Discord (csv, optional)',
        this.readEnv('DISCORD_OWNER_USER_IDS'),
      ),
    };

    if (mode === 'native') {
      values.DISCORD_BOT_TOKEN = await this.askOptional(
        'DISCORD_BOT_TOKEN',
        'Discord bot token (leave empty to only mark as ready to configure)',
        this.readEnv('DISCORD_BOT_TOKEN'),
      );
    }

    const report = this.channelInstall.applyScaffold({
      channelId: 'discord',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureSlack(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'local' | 'native'>(
      'Prepare Slack now',
      ['none', 'local', 'native'],
      this.readEnv('SLACK_ENABLED', 'false') === 'true' ? (this.readEnv('SLACK_TRANSPORT', 'local') === 'native' ? 'native' : 'local')
        : 'none',
    );
    if (mode === 'none') {
      return null;
    }

    const values: Record<string, string | undefined> = {
      SLACK_ALLOWED_CHANNEL_IDS: await this.askOptional(
        'SLACK_ALLOWED_CHANNEL_IDS',
        'Channel IDs permitidos no Slack (csv)',
        this.readEnv('SLACK_ALLOWED_CHANNEL_IDS'),
      ),
      SLACK_WORKSPACE_ID: await this.askOptional(
        'SLACK_WORKSPACE_ID',
        'Workspace ID do Slack (optional)',
        this.readEnv('SLACK_WORKSPACE_ID'),
      ),
    };

    if (mode === 'native') {
      values.SLACK_BOT_TOKEN = await this.askOptional(
        'SLACK_BOT_TOKEN',
        'Slack bot token (leave empty to only mark as ready to configure)',
        this.readEnv('SLACK_BOT_TOKEN'),
      );
      values.SLACK_SIGNING_SECRET = await this.askOptional(
        'SLACK_SIGNING_SECRET',
        'Slack signing secret (leave empty to only mark as ready to configure)',
        this.readEnv('SLACK_SIGNING_SECRET'),
      );
    }

    const report = this.channelInstall.applyScaffold({
      channelId: 'slack',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureWhatsApp(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'local' | 'cloud-api' | 'baileys'>(
      'Prepare WhatsApp now',
      ['none', 'local', 'cloud-api', 'baileys'],
      this.readEnv('WHATSAPP_ENABLED', 'false') === 'true'
        ? (this.readEnv('WHATSAPP_PROVIDER', 'local') as 'local' | 'cloud-api' | 'baileys')
        : 'none',
    );
    if (mode === 'none') {
      return null;
    }

    const values: Record<string, string | undefined> = {
      WHATSAPP_ALLOWED_CHAT_IDS: await this.askOptional(
        'WHATSAPP_ALLOWED_CHAT_IDS',
        'Chat IDs permitidos no WhatsApp (csv)',
        this.readEnv('WHATSAPP_ALLOWED_CHAT_IDS'),
      ),
    };

    if (mode === 'cloud-api') {
      values.WHATSAPP_PHONE_NUMBER_ID = await this.askOptional(
        'WHATSAPP_PHONE_NUMBER_ID',
        'Phone number ID da Cloud API',
        this.readEnv('WHATSAPP_PHONE_NUMBER_ID'),
      );
      values.WHATSAPP_ACCESS_TOKEN = await this.askOptional(
        'WHATSAPP_ACCESS_TOKEN',
        'Access token da Cloud API',
        this.readEnv('WHATSAPP_ACCESS_TOKEN'),
      );
      values.WHATSAPP_WEBHOOK_VERIFY_TOKEN = await this.askOptional(
        'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
        'Webhook verify token da Cloud API',
        this.readEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN'),
      );
    }

    if (mode === 'baileys') {
      values.WHATSAPP_SESSION_DIR = await this.askOptional(
        'WHATSAPP_SESSION_DIR',
        'Session dir do Baileys',
        this.readEnv('WHATSAPP_SESSION_DIR', path.resolve(__dirname, '..', 'data', 'whatsapp-session')),
      );
    }

    const report = this.channelInstall.applyScaffold({
      channelId: 'whatsapp',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureSignal(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'signal-cli'>(
      'Prepare Signal now',
      ['none', 'signal-cli'],
      this.readEnv('SIGNAL_ENABLED', 'false') === 'true'
        || this.hasValue(this.readEnv('SIGNAL_ACCOUNT_NUMBER'))
        || this.hasValue(this.readEnv('SIGNAL_CLI_PATH')) ? 'signal-cli'
        : 'none',
    );
    if (mode === 'none') {
      return null;
    }

    const values: Record<string, string | undefined> = {
      SIGNAL_CLI_PATH: await this.askOptional(
        'SIGNAL_CLI_PATH',
        'CLI do Signal (signal-cli ou path completo)',
        this.readEnv('SIGNAL_CLI_PATH', 'signal-cli'),
      ),
      SIGNAL_JSONRPC_URL: await this.askOptional(
        'SIGNAL_JSONRPC_URL',
        'URL JSON-RPC do Signal (optional se you usar signal-cli local)',
        this.readEnv('SIGNAL_JSONRPC_URL'),
      ),
      SIGNAL_ACCOUNT_NUMBER: await this.askOptional(
        'SIGNAL_ACCOUNT_NUMBER',
        'Signal number/dedicated account (leave empty to only mark as ready to configure)',
        this.readEnv('SIGNAL_ACCOUNT_NUMBER'),
      ),
      SIGNAL_ALLOWED_RECIPIENTS: await this.askOptional(
        'SIGNAL_ALLOWED_RECIPIENTS',
        'Recipients permitidos no Signal (csv)',
        this.readEnv('SIGNAL_ALLOWED_RECIPIENTS'),
      ),
    };

    const report = this.channelInstall.applyScaffold({
      channelId: 'signal',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureIMessage(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'mac-bridge'>(
      'Prepare iMessage now',
      ['none', 'mac-bridge'],
      this.readEnv('IMESSAGE_ENABLED', 'false') === 'true'
        || this.hasValue(this.readEnv('IMESSAGE_NODE_ID')) ? 'mac-bridge'
        : 'none',
    );
    if (mode === 'none') {
      return null;
    }

    const readOnly = await this.askYesNo(
      'Manter iMessage em read-only por enquanto',
      this.readEnv('IMESSAGE_READ_ONLY', 'true') !== 'false',
    );

    const values: Record<string, string | undefined> = {
      IMESSAGE_NODE_ID: await this.askOptional(
        'IMESSAGE_NODE_ID',
        'macOS node id for the iMessage bridge (leave empty to only mark as ready to configure)',
        this.readEnv('IMESSAGE_NODE_ID'),
      ),
      IMESSAGE_BRIDGE_SCRIPT: await this.askOptional(
        'IMESSAGE_BRIDGE_SCRIPT',
        'Script/shortcut local do bridge do iMessage (optional)',
        this.readEnv('IMESSAGE_BRIDGE_SCRIPT'),
      ),
      IMESSAGE_ALLOWED_RECIPIENTS: await this.askOptional(
        'IMESSAGE_ALLOWED_RECIPIENTS',
        'Recipients permitidos no iMessage (csv)',
        this.readEnv('IMESSAGE_ALLOWED_RECIPIENTS'),
      ),
      IMESSAGE_READ_ONLY: readOnly ? 'true' : 'false',
    };

    const report = this.channelInstall.applyScaffold({
      channelId: 'imessage',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureTeams(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'graph-bot'>(
      'Prepare Microsoft Teams now',
      ['none', 'graph-bot'],
      this.readEnv('TEAMS_ENABLED', 'false') === 'true'
        || this.hasValue(this.readEnv('TEAMS_APP_ID')) ? 'graph-bot'
        : 'none',
    );
    if (mode === 'none') {
      return null;
    }

    const values: Record<string, string | undefined> = {
      TEAMS_APP_ID: await this.askOptional(
        'TEAMS_APP_ID',
        'Teams bot app id (leave empty to only mark as ready to configure)',
        this.readEnv('TEAMS_APP_ID'),
      ),
      TEAMS_TENANT_ID: await this.askOptional(
        'TEAMS_TENANT_ID',
        'Tenant id do Azure/Teams',
        this.readEnv('TEAMS_TENANT_ID'),
      ),
      TEAMS_CLIENT_SECRET: await this.askOptional(
        'TEAMS_CLIENT_SECRET',
        'Client secret do Teams/Azure',
        this.readEnv('TEAMS_CLIENT_SECRET'),
      ),
      TEAMS_APP_PASSWORD: await this.askOptional(
        'TEAMS_APP_PASSWORD',
        'App password legado do Teams (optional)',
        this.readEnv('TEAMS_APP_PASSWORD'),
      ),
      TEAMS_ALLOWED_CONVERSATION_IDS: await this.askOptional(
        'TEAMS_ALLOWED_CONVERSATION_IDS',
        'Conversation IDs permitidos no Teams (csv)',
        this.readEnv('TEAMS_ALLOWED_CONVERSATION_IDS'),
      ),
    };

    const report = this.channelInstall.applyScaffold({
      channelId: 'teams',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private async configureEmail(): Promise<string | null> {
    const mode = await this.askChoice<'none' | 'smtp-imap'>(
      'Prepare Email now',
      ['none', 'smtp-imap'],
      this.readEnv('EMAIL_ENABLED', 'false') === 'true'
        || this.hasValue(this.readEnv('EMAIL_SMTP_HOST')) ? 'smtp-imap'
        : 'none',
    );
    if (mode === 'none') {
      return null;
    }

    const values: Record<string, string | undefined> = {
      EMAIL_SMTP_HOST: await this.askOptional(
        'EMAIL_SMTP_HOST',
        'Email SMTP host (leave empty to only mark as ready to configure)',
        this.readEnv('EMAIL_SMTP_HOST'),
      ),
      EMAIL_SMTP_PORT: await this.askOptional(
        'EMAIL_SMTP_PORT',
        'Porta SMTP do Email',
        this.readEnv('EMAIL_SMTP_PORT', '587'),
      ),
      EMAIL_SMTP_USER: await this.askOptional(
        'EMAIL_SMTP_USER',
        'User SMTP do Email',
        this.readEnv('EMAIL_SMTP_USER'),
      ),
      EMAIL_SMTP_PASS: await this.askOptional(
        'EMAIL_SMTP_PASS',
        'Senha/token SMTP do Email',
        this.readEnv('EMAIL_SMTP_PASS'),
      ),
      EMAIL_IMAP_HOST: await this.askOptional(
        'EMAIL_IMAP_HOST',
        'Host IMAP do Email (optional por enquanto)',
        this.readEnv('EMAIL_IMAP_HOST'),
      ),
      EMAIL_ALLOWED_RECIPIENTS: await this.askOptional(
        'EMAIL_ALLOWED_RECIPIENTS',
        'Recipients permitidos por email (csv)',
        this.readEnv('EMAIL_ALLOWED_RECIPIENTS'),
      ),
    };

    const report = this.channelInstall.applyScaffold({
      channelId: 'email',
      mode,
      extraEntries: this.buildPromptedEntries(values),
    });
    this.refreshEnv();
    return `${report.channelId}:${report.mode}`;
  }

  private readEnv(key: string, fallback = ''): string {
    const value = this.env[key];
    return value === undefined ? fallback : value;
  }

  private hasValue(value: string | undefined): boolean {
    return Boolean(String(value || '').trim());
  }

  private ask(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(`${question}\n> `, (answer) => resolve(String(answer || '').trim()));
    });
  }

  private async askRequired(key: string, label: string, currentValue = ''): Promise<string> {
    while (true) {
      const suffix = this.hasValue(currentValue) ? ' [Enter para manter current]' : ' [required]';
      const answer = await this.ask(`${label}${suffix}`);
      if (this.hasValue(answer)) {
        return answer;
      }
      if (this.hasValue(currentValue)) {
        return currentValue;
      }
      console.log(`[setup] ${key} continua required.`);
    }
  }

  private async askOptional(_key: string, label: string, currentValue = ''): Promise<string> {
    const suffix = this.hasValue(currentValue) ? ` [current: ${currentValue}]` : ' [optional]';
    const answer = await this.ask(`${label}${suffix}`);
    if (this.hasValue(answer)) {
      return answer;
    }
    return currentValue;
  }

  private async askYesNo(label: string, defaultYes: boolean): Promise<boolean> {
    const hint = defaultYes ? '[S/n]' : '[s/N]';
    const answer = String(await this.ask(`${label} ${hint}`)).toLowerCase();
    if (!answer) {
      return defaultYes;
    }
    return answer === 'y' || answer === 'yes' || answer === '1' || answer === 'true';
  }

  private async askChoice<T extends string>(label: string, choices: T[], defaultValue: T): Promise<T> {
    const answer = String(await this.ask(`${label} (${choices.join(', ')}) [default: ${defaultValue}]`)).toLowerCase();
    const normalized = (answer || defaultValue) as T;
    if (choices.includes(normalized)) {
      return normalized;
    }
    console.log(`[setup] Invalid option. Using ${defaultValue}.`);
    return defaultValue;
  }

  private printBanner(): void {
    console.log('');
    console.log('Zavorth setup');
    if (this.variant === 'channels-only') {
      console.log('This wizard prepares optional Zavorth channels: Telegram, Discord, Slack, WhatsApp, Signal, iMessage, Teams, and Email.');
    } else {
      console.log('This wizard prepares the official runtime and can leave Telegram, Discord, Slack, WhatsApp, Signal, iMessage, Teams, and Email ready or ready to configure.');
    }
    console.log('');
  }

  private printSuccess(optionalChannels: string[]): void {
    console.log('');
    console.log(this.variant === 'channels-only' ? '[setup] channel configuration complete.' : '[setup] base configuration complete.');
    console.log(`[setup] .env atualizado em ${ENV_PATH}`);
    if (optionalChannels.length > 0) {
      console.log(`[setup] channels prepared: ${optionalChannels.join(', ')}`);
    } else {
      console.log('[setup] no optional channel was prepared in this run.');
    }
    console.log('[setup] next steps:');
    if (this.variant !== 'channels-only') {
      console.log('- npm run ops:go');
    }
    console.log('- npm run setup:channels');
    console.log('- npm run channels:install -- --json');
    console.log('- npm run test:channels:smoke');
    console.log('');
  }

  private buildPromptedEntries(values: Record<string, string | undefined>): EnvFileEntry[] {
    return Object.entries(values)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        value: String(value || ''),
        overwrite: true,
      }));
  }

  private refreshEnv(): void {
    this.env = this.envFiles.readMap(ENV_PATH);
  }
}

async function installZavorthAgent(options: { installStartup: boolean }): Promise<void> {
  const agentDir = path.resolve(__dirname, '..', 'agent');
  console.log('[setup:agent] preparando Zavorth Agent');
  console.log(`[setup:agent] diretorio: ${agentDir}`);

  if (os.platform() === 'win32') {
    await execFileAsync('cmd.exe', ['/d', '/s', '/c', 'npm', 'install'], {
      cwd: agentDir,
      windowsHide: true,
    });
  } else {
    await execFileAsync('npm', ['install'], {
      cwd: agentDir,
      windowsHide: true,
    });
  }
  console.log('[setup:agent] npm dependencies installed.');

  const checks = [
    await checkCommand('edge-tts', ['--help'], 'edge-tts (TTS neural)'),
    await checkCommand('python', ['--version'], 'Python'),
    await checkCommand(os.platform() === 'win32' ? 'where' : 'which', ['whisper'], 'whisper.cpp no PATH'),
    await checkCommand('python', ['-c', 'import openwakeword'], 'Python openwakeword'),
  ];

  for (const check of checks) {
    console.log(`[setup:agent] ${check.ok ? 'ok' : 'optional missing'} - ${check.label}${check.detail ? `: ${check.detail}` : ''}`);
  }

  if (options.installStartup) {
    await installAgentStartupShortcut(agentDir);
  } else {
    console.log('[setup:agent] automatic startup ignored. Use --agent-startup to create the shortcut.');
  }

  console.log('[setup:agent] ready. Execute: npm --prefix agent start');
}

async function checkCommand(command: string, args: string[], label: string): Promise<{ ok: boolean; label: string; detail?: string }> {
  try {
    const result = await execFileAsync(command, args, {
      timeout: 8000,
      windowsHide: true,
    });
    const detail = String(result.stdout || result.stderr || '').trim().split(/\r...\n/)[0];
    return { ok: true, label, detail };
  } catch (error: unknown) {
    const err = asErrorLike(error);

    return { ok: false, label, detail: error.message };
  }
}

async function installAgentStartupShortcut(agentDir: string): Promise<void> {
  if (os.platform() !== 'win32') {
    console.log('[setup:agent] automatic startup is supported only on Windows for now.');
    return;
  }

  const safeAgentDir = agentDir.replace(/'/g, "''");
  const script = `
    $startup = [Environment]::GetFolderPath('Startup')
    $shortcut = Join-Path $startup 'Zavorth Agent.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($shortcut)
    $link.TargetPath = 'cmd.exe'
    $link.Arguments = '/c npm start'
    $link.WorkingDirectory = '${safeAgentDir}'
    $link.Description = 'Zavorth Agent'
    $link.Save()
    Write-Output $shortcut
  `.replace(/\n/g, ' ');

  const result = await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeout: 10000,
    windowsHide: true,
  });
  console.log(`[setup:agent] shortcut de startup created: ${String(result.stdout).trim()}`);
}

if (process.argv.includes('--install-agent')) {
  installZavorthAgent({ installStartup: process.argv.includes('--agent-startup') }).catch((error) => {
    console.error('[setup:agent] failure ao preparar o Agent.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
} else {
const variant: SetupVariant = process.argv.includes('--channels-only') ? 'channels-only' : 'full';
const wizard = new SetupWizard(variant);
wizard.run().catch((error) => {
  console.error('[setup] failure ao preparar o ambiente do Zavorth.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
}
