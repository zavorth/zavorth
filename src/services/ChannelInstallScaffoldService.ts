import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  PlatformCapability,
  PlatformKey,
  PlatformReadiness,
} from '../contracts/PlatformContract.js';
import { PlatformCapabilityService } from './PlatformCapabilityService.js';

import { EnvFileService, type EnvFileEntry, type EnvFileWriteReport } from './EnvFileService.js';

export type ChannelInstallMode =
  | 'native'
  | 'bridge'
  | 'stub'
  | 'cloud-api'
  | 'baileys'
  | 'signal-cli'
  | 'mac-bridge'
  | 'graph-bot'
  | 'meta-messaging'
  | 'local-outbox'
  | 'smtp-imap';

export type ChannelInstallPlan = {
  channelId: PlatformKey;
  label: string;
  readiness: PlatformReadiness;
  configured: boolean;
  implementationState: PlatformCapability['implementationState'];
  transport: PlatformCapability['transport'];
  currentMode: ChannelInstallMode | null;
  modes: ChannelInstallMode[];
  recommendedMode: ChannelInstallMode;
  summary: string;
  webhookPath: string | null;
  localWebhookUrl: string | null;
  publicWebhookUrl: string | null;
  requiredEnvKeys: string[];
  missingEnvKeys: string[];
  scaffoldEntries: Array<{ key: string; value: string }>;
  notes: string[];
  commands: {
    inspect: string;
    apply: string;
    doctor: string;
  };
};

export type ChannelInstallReport = {
  generatedAt: string;
  envFilePath: string;
  localBaseUrl: string;
  publicBaseUrl: string | null;
  channels: ChannelInstallPlan[];
};

export type ChannelInstallApplyReport = {
  generatedAt: string;
  channelId: PlatformKey;
  mode: ChannelInstallMode;
  env: EnvFileWriteReport;
  directoriesCreated: string[];
  report: ChannelInstallReport;
  nextSteps: string[];
};

type ChannelInstallScaffoldDeps = {
  now?: () => Date;
  envFilePath?: string;
  localBaseUrl?: string;
  publicBaseUrl?: string | null;
  projectRoot?: string;
  platformCapabilityService?: Pick<PlatformCapabilityService, 'getCapabilities'>;
  envFileService?: EnvFileService;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type ChannelModeDefinition = {
  requiredEnvKeys: string[];
  recommendedMode: ChannelInstallMode;
  webhookPath: string | null;
  summary: string;
  scaffoldEntries: (root: string) => EnvFileEntry[];
  directories: (root: string) => string[];
  nextSteps: (webhookUrl: string | null) => string[];
};

const CHANNEL_LABELS: Partial<Record<PlatformKey, string>> = {
  telegram: 'Telegram',
  discord: 'Discord',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  signal: 'Signal',
  imessage: 'iMessage',
  teams: 'Microsoft Teams',
  email: 'Email',
};

export class ChannelInstallScaffoldService {
  private readonly now: () => Date;
  private readonly envFilePath: string;
  private readonly localBaseUrl: string;
  private readonly publicBaseUrl: string | null;
  private readonly projectRoot: string;
  private readonly platforms: Pick<PlatformCapabilityService, 'getCapabilities'>;
  private readonly envFiles: EnvFileService;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(deps: ChannelInstallScaffoldDeps = {}) {
    this.now = deps.now || (() => new Date());
    this.envFilePath = path.resolve(deps.envFilePath || path.join(config.projectRoot, '.env'));
    this.localBaseUrl = String(
      deps.localBaseUrl
      || `http://${config.zavorthWebHost}:${config.zavorthWebPort}`,
    )
      .trim()
      .replace('://0.0.0.0:', '://127.0.0.1:');
    this.publicBaseUrl = String((deps.publicBaseUrl ?? config.zavorthPublicBaseUrl) || '').trim() || null;
    this.projectRoot = path.resolve(deps.projectRoot || config.projectRoot);
    this.platforms = deps.platformCapabilityService || new PlatformCapabilityService();
    this.envFiles = deps.envFileService || new EnvFileService();
    this.existsSync = deps.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = deps.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public buildReport(): ChannelInstallReport {
    const capabilities = this.platforms.getCapabilities();
    const envMap = this.envFiles.readMap(this.envFilePath);
    return {
      generatedAt: this.now().toISOString(),
      envFilePath: this.envFilePath,
      localBaseUrl: this.localBaseUrl,
      publicBaseUrl: this.publicBaseUrl,
      channels: capabilities.map((capability) => this.buildPlan(capability, envMap)),
    };
  }

  public buildPlanForChannel(channelId: PlatformKey, mode?: ChannelInstallMode | null): ChannelInstallPlan {
    const capability = this.platforms.getCapabilities().find((entry) => entry.platform === channelId);
    if (!capability) {
      throw new Error(`Canal nao suportado: ${channelId}.`);
    }
    const envMap = this.envFiles.readMap(this.envFilePath);
    return this.buildPlan(capability, envMap, mode || null);
  }

  public applyScaffold(input: {
    channelId: PlatformKey;
    mode: ChannelInstallMode;
    extraEntries?: EnvFileEntry[];
  }): ChannelInstallApplyReport {
    const definition = this.getModeDefinition(input.channelId, input.mode);
    const baseEntries = definition.scaffoldEntries(this.projectRoot);
    const extraEntries = Array.isArray(input.extraEntries) ? input.extraEntries : [];
    
    // Security Defense-in-Depth: whitelist extraEntries keys to prevent env pollution/hijack
    const allowedKeys = new Set(baseEntries.map((entry) => entry.key));
    const filteredExtraEntries = extraEntries.filter((entry) => allowedKeys.has(entry.key));
    
    const env = this.envFiles.upsertEntries(this.envFilePath, [...baseEntries, ...filteredExtraEntries]);
    const directoriesCreated: string[] = [];

    for (const directory of definition.directories(this.projectRoot)) {
      const target = path.resolve(directory);
      if (!this.existsSync(target)) {
        this.mkdirSync(target, { recursive: true });
        directoriesCreated.push(target);
      }
    }

    return {
      generatedAt: this.now().toISOString(),
      channelId: input.channelId,
      mode: input.mode,
      env,
      directoriesCreated,
      report: this.buildReport(),
      nextSteps: definition.nextSteps(this.buildWebhookUrl(definition.webhookPath, true)),
    };
  }

  public buildScaffoldEntries(channelId: PlatformKey, mode: ChannelInstallMode): EnvFileEntry[] {
    return this.getModeDefinition(channelId, mode).scaffoldEntries(this.projectRoot);
  }

  private buildPlan(
    capability: PlatformCapability,
    envMap: Record<string, string>,
    forcedMode: ChannelInstallMode | null = null,
  ): ChannelInstallPlan {
    const currentMode = this.detectCurrentMode(capability.platform, envMap);
    const modes = this.getModesForChannel(capability.platform);
    const recommendedMode = this.getRecommendedMode(capability.platform);
    const activeMode = forcedMode || currentMode || recommendedMode;
    const definition = this.getModeDefinition(capability.platform, activeMode);

    return {
      channelId: capability.platform,
      label: CHANNEL_LABELS[capability.platform] || capability.platform,
      readiness: capability.readiness,
      configured: capability.configured,
      implementationState: capability.implementationState,
      transport: capability.transport,
      currentMode,
      modes,
      recommendedMode,
      summary: definition.summary,
      webhookPath: definition.webhookPath,
      localWebhookUrl: this.buildWebhookUrl(definition.webhookPath, false),
      publicWebhookUrl: this.buildWebhookUrl(definition.webhookPath, true),
      requiredEnvKeys: definition.requiredEnvKeys,
      missingEnvKeys: definition.requiredEnvKeys.filter((key) => !String(envMap[key] || '').trim()),
      scaffoldEntries: definition.scaffoldEntries(this.projectRoot).map((entry) => ({
        key: entry.key,
        value: entry.value,
      })),
      notes: [...capability.notes, ...definition.nextSteps(this.buildWebhookUrl(definition.webhookPath, true))],
      commands: {
        inspect: 'npm run channels:install -- --json',
        apply: `npm run channels:install -- --channel ${capability.platform} --mode ${activeMode} --apply`,
        doctor: 'npm run test:channels:smoke',
      },
    };
  }

  private buildWebhookUrl(webhookPath: string | null, preferPublic: boolean): string | null {
    if (!webhookPath) {
      return null;
    }
    const baseUrl = preferPublic ? this.publicBaseUrl : this.localBaseUrl;
    if (!baseUrl) {
      return null;
    }
    return `${String(baseUrl).replace(/\/+$/, '')}${webhookPath}`;
  }

  private detectCurrentMode(channelId: PlatformKey, envMap: Record<string, string>): ChannelInstallMode | null {
    if (channelId === 'telegram') {
      return String(envMap.TELEGRAM_BOT_TOKEN || '').trim() || String(envMap.TELEGRAM_ALLOWED_USER_IDS || '').trim()
        ? 'native'
        : null;
    }
    if (channelId === 'discord') {
      if (String(envMap.DISCORD_BOT_TOKEN || '').trim()) {
        return 'native';
      }
      if (String(envMap.DISCORD_BRIDGE_ENABLED || '').trim().toLowerCase() === 'true') {
        return 'bridge';
      }
      return null;
    }
    if (channelId === 'slack') {
      const transport = String(envMap.SLACK_TRANSPORT || '').trim().toLowerCase();
      if (transport === 'native' || String(envMap.SLACK_BOT_TOKEN || '').trim()) {
        return 'native';
      }
      if (String(envMap.SLACK_ENABLED || '').trim().toLowerCase() === 'true' || transport === 'stub') {
        return 'stub';
      }
      return null;
    }
    if (channelId === 'signal') {
      if (
        String(envMap.SIGNAL_ENABLED || '').trim().toLowerCase() === 'true'
        || String(envMap.SIGNAL_CLI_PATH || '').trim()
        || String(envMap.SIGNAL_JSONRPC_URL || '').trim()
      ) {
        return 'signal-cli';
      }
      return null;
    }
    if (channelId === 'instagram') {
      const provider = String(envMap.INSTAGRAM_PROVIDER || '').trim().toLowerCase();
      if (provider === 'meta-messaging') {
        return 'meta-messaging';
      }
      if (
        String(envMap.INSTAGRAM_ENABLED || '').trim().toLowerCase() === 'true'
        || String(envMap.INSTAGRAM_BUSINESS_ACCOUNT_ID || '').trim()
        || String(envMap.INSTAGRAM_ALLOWED_RECIPIENT_IDS || '').trim()
        || provider === 'stub'
      ) {
        return 'stub';
      }
      return null;
    }
    if (channelId === 'imessage') {
      if (
        String(envMap.IMESSAGE_ENABLED || '').trim().toLowerCase() === 'true'
        || String(envMap.IMESSAGE_NODE_ID || '').trim()
        || String(envMap.IMESSAGE_BRIDGE_SCRIPT || '').trim()
      ) {
        return 'mac-bridge';
      }
      return null;
    }
    if (channelId === 'teams') {
      if (
        String(envMap.TEAMS_ENABLED || '').trim().toLowerCase() === 'true'
        || String(envMap.TEAMS_APP_ID || '').trim()
      ) {
        return 'graph-bot';
      }
      return null;
    }
    if (channelId === 'email') {
      const transport = String(envMap.EMAIL_TRANSPORT || '').trim().toLowerCase();
      if (
        String(envMap.EMAIL_ENABLED || '').trim().toLowerCase() === 'true'
        || String(envMap.EMAIL_SMTP_HOST || envMap.SMTP_HOST || '').trim()
        || String(envMap.EMAIL_ALLOWED_RECIPIENTS || '').trim()
      ) {
        return transport === 'smtp-imap'
          || String(envMap.EMAIL_SMTP_HOST || envMap.SMTP_HOST || '').trim()
          ? 'smtp-imap'
          : 'local-outbox';
      }
      return null;
    }
    const provider = String(envMap.WHATSAPP_PROVIDER || '').trim().toLowerCase();
    if (provider === 'cloud-api') {
      return 'cloud-api';
    }
    if (provider === 'baileys') {
      return 'baileys';
    }
    if (String(envMap.WHATSAPP_ENABLED || '').trim().toLowerCase() === 'true' || provider === 'stub') {
      return 'stub';
    }
    return null;
  }

  private getModesForChannel(channelId: PlatformKey): ChannelInstallMode[] {
    if (channelId === 'telegram') {
      return ['native'];
    }
    if (channelId === 'discord') {
      return ['native', 'bridge'];
    }
    if (channelId === 'slack') {
      return ['stub', 'native'];
    }
    if (channelId === 'signal') {
      return ['signal-cli'];
    }
    if (channelId === 'instagram') {
      return ['stub', 'meta-messaging'];
    }
    if (channelId === 'imessage') {
      return ['mac-bridge'];
    }
    if (channelId === 'teams') {
      return ['graph-bot'];
    }
    if (channelId === 'email') {
      return ['local-outbox', 'smtp-imap'];
    }
    return ['stub', 'cloud-api', 'baileys'];
  }

  private getRecommendedMode(channelId: PlatformKey): ChannelInstallMode {
    if (channelId === 'telegram') {
      return 'native';
    }
    if (channelId === 'discord') {
      return 'native';
    }
    if (channelId === 'signal') {
      return 'signal-cli';
    }
    if (channelId === 'instagram') {
      return 'stub';
    }
    if (channelId === 'imessage') {
      return 'mac-bridge';
    }
    if (channelId === 'teams') {
      return 'graph-bot';
    }
    if (channelId === 'email') {
      return 'local-outbox';
    }
    return 'stub';
  }

  private getModeDefinition(channelId: PlatformKey, mode: ChannelInstallMode): ChannelModeDefinition {
    if (channelId === 'telegram') {
      return {
        requiredEnvKeys: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS'],
        recommendedMode: 'native',
        webhookPath: null,
        summary: 'Telegram opera por bot token + operadores permitidos. Nao exige webhook externo.',
        scaffoldEntries: () => [
          { key: 'TELEGRAM_BOT_TOKEN', value: '' },
          { key: 'TELEGRAM_ALLOWED_USER_IDS', value: '' },
        ],
        directories: () => [],
        nextSteps: () => [
          'Pegue o token no @BotFather.',
          'Descubra seu user id com @userinfobot.',
          'Rode npm run test:channels:smoke depois de preencher os campos.',
        ],
      };
    }

    if (channelId === 'discord' && mode === 'native') {
      return {
        requiredEnvKeys: ['DISCORD_BOT_TOKEN', 'DISCORD_ALLOWED_GUILD_IDS'],
        recommendedMode: 'native',
        webhookPath: null,
        summary: 'Discord nativo usa bot token, guild allowlist e policy operacional.',
        scaffoldEntries: () => [
          { key: 'DISCORD_BOT_TOKEN', value: '' },
          { key: 'DISCORD_ALLOWED_GUILD_IDS', value: '' },
          { key: 'DISCORD_ALLOWED_CHANNEL_IDS', value: '' },
          { key: 'DISCORD_OWNER_USER_IDS', value: '' },
          { key: 'DISCORD_PUBLIC_SERVER_MODE', value: 'false', overwrite: true },
          { key: 'DISCORD_COMMAND_EXPOSURE', value: 'minimal', overwrite: true },
        ],
        directories: () => [],
        nextSteps: () => [
          'Crie o bot e convide-o para a guild autorizada.',
          'Preencha guilds, canais e owners antes de abrir o rollout.',
          'Rode npm run test:channels:smoke para validar o bot token.',
        ],
      };
    }

    if (channelId === 'discord' && mode === 'bridge') {
      return {
        requiredEnvKeys: ['DISCORD_BRIDGE_ENABLED', 'DISCORD_BRIDGE_SECRET'],
        recommendedMode: 'bridge',
        webhookPath: null,
        summary: 'Discord bridge usa relay local com segredo compartilhado e allowlists.',
        scaffoldEntries: (root) => [
          { key: 'DISCORD_BRIDGE_ENABLED', value: 'true', overwrite: true },
          { key: 'DISCORD_BRIDGE_SECRET', value: '' },
          { key: 'DISCORD_ALLOWED_GUILD_IDS', value: '' },
          { key: 'DISCORD_ALLOWED_CHANNEL_IDS', value: '' },
          { key: 'DISCORD_BRIDGE_INBOX_DIR', value: path.join(root, 'data', 'discord-bridge', 'inbox') },
          { key: 'DISCORD_BRIDGE_OUTBOX_DIR', value: path.join(root, 'data', 'discord-bridge', 'outbox') },
          { key: 'DISCORD_BRIDGE_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'discord-bridge-status.json') },
        ],
        directories: (root) => [
          path.join(root, 'data', 'discord-bridge', 'inbox'),
          path.join(root, 'data', 'discord-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Defina o segredo do bridge e as allowlists da guild.',
          'Suba o relay local antes de expor esse canal no mesh.',
          'Rode npm run test:channels:smoke para validar o snapshot do bridge.',
        ],
      };
    }

    if (channelId === 'slack' && mode === 'native') {
      return {
        requiredEnvKeys: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_ALLOWED_CHANNEL_IDS'],
        recommendedMode: 'native',
        webhookPath: '/api/webhooks/slack',
        summary: 'Slack nativo usa Web API + webhook com assinatura validada.',
        scaffoldEntries: (root) => [
          { key: 'SLACK_ENABLED', value: 'true', overwrite: true },
          { key: 'SLACK_TRANSPORT', value: 'native', overwrite: true },
          { key: 'SLACK_BOT_TOKEN', value: '' },
          { key: 'SLACK_SIGNING_SECRET', value: '' },
          { key: 'SLACK_API_BASE_URL', value: 'https://slack.com/api', overwrite: true },
          { key: 'SLACK_WORKSPACE_ID', value: '' },
          { key: 'SLACK_ALLOWED_CHANNEL_IDS', value: '' },
          { key: 'SLACK_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'slack-status.json') },
        ],
        directories: (root) => [path.join(root, 'data', 'runtime')],
        nextSteps: (webhookUrl) => [
          'Crie o app do Slack e gere bot token + signing secret.',
          webhookUrl
            ? `Aponte o Slack para ${webhookUrl}.`
            : 'Configure ZAVORTH_PUBLIC_BASE_URL antes de registrar o webhook do Slack.',
          'Rode npm run test:channels:smoke para validar auth.test e o webhook.',
        ],
      };
    }

    if (channelId === 'slack') {
      return {
        requiredEnvKeys: ['SLACK_ENABLED', 'SLACK_ALLOWED_CHANNEL_IDS'],
        recommendedMode: 'stub',
        webhookPath: null,
        summary: 'Slack stub deixa o canal pronto para smoke local e Channel Mesh sem webhook real.',
        scaffoldEntries: (root) => [
          { key: 'SLACK_ENABLED', value: 'true', overwrite: true },
          { key: 'SLACK_TRANSPORT', value: 'stub', overwrite: true },
          { key: 'SLACK_WORKSPACE_ID', value: '' },
          { key: 'SLACK_ALLOWED_CHANNEL_IDS', value: '' },
          { key: 'SLACK_OUTBOX_DIR', value: path.join(root, 'data', 'slack-bridge', 'outbox') },
          { key: 'SLACK_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'slack-status.json') },
        ],
        directories: (root) => [
          path.join(root, 'data', 'slack-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Use esse modo quando quiser deixar Slack pronto para o mesh antes do app real.',
          'Preencha canais permitidos para o smoke local ficar mais fiel.',
          'Rode npm run test:channels:smoke para validar o snapshot do Slack stub.',
        ],
      };
    }

    if (channelId === 'whatsapp' && mode === 'cloud-api') {
      return {
        requiredEnvKeys: [
          'WHATSAPP_PROVIDER',
          'WHATSAPP_PHONE_NUMBER_ID',
          'WHATSAPP_ACCESS_TOKEN',
          'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
          'WHATSAPP_ALLOWED_CHAT_IDS',
        ],
        recommendedMode: 'cloud-api',
        webhookPath: '/api/webhooks/whatsapp',
        summary: 'WhatsApp Cloud API usa callback oficial da Meta e outbound real.',
        scaffoldEntries: (root) => [
          { key: 'WHATSAPP_ENABLED', value: 'true', overwrite: true },
          { key: 'WHATSAPP_PROVIDER', value: 'cloud-api', overwrite: true },
          { key: 'WHATSAPP_CLOUD_API_VERSION', value: 'v20.0', overwrite: true },
          { key: 'WHATSAPP_PHONE_NUMBER_ID', value: '' },
          { key: 'WHATSAPP_ACCESS_TOKEN', value: '' },
          { key: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', value: '' },
          { key: 'WHATSAPP_ALLOWED_CHAT_IDS', value: '' },
          { key: 'WHATSAPP_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'whatsapp-status.json') },
        ],
        directories: (root) => [path.join(root, 'data', 'runtime')],
        nextSteps: (webhookUrl) => [
          'Crie o app da Meta e gere phone number id + access token.',
          webhookUrl
            ? `Registre ${webhookUrl} como callback do WhatsApp.`
            : 'Configure ZAVORTH_PUBLIC_BASE_URL antes de registrar o callback do WhatsApp.',
          'Rode npm run test:channels:smoke para validar Graph API e webhook.',
        ],
      };
    }

    if (channelId === 'whatsapp' && mode === 'baileys') {
      return {
        requiredEnvKeys: ['WHATSAPP_PROVIDER', 'WHATSAPP_SESSION_DIR', 'WHATSAPP_ALLOWED_CHAT_IDS'],
        recommendedMode: 'baileys',
        webhookPath: null,
        summary: 'WhatsApp Baileys deixa o runtime pronto para sessao persistente local.',
        scaffoldEntries: (root) => [
          { key: 'WHATSAPP_ENABLED', value: 'true', overwrite: true },
          { key: 'WHATSAPP_PROVIDER', value: 'baileys', overwrite: true },
          { key: 'WHATSAPP_SESSION_DIR', value: path.join(root, 'data', 'whatsapp-session') },
          { key: 'WHATSAPP_ALLOWED_CHAT_IDS', value: '' },
          { key: 'WHATSAPP_OUTBOX_DIR', value: path.join(root, 'data', 'whatsapp-bridge', 'outbox') },
          { key: 'WHATSAPP_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'whatsapp-status.json') },
        ],
        directories: (root) => [
          path.join(root, 'data', 'whatsapp-session'),
          path.join(root, 'data', 'whatsapp-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Use esse modo quando quiser sessao persistente local do WhatsApp.',
          'Preencha os chats permitidos antes de abrir o rollout.',
          'Rode npm run test:channels:smoke para validar o snapshot do provider Baileys.',
        ],
      };
    }

    if (channelId === 'instagram' && mode === 'meta-messaging') {
      return {
        requiredEnvKeys: [
          'INSTAGRAM_PROVIDER',
          'INSTAGRAM_BUSINESS_ACCOUNT_ID',
          'INSTAGRAM_ACCESS_TOKEN',
          'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
          'INSTAGRAM_ALLOWED_RECIPIENT_IDS',
        ],
        recommendedMode: 'meta-messaging',
        webhookPath: '/api/webhooks/instagram',
        summary: 'Instagram Messaging API usa webhook oficial da Meta e outbound real para recipients permitidos.',
        scaffoldEntries: (root) => [
          { key: 'INSTAGRAM_ENABLED', value: 'true', overwrite: true },
          { key: 'INSTAGRAM_PROVIDER', value: 'meta-messaging', overwrite: true },
          { key: 'INSTAGRAM_GRAPH_API_VERSION', value: 'v20.0', overwrite: true },
          { key: 'INSTAGRAM_BUSINESS_ACCOUNT_ID', value: '' },
          { key: 'INSTAGRAM_ACCESS_TOKEN', value: '' },
          { key: 'INSTAGRAM_WEBHOOK_VERIFY_TOKEN', value: '' },
          { key: 'INSTAGRAM_ALLOWED_RECIPIENT_IDS', value: '' },
          { key: 'INSTAGRAM_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'instagram-status.json') },
          { key: 'ZAVORTH_CHANNEL_POLICY_INSTAGRAM_OPEN', value: 'false', overwrite: true },
          { key: 'ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED', value: '' },
        ],
        directories: (root) => [path.join(root, 'data', 'runtime')],
        nextSteps: (webhookUrl) => [
          'Crie ou vincule uma conta profissional/Business autorizada no app da Meta.',
          webhookUrl
            ? `Registre ${webhookUrl} como callback da Instagram Messaging API.`
            : 'Configure ZAVORTH_PUBLIC_BASE_URL antes de registrar o callback do Instagram.',
          'Preencha recipients permitidos antes de liberar qualquer DM real.',
          'Rode npm run test:channels:smoke para validar Graph API e webhook.',
        ],
      };
    }

    if (channelId === 'instagram') {
      return {
        requiredEnvKeys: ['INSTAGRAM_ENABLED', 'INSTAGRAM_ALLOWED_RECIPIENT_IDS'],
        recommendedMode: 'stub',
        webhookPath: null,
        summary: 'Instagram stub deixa o canal visivel, governado e testavel sem enviar DM real antes da Meta Messaging API.',
        scaffoldEntries: (root) => [
          { key: 'INSTAGRAM_ENABLED', value: 'true', overwrite: true },
          { key: 'INSTAGRAM_PROVIDER', value: 'stub', overwrite: true },
          { key: 'INSTAGRAM_ALLOWED_RECIPIENT_IDS', value: '' },
          { key: 'INSTAGRAM_OUTBOX_DIR', value: path.join(root, 'data', 'instagram-bridge', 'outbox') },
          { key: 'INSTAGRAM_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'instagram-status.json') },
          { key: 'ZAVORTH_CHANNEL_POLICY_INSTAGRAM_OPEN', value: 'false', overwrite: true },
          { key: 'ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED', value: '' },
        ],
        directories: (root) => [
          path.join(root, 'data', 'instagram-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Use esse modo para deixar Instagram no Channel Mesh sem DM real.',
          'Preencha recipients permitidos para validar policy e broadcast-test local.',
          'Promova para INSTAGRAM_PROVIDER=meta-messaging quando as credenciais oficiais da Meta estiverem prontas.',
        ],
      };
    }

    if (channelId === 'signal') {
      return {
        requiredEnvKeys: ['SIGNAL_ENABLED', 'SIGNAL_CLI_PATH', 'SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS'],
        recommendedMode: 'signal-cli',
        webhookPath: null,
        summary: 'Signal usa bridge local via signal-cli/JSON-RPC com conta dedicada e allowlist.',
        scaffoldEntries: (root) => [
          { key: 'SIGNAL_ENABLED', value: 'false', overwrite: true },
          { key: 'SIGNAL_TRANSPORT', value: 'signal-cli', overwrite: true },
          { key: 'SIGNAL_CLI_PATH', value: 'signal-cli' },
          { key: 'SIGNAL_JSONRPC_URL', value: '' },
          { key: 'SIGNAL_ACCOUNT_NUMBER', value: '' },
          { key: 'SIGNAL_ALLOWED_RECIPIENTS', value: '' },
          { key: 'SIGNAL_OUTBOX_DIR', value: path.join(root, 'data', 'signal-bridge', 'outbox') },
          { key: 'SIGNAL_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'signal-bridge-status.json') },
          { key: 'ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN', value: 'false', overwrite: true },
          { key: 'ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED', value: '' },
        ],
        directories: (root) => [
          path.join(root, 'data', 'signal-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Instale e registre uma conta dedicada no signal-cli antes de usar o canal.',
          'Preencha SIGNAL_ACCOUNT_NUMBER e SIGNAL_ALLOWED_RECIPIENTS.',
          'Mantenha a allowlist fechada; Signal nao possui Bot API oficial para esse fluxo.',
          'Rode npm run test:channels:smoke para validar o doctor local.',
        ],
      };
    }

    if (channelId === 'imessage') {
      return {
        requiredEnvKeys: ['IMESSAGE_ENABLED', 'IMESSAGE_NODE_ID', 'IMESSAGE_ALLOWED_RECIPIENTS'],
        recommendedMode: 'mac-bridge',
        webhookPath: null,
        summary: 'iMessage usa Mac bridge experimental via Node Mesh/macOS, iniciando em modo read-only.',
        scaffoldEntries: (root) => [
          { key: 'IMESSAGE_ENABLED', value: 'false', overwrite: true },
          { key: 'IMESSAGE_BRIDGE_MODE', value: 'mac-bridge', overwrite: true },
          { key: 'IMESSAGE_NODE_ID', value: '' },
          { key: 'IMESSAGE_BRIDGE_SCRIPT', value: '' },
          { key: 'IMESSAGE_ALLOWED_RECIPIENTS', value: '' },
          { key: 'IMESSAGE_READ_ONLY', value: 'true', overwrite: true },
          { key: 'IMESSAGE_OUTBOX_DIR', value: path.join(root, 'data', 'imessage-bridge', 'outbox') },
          { key: 'IMESSAGE_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'imessage-bridge-status.json') },
          { key: 'ZAVORTH_CHANNEL_POLICY_IMESSAGE_OPEN', value: 'false', overwrite: true },
          { key: 'ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED', value: '' },
        ],
        directories: (root) => [
          path.join(root, 'data', 'imessage-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Suba um Node Host macOS e vincule IMESSAGE_NODE_ID antes de enviar mensagens.',
          'Comece em IMESSAGE_READ_ONLY=true para validar inbound/observabilidade.',
          'Preencha IMESSAGE_ALLOWED_RECIPIENTS e exialready approval antes do envio.',
          'Rode npm run test:channels:smoke para validar o doctor local.',
        ],
      };
    }

    if (channelId === 'teams') {
      return {
        requiredEnvKeys: ['TEAMS_ENABLED', 'TEAMS_APP_ID', 'TEAMS_TENANT_ID', 'TEAMS_ALLOWED_CONVERSATION_IDS'],
        recommendedMode: 'graph-bot',
        webhookPath: '/api/webhooks/teams',
        summary: 'Teams fica preparado para Microsoft Graph/Bot Framework com tenant e conversas permitidas.',
        scaffoldEntries: (root) => [
          { key: 'TEAMS_ENABLED', value: 'false', overwrite: true },
          { key: 'TEAMS_TRANSPORT', value: 'graph-bot', overwrite: true },
          { key: 'TEAMS_APP_ID', value: '' },
          { key: 'TEAMS_APP_PASSWORD', value: '' },
          { key: 'TEAMS_CLIENT_SECRET', value: '' },
          { key: 'TEAMS_TENANT_ID', value: '' },
          { key: 'TEAMS_ALLOWED_CONVERSATION_IDS', value: '' },
          { key: 'TEAMS_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'teams-status.json') },
          { key: 'ZAVORTH_CHANNEL_POLICY_TEAMS_OPEN', value: 'false', overwrite: true },
          { key: 'ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED', value: '' },
        ],
        directories: (root) => [path.join(root, 'data', 'runtime')],
        nextSteps: (webhookUrl) => [
          'Crie um app/bot no Azure e preencha app id, tenant id e secret.',
          webhookUrl
            ? `Aponte o Bot Framework para ${webhookUrl}.`
            : 'Configure ZAVORTH_PUBLIC_BASE_URL antes de publicar o webhook do Teams.',
          'Preencha TEAMS_ALLOWED_CONVERSATION_IDS antes de liberar rollout.',
          'Rode npm run test:channels:smoke para validar o doctor local.',
        ],
      };
    }

    if (channelId === 'email') {
      return {
        requiredEnvKeys: ['EMAIL_ENABLED', 'EMAIL_ALLOWED_RECIPIENTS'],
        recommendedMode: 'local-outbox',
        webhookPath: null,
        summary: 'Email usa local-outbox ou SMTP/IMAP como fallback universal para notificacoes e approvals.',
        scaffoldEntries: (root) => [
          { key: 'EMAIL_ENABLED', value: 'true', overwrite: true },
          { key: 'EMAIL_TRANSPORT', value: 'local-outbox', overwrite: true },
          { key: 'EMAIL_SMTP_HOST', value: '' },
          { key: 'EMAIL_SMTP_PORT', value: '587', overwrite: true },
          { key: 'EMAIL_SMTP_USER', value: '' },
          { key: 'EMAIL_SMTP_PASS', value: '' },
          { key: 'EMAIL_IMAP_HOST', value: '' },
          { key: 'EMAIL_ALLOWED_RECIPIENTS', value: '' },
          { key: 'EMAIL_OUTBOX_DIR', value: path.join(root, 'data', 'email-bridge', 'outbox') },
          { key: 'EMAIL_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'email-status.json') },
          { key: 'ZAVORTH_CHANNEL_POLICY_EMAIL_OPEN', value: 'false', overwrite: true },
          { key: 'ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED', value: '' },
        ],
        directories: (root) => [
          path.join(root, 'data', 'email-bridge', 'outbox'),
          path.join(root, 'data', 'runtime'),
        ],
        nextSteps: () => [
          'Preencha EMAIL_ALLOWED_RECIPIENTS para liberar o fallback local-outbox.',
          'Configure SMTP quando quiser outbound real alem do outbox local.',
          'Configure IMAP depois se quiser approvals por resposta de email.',
          'Rode npm run test:channels:smoke para validar o doctor local.',
        ],
      };
    }

    return {
      requiredEnvKeys: ['WHATSAPP_PROVIDER', 'WHATSAPP_ALLOWED_CHAT_IDS'],
      recommendedMode: 'stub',
      webhookPath: null,
      summary: 'WhatsApp stub deixa o canal pronto para smoke local e Channel Mesh sem provider real.',
      scaffoldEntries: (root) => [
        { key: 'WHATSAPP_ENABLED', value: 'true', overwrite: true },
        { key: 'WHATSAPP_PROVIDER', value: 'stub', overwrite: true },
        { key: 'WHATSAPP_ALLOWED_CHAT_IDS', value: '' },
        { key: 'WHATSAPP_OUTBOX_DIR', value: path.join(root, 'data', 'whatsapp-bridge', 'outbox') },
        { key: 'WHATSAPP_STATUS_FILE', value: path.join(root, 'data', 'runtime', 'whatsapp-status.json') },
      ],
      directories: (root) => [
        path.join(root, 'data', 'whatsapp-bridge', 'outbox'),
        path.join(root, 'data', 'runtime'),
      ],
      nextSteps: () => [
        'Use esse modo quando quiser preparar WhatsApp antes do provider real.',
        'Preencha chats permitidos para o smoke local ficar mais fiel.',
        'Rode npm run test:channels:smoke para validar o snapshot do WhatsApp stub.',
      ],
    };
  }
}
