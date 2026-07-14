import crypto from 'crypto';
import path from 'path';
import { config } from '../../../../config/index.js';
import {
  upsertEnvFileValues,
} from './ChannelSetupGuideEnvSupport.js';
import type {
  ChannelSetupApplyInput,
  ChannelSetupApplyResult,
  ChannelSetupChannelId,
  ChannelSetupMode,
} from '../../domain/ChannelSetupGuideTypes.js';

type ApplyChannelSetupInput = {
  envFilePath: string;
  projectRoot: string;
  input: ChannelSetupApplyInput;
  existsSync: typeof import('fs').existsSync;
  readFileSync: typeof import('fs').readFileSync;
  writeFileSync: typeof import('fs').writeFileSync;
  mkdirSync: typeof import('fs').mkdirSync;
};

export function applyChannelSetup({
  envFilePath,
  projectRoot,
  input,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
}: ApplyChannelSetupInput): ChannelSetupApplyResult {
  const channelId = normalizeChannelId(input.channelId);
  const mode = normalizeMode(input.mode);
  const values = input.values || {};

  const envValues = buildEnvValues(projectRoot, channelId, mode, values);
  const envKeysWritten = upsertEnvFileValues(envFilePath, envValues, {
    existsSync,
    readFileSync,
    writeFileSync,
    mkdirSync,
  });
  const filesTouched = [envFilePath];
  filesTouched.push(...ensureFilesystemScaffolding({
    channelId,
    mode,
    values,
    projectRoot,
    existsSync,
    writeFileSync,
    mkdirSync,
  }));

  return {
    channelId,
    mode,
    summary: buildApplySummary(channelId, mode),
    envKeysWritten,
    filesTouched: Array.from(new Set(filesTouched)),
    nextSteps: buildNextSteps(channelId, mode),
  };
}

function buildEnvValues(
  projectRoot: string,
  channelId: ChannelSetupChannelId,
  mode: ChannelSetupMode,
  values: Record<string, string | undefined>,
): Record<string, string | undefined> {
  switch (channelId) {
    case 'telegram':
      return {
        TELEGRAM_BOT_TOKEN: pickValue(values.botToken, process.env.TELEGRAM_BOT_TOKEN, ''),
        TELEGRAM_ALLOWED_USER_IDS: pickValue(values.allowedUserIds, process.env.TELEGRAM_ALLOWED_USER_IDS, ''),
        TELEGRAM_USER_ROLES: pickValue(values.userRoles, process.env.TELEGRAM_USER_ROLES, ''),
      };
    case 'discord':
      if (mode === 'bridge') {
        return {
          DISCORD_BRIDGE_ENABLED: 'true',
          DISCORD_BRIDGE_SECRET_FILE: resolveDiscordBridgeSecretFile(projectRoot, values.bridgeSecretFile),
          DISCORD_ALLOWED_GUILD_IDS: pickValue(values.allowedGuildIds, process.env.DISCORD_ALLOWED_GUILD_IDS, ''),
          DISCORD_ALLOWED_CHANNEL_IDS: pickValue(values.allowedChannelIds, process.env.DISCORD_ALLOWED_CHANNEL_IDS, ''),
          DISCORD_ALLOW_DMS: pickValue(values.allowDms, process.env.DISCORD_ALLOW_DMS, 'false'),
          DISCORD_BRIDGE_ALLOW_DMS: pickValue(values.allowDms, process.env.DISCORD_BRIDGE_ALLOW_DMS, 'false'),
          DISCORD_OWNER_USER_IDS: pickValue(values.ownerUserIds, process.env.DISCORD_OWNER_USER_IDS, ''),
        };
      }
      return {
        DISCORD_BOT_TOKEN: pickValue(values.botToken, process.env.DISCORD_BOT_TOKEN, ''),
        DISCORD_ALLOWED_GUILD_IDS: pickValue(values.allowedGuildIds, process.env.DISCORD_ALLOWED_GUILD_IDS, ''),
        DISCORD_ALLOWED_CHANNEL_IDS: pickValue(values.allowedChannelIds, process.env.DISCORD_ALLOWED_CHANNEL_IDS, ''),
        DISCORD_OWNER_USER_IDS: pickValue(values.ownerUserIds, process.env.DISCORD_OWNER_USER_IDS, ''),
        DISCORD_ALLOW_DMS: pickValue(values.allowDms, process.env.DISCORD_ALLOW_DMS, 'false'),
        DISCORD_PUBLIC_SERVER_MODE: pickValue(values.publicServerMode, process.env.DISCORD_PUBLIC_SERVER_MODE, 'false'),
        DISCORD_COMMAND_EXPOSURE: pickValue(values.commandExposure, process.env.DISCORD_COMMAND_EXPOSURE, 'minimal'),
      };
    case 'slack':
      return {
        SLACK_ENABLED: 'true',
        SLACK_TRANSPORT: mode === 'native' ? 'native' : 'stub',
        SLACK_ALLOWED_CHANNEL_IDS: pickValue(values.allowedChannelIds, process.env.SLACK_ALLOWED_CHANNEL_IDS, ''),
        SLACK_WORKSPACE_ID: pickValue(values.workspaceId, process.env.SLACK_WORKSPACE_ID, ''),
        SLACK_BOT_TOKEN: mode === 'native'
          ? pickValue(values.botToken, process.env.SLACK_BOT_TOKEN, '')
          : pickValue(undefined, process.env.SLACK_BOT_TOKEN, ''),
        SLACK_SIGNING_SECRET: mode === 'native'
          ? pickValue(values.signingSecret, process.env.SLACK_SIGNING_SECRET, '')
          : pickValue(undefined, process.env.SLACK_SIGNING_SECRET, ''),
      };
    case 'whatsapp':
      return {
        WHATSAPP_ENABLED: 'true',
        WHATSAPP_PROVIDER: mode,
        WHATSAPP_ALLOWED_CHAT_IDS: pickValue(values.allowedChatIds, process.env.WHATSAPP_ALLOWED_CHAT_IDS, ''),
        WHATSAPP_PHONE_NUMBER_ID: mode === 'cloud-api'
          ? pickValue(values.phoneNumberId, process.env.WHATSAPP_PHONE_NUMBER_ID, '')
          : pickValue(undefined, process.env.WHATSAPP_PHONE_NUMBER_ID, ''),
        WHATSAPP_ACCESS_TOKEN: mode === 'cloud-api'
          ? pickValue(values.accessToken, process.env.WHATSAPP_ACCESS_TOKEN, '')
          : pickValue(undefined, process.env.WHATSAPP_ACCESS_TOKEN, ''),
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: mode === 'cloud-api'
          ? pickValue(values.webhookVerifyToken, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, '')
          : pickValue(undefined, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, ''),
        WHATSAPP_SESSION_DIR: mode === 'baileys'
          ? pickValue(values.sessionDir, process.env.WHATSAPP_SESSION_DIR, path.resolve(projectRoot, 'data', 'whatsapp-session'))
          : pickValue(undefined, process.env.WHATSAPP_SESSION_DIR, ''),
        WHATSAPP_CLOUD_API_VERSION: pickValue(values.cloudApiVersion, process.env.WHATSAPP_CLOUD_API_VERSION, 'v20.0'),
      };
    case 'instagram':
      return {
        INSTAGRAM_ENABLED: 'true',
        INSTAGRAM_PROVIDER: mode === 'meta-messaging' ? 'meta-messaging' : 'stub',
        INSTAGRAM_GRAPH_API_VERSION: pickValue(values.graphApiVersion, process.env.INSTAGRAM_GRAPH_API_VERSION, 'v20.0'),
        INSTAGRAM_BUSINESS_ACCOUNT_ID: mode === 'meta-messaging'
          ? pickValue(values.businessAccountId, process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID, '')
          : pickValue(undefined, process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID, ''),
        INSTAGRAM_ACCESS_TOKEN: mode === 'meta-messaging'
          ? pickValue(values.accessToken, process.env.INSTAGRAM_ACCESS_TOKEN, '')
          : pickValue(undefined, process.env.INSTAGRAM_ACCESS_TOKEN, ''),
        INSTAGRAM_WEBHOOK_VERIFY_TOKEN: mode === 'meta-messaging'
          ? pickValue(values.webhookVerifyToken, process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN, '')
          : pickValue(undefined, process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN, ''),
        INSTAGRAM_ALLOWED_RECIPIENT_IDS: pickValue(values.allowedRecipientIds, process.env.INSTAGRAM_ALLOWED_RECIPIENT_IDS, ''),
        INSTAGRAM_OUTBOX_DIR: pickValue(values.outboxDir, process.env.INSTAGRAM_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'instagram-bridge', 'outbox')),
        INSTAGRAM_STATUS_FILE: pickValue(values.statusFile, process.env.INSTAGRAM_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'instagram-status.json')),
        ZAVORTH_CHANNEL_POLICY_INSTAGRAM_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED: pickValue(values.allowedRecipientIds, process.env.ZAVORTH_CHANNEL_POLICY_INSTAGRAM_ALLOWED, ''),
      };
    case 'signal':
      return {
        SIGNAL_ENABLED: 'true',
        SIGNAL_TRANSPORT: 'signal-cli',
        SIGNAL_CLI_PATH: pickValue(values.cliPath, process.env.SIGNAL_CLI_PATH, 'signal-cli'),
        SIGNAL_JSONRPC_URL: pickValue(values.jsonRpcUrl, process.env.SIGNAL_JSONRPC_URL, ''),
        SIGNAL_ACCOUNT_NUMBER: pickValue(values.accountNumber, process.env.SIGNAL_ACCOUNT_NUMBER, ''),
        SIGNAL_ALLOWED_RECIPIENTS: pickValue(values.allowedRecipients, process.env.SIGNAL_ALLOWED_RECIPIENTS, ''),
        SIGNAL_OUTBOX_DIR: pickValue(values.outboxDir, process.env.SIGNAL_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'signal-bridge', 'outbox')),
        SIGNAL_STATUS_FILE: pickValue(values.statusFile, process.env.SIGNAL_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'signal-bridge-status.json')),
        ZAVORTH_CHANNEL_POLICY_SIGNAL_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED: pickValue(values.allowedRecipients, process.env.ZAVORTH_CHANNEL_POLICY_SIGNAL_ALLOWED, ''),
      };
    case 'imessage':
      return {
        IMESSAGE_ENABLED: 'true',
        IMESSAGE_BRIDGE_MODE: 'mac-bridge',
        IMESSAGE_NODE_ID: pickValue(values.nodeId, process.env.IMESSAGE_NODE_ID, ''),
        IMESSAGE_BRIDGE_SCRIPT: pickValue(values.bridgeScript, process.env.IMESSAGE_BRIDGE_SCRIPT, ''),
        IMESSAGE_ALLOWED_RECIPIENTS: pickValue(values.allowedRecipients, process.env.IMESSAGE_ALLOWED_RECIPIENTS, ''),
        IMESSAGE_READ_ONLY: pickValue(values.readOnly, process.env.IMESSAGE_READ_ONLY, 'true'),
        IMESSAGE_OUTBOX_DIR: pickValue(values.outboxDir, process.env.IMESSAGE_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'imessage-bridge', 'outbox')),
        IMESSAGE_STATUS_FILE: pickValue(values.statusFile, process.env.IMESSAGE_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'imessage-bridge-status.json')),
        ZAVORTH_CHANNEL_POLICY_IMESSAGE_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED: pickValue(values.allowedRecipients, process.env.ZAVORTH_CHANNEL_POLICY_IMESSAGE_ALLOWED, ''),
      };
    case 'teams':
      return {
        TEAMS_ENABLED: 'true',
        TEAMS_TRANSPORT: 'graph-bot',
        TEAMS_APP_ID: pickValue(values.appId, process.env.TEAMS_APP_ID, ''),
        TEAMS_APP_PASSWORD: pickValue(values.appPassword, process.env.TEAMS_APP_PASSWORD, ''),
        TEAMS_CLIENT_SECRET: pickValue(values.clientSecret, process.env.TEAMS_CLIENT_SECRET, ''),
        TEAMS_TENANT_ID: pickValue(values.tenantId, process.env.TEAMS_TENANT_ID, ''),
        TEAMS_ALLOWED_CONVERSATION_IDS: pickValue(values.allowedConversationIds, process.env.TEAMS_ALLOWED_CONVERSATION_IDS, ''),
        TEAMS_STATUS_FILE: pickValue(values.statusFile, process.env.TEAMS_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'teams-status.json')),
        ZAVORTH_CHANNEL_POLICY_TEAMS_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED: pickValue(values.allowedConversationIds, process.env.ZAVORTH_CHANNEL_POLICY_TEAMS_ALLOWED, ''),
      };
    case 'email':
      return {
        EMAIL_ENABLED: 'true',
        EMAIL_TRANSPORT: mode === 'smtp-imap' ? 'smtp-imap' : 'local-outbox',
        EMAIL_SMTP_HOST: pickValue(values.smtpHost, process.env.EMAIL_SMTP_HOST, process.env.SMTP_HOST, ''),
        EMAIL_SMTP_PORT: pickValue(values.smtpPort, process.env.EMAIL_SMTP_PORT, '587'),
        EMAIL_SMTP_USER: pickValue(values.smtpUser, process.env.EMAIL_SMTP_USER, ''),
        EMAIL_SMTP_PASS: pickValue(values.smtpPass, process.env.EMAIL_SMTP_PASS, ''),
        EMAIL_IMAP_HOST: pickValue(values.imapHost, process.env.EMAIL_IMAP_HOST, process.env.IMAP_HOST, ''),
        EMAIL_ALLOWED_RECIPIENTS: pickValue(values.allowedRecipients, process.env.EMAIL_ALLOWED_RECIPIENTS, ''),
        EMAIL_OUTBOX_DIR: pickValue(values.outboxDir, process.env.EMAIL_OUTBOX_DIR, path.resolve(projectRoot, 'data', 'email-bridge', 'outbox')),
        EMAIL_STATUS_FILE: pickValue(values.statusFile, process.env.EMAIL_STATUS_FILE, path.resolve(projectRoot, 'data', 'runtime', 'email-status.json')),
        ZAVORTH_CHANNEL_POLICY_EMAIL_OPEN: 'false',
        ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED: pickValue(values.allowedRecipients, process.env.ZAVORTH_CHANNEL_POLICY_EMAIL_ALLOWED, ''),
      };
    default:
      throw new Error(`Unsupported channel: ${channelId}.`);
  }
}

function ensureFilesystemScaffolding(input: {
  channelId: ChannelSetupChannelId;
  mode: ChannelSetupMode;
  values: Record<string, string | undefined>;
  projectRoot: string;
  existsSync: typeof import('fs').existsSync;
  writeFileSync: typeof import('fs').writeFileSync;
  mkdirSync: typeof import('fs').mkdirSync;
}): string[] {
  const {
    channelId,
    mode,
    values,
    projectRoot,
    existsSync,
    writeFileSync,
    mkdirSync,
  } = input;
  const touched: string[] = [];

  if (channelId === 'discord' && mode === 'bridge') {
    const secretFile = resolveDiscordBridgeSecretFile(projectRoot, values.bridgeSecretFile);
    mkdirSync(path.dirname(secretFile), { recursive: true });
    touched.push(path.dirname(secretFile));
    if (!existsSync(secretFile)) {
      const secret = String(values.bridgeSecret || '').trim() || crypto.randomBytes(24).toString('hex');
      writeFileSync(secretFile, `${secret}\n`, 'utf8');
      touched.push(secretFile);
    }
  }

  if (channelId === 'slack') {
    const outboxDir = String(values.outboxDir || config.slackOutboxDir || '').trim();
    const statusDir = path.dirname(String(values.statusFile || config.slackStatusFile || '').trim());
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusDir) {
      mkdirSync(statusDir, { recursive: true });
      touched.push(statusDir);
    }
  }

  if (channelId === 'whatsapp') {
    const outboxDir = String(values.outboxDir || config.whatsappOutboxDir || '').trim();
    const statusDir = path.dirname(String(values.statusFile || config.whatsappStatusFile || '').trim());
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusDir) {
      mkdirSync(statusDir, { recursive: true });
      touched.push(statusDir);
    }
    if (mode === 'baileys') {
      const sessionDir = pickValue(values.sessionDir, process.env.WHATSAPP_SESSION_DIR, path.resolve(projectRoot, 'data', 'whatsapp-session'));
      if (sessionDir) {
        mkdirSync(sessionDir, { recursive: true });
        touched.push(sessionDir);
      }
    }
  }

  if (channelId === 'instagram') {
    const outboxDir = String(values.outboxDir || config.instagramOutboxDir || '').trim();
    const statusDir = path.dirname(String(values.statusFile || config.instagramStatusFile || '').trim());
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusDir) {
      mkdirSync(statusDir, { recursive: true });
      touched.push(statusDir);
    }
  }

  if (channelId === 'signal' || channelId === 'imessage' || channelId === 'email') {
    const outboxDir = String(
      values.outboxDir
      || process.env[`${channelId.toUpperCase()}_OUTBOX_DIR`]
      || path.resolve(projectRoot, 'data', `${channelId}-bridge`, 'outbox'),
    ).trim();
    const statusFile = String(
      values.statusFile
      || process.env[`${channelId.toUpperCase()}_STATUS_FILE`]
      || path.resolve(projectRoot, 'data', 'runtime', `${channelId}-bridge-status.json`),
    ).trim();
    if (outboxDir) {
      mkdirSync(outboxDir, { recursive: true });
      touched.push(outboxDir);
    }
    if (statusFile) {
      mkdirSync(path.dirname(statusFile), { recursive: true });
      touched.push(path.dirname(statusFile));
    }
  }

  if (channelId === 'teams') {
    const statusFile = String(values.statusFile || process.env.TEAMS_STATUS_FILE || path.resolve(projectRoot, 'data', 'runtime', 'teams-status.json')).trim();
    if (statusFile) {
      mkdirSync(path.dirname(statusFile), { recursive: true });
      touched.push(path.dirname(statusFile));
    }
  }

  return touched;
}

function buildApplySummary(channelId: ChannelSetupChannelId, mode: ChannelSetupMode): string {
  switch (channelId) {
    case 'telegram':
      return 'Telegram ficou pronto para configuracao final no .env.';
    case 'discord':
      return mode === 'bridge'
        ? 'Discord bridge-first ficou preparado com secret file e policy base.'
        : 'Discord native ficou pronto para configuracao final no .env.';
    case 'slack':
      return mode === 'native'
        ? 'Slack native ficou pronto para configuracao final no .env.'
        : 'Slack stub local ficou preparado para rollout controlado no runtime.';
    case 'whatsapp':
      if (mode === 'cloud-api') {
        return 'WhatsApp Cloud API ficou pronto para configuracao final no .env.';
      }
      if (mode === 'baileys') {
        return 'WhatsApp Baileys ficou pronto para bootstrap local com session dir persistente.';
      }
      return 'WhatsApp stub local ficou preparado para rollout controlado no runtime.';
    case 'instagram':
      return mode === 'meta-messaging'
        ? 'Instagram Messaging API ficou pronta para configuracao final no .env.'
        : 'Instagram stub local ficou preparado para rollout controlado no runtime.';
    case 'signal':
      return 'Signal bridge ficou preparado para configuracao final do signal-cli.';
    case 'imessage':
      return 'iMessage Mac bridge ficou preparado em modo experimental/read-only.';
    case 'teams':
      return 'Teams Graph/Bot Framework ficou preparado para configuracao final.';
    case 'email':
      return mode === 'smtp-imap'
        ? 'Email SMTP/IMAP ficou preparado como fallback operacional.'
        : 'Email local-outbox ficou preparado como fallback operacional.';
    default:
      return 'Channel prepared.';
  }
}

function buildNextSteps(channelId: ChannelSetupChannelId, mode: ChannelSetupMode): string[] {
  switch (channelId) {
    case 'telegram':
      return [
        'Preencha TELEGRAM_BOT_TOKEN e TELEGRAM_ALLOWED_USER_IDS se ainda estiverem vazios.',
        'Suba o runtime supervisionado e use /start para validar a entrada.',
        'Rode npm run ops:ready para conferir o host oficial depois do bootstrap.',
      ];
    case 'discord':
      return mode === 'bridge'
        ? [
            'Distribua o secret file do bridge com seguranca antes de conectar um relay externo.',
            'Revise guilds, canais e owners permitidos antes do rollout.',
            'Rode npm run test:channels:smoke quando o runtime do Discord estiver ligado.',
          ]
        : [
            'Preencha DISCORD_BOT_TOKEN e as allowlists do Discord antes do rollout.',
            'Revise exposure de slash commands e owners operacionais.',
            'Rode npm run test:channels:smoke para validar o gateway nativo.',
          ];
    case 'slack':
      return mode === 'native'
        ? [
            'Preencha SLACK_BOT_TOKEN e SLACK_SIGNING_SECRET se ainda estiverem vazios.',
            'Aponte o Slack para /api/webhooks/slack e valide a assinatura do webhook.',
            'Rode npm run test:channels:smoke e depois /channels broadcast-test slack.',
          ]
        : [
            'Defina SLACK_ALLOWED_CHANNEL_IDS para os canais que vao receber testes.',
            'Suba o runtime supervisionado para materializar outbox e status locais.',
            'Rode npm run test:channels:smoke para validar o modo stub deste runtime.',
          ];
    case 'whatsapp':
      if (mode === 'cloud-api') {
        return [
          'Preencha WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN e WHATSAPP_WEBHOOK_VERIFY_TOKEN se ainda estiverem vazios.',
          'Registre /api/webhooks/whatsapp como callback da Cloud API e valide o hub.challenge.',
          'Rode npm run test:channels:smoke e depois /channels broadcast-test whatsapp.',
        ];
      }
      if (mode === 'baileys') {
        return [
          'Valide o session dir local antes de ligar o provider Baileys.',
          'Defina WHATSAPP_ALLOWED_CHAT_IDS para os chats do rollout controlado.',
          'Rode npm run test:channels:smoke para validar o modo Baileys neste runtime.',
        ];
      }
      return [
        'Defina WHATSAPP_ALLOWED_CHAT_IDS para os chats que vao receber testes.',
        'Suba o runtime supervisionado para materializar outbox e status locais.',
        'Rode npm run test:channels:smoke para validar o modo stub deste runtime.',
      ];
    case 'instagram':
      return mode === 'meta-messaging'
        ? [
            'Preencha INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN e INSTAGRAM_WEBHOOK_VERIFY_TOKEN se ainda estiverem vazios.',
            'Registre /api/webhooks/instagram como callback da Instagram Messaging API e valide o hub.challenge.',
            'Rode npm run test:channels:smoke e depois /channels broadcast-test instagram.',
          ]
        : [
            'Defina INSTAGRAM_ALLOWED_RECIPIENT_IDS para os recipients que vao receber testes.',
            'Suba o runtime supervisionado para materializar outbox e status locais.',
            'Promova para meta-messaging quando as credenciais oficiais da Meta estiverem prontas.',
          ];
    case 'signal':
      return [
        'Instale/registre signal-cli com uma conta dedicada.',
        'Preencha SIGNAL_ACCOUNT_NUMBER e SIGNAL_ALLOWED_RECIPIENTS.',
        'Rode npm run test:channels:smoke para validar a bridge local.',
      ];
    case 'imessage':
      return [
        'Suba um Node Host macOS e preencha IMESSAGE_NODE_ID.',
        'Mantenha IMESSAGE_READ_ONLY=true ate validar inbound e policy.',
        'Rode npm run test:channels:smoke antes de habilitar envio.',
      ];
    case 'teams':
      return [
        'Crie o app/bot no Azure e preencha tenant, app id e secret.',
        'Configure TEAMS_ALLOWED_CONVERSATION_IDS antes de publicar rollout.',
        'Rode npm run test:channels:smoke para validar o setup local.',
      ];
    case 'email':
      return [
        'Configure EMAIL_ALLOWED_RECIPIENTS para liberar o fallback local-outbox.',
        'Adicione SMTP quando quiser notificacoes outbound reais.',
        'Adicione IMAP quando quiser approvals por resposta de email.',
        'Rode npm run test:channels:smoke para validar o setup local.',
      ];
    default:
      return [];
  }
}

function resolveDiscordBridgeSecretFile(projectRoot: string, candidate: string | undefined): string {
  const normalized = String(candidate || process.env.DISCORD_BRIDGE_SECRET_FILE || '').trim();
  if (normalized) {
    return path.isAbsolute(normalized)
      ? normalized
      : path.resolve(projectRoot, normalized);
  }
  return path.resolve(projectRoot, '.zavorth', 'discord-bridge.secret');
}

function pickValue(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null) {
      return String(candidate);
    }
  }
  return '';
}

function normalizeChannelId(value: string | null | undefined): ChannelSetupChannelId {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'telegram':
    case 'discord':
    case 'slack':
    case 'whatsapp':
    case 'instagram':
    case 'signal':
    case 'imessage':
    case 'teams':
    case 'email':
      return normalized;
    default:
      throw new Error(`Unsupported channel: ${value}.`);
  }
}

function normalizeMode(value: string | null | undefined): ChannelSetupMode {
  const normalized = String(value || '').trim().toLowerCase();
  switch (normalized) {
    case 'native':
    case 'bridge':
    case 'stub':
    case 'local-outbox':
    case 'cloud-api':
    case 'baileys':
    case 'meta-messaging':
    case 'signal-cli':
    case 'mac-bridge':
    case 'graph-bot':
    case 'smtp-imap':
      return normalized;
    default:
      throw new Error(`Modo de canal nao suportado: ${value}.`);
  }
}
