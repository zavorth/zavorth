import fs from 'fs';
import path from 'path';
import type {
  IntegrationManifest,
  IntegrationRequirement,
} from '../../../../contracts/IntegrationHubContract.js';
import { config } from '../../../../config/index.js';

import type { IntegrationInstallerService } from '../../../../services/IntegrationInstallerService.js';

type IntegrationActionRuntimeBindingRuntime = {
  installerService: Pick<IntegrationInstallerService, 'getInstalled' | 'getStoredSecretValue'>;
  envFilePath: string;
  mkdirSync: typeof fs.mkdirSync;
  writeFileSync: typeof fs.writeFileSync;
};

export class IntegrationActionRuntimeBindingSupport {
  private readonly installerService: Pick<IntegrationInstallerService, 'getInstalled' | 'getStoredSecretValue'>;
  private readonly envFilePath: string;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  constructor(runtime: IntegrationActionRuntimeBindingRuntime) {
    this.installerService = runtime.installerService;
    this.envFilePath = runtime.envFilePath;
    this.mkdirSyncImpl = runtime.mkdirSync;
    this.writeFileSyncImpl = runtime.writeFileSync;
  }

  public getRepairableRequirements(manifest: IntegrationManifest): IntegrationRequirement[] {
    return manifest.requirements.filter((entry) => {
      const envKey = String(entry.envKey || '').trim();
      if (entry.type !== 'env' || !envKey) {
        return false;
      }
      if (String(process.env[envKey] || '').trim()) {
        return false;
      }
      if (entry.secret) {
        const storedValue = this.installerService.getStoredSecretValue(manifest.id, entry.id);
        return Boolean(String(storedValue || '').trim());
      }

      const installed = this.installerService.getInstalled(manifest.id);
      const answerValue = installed?.answers?.[entry.id];
      if (typeof answerValue === 'string') {
        return Boolean(answerValue.trim());
      }
      if (Array.isArray(answerValue)) {
        return answerValue.some((item) => String(item || '').trim());
      }
      if (typeof answerValue === 'boolean') {
        return true;
      }
      return false;
    });
  }

  public applyStoredSecretsToRuntime(manifest: IntegrationManifest): string[] {
    const appliedEnvKeys: string[] = [];
    const installed = this.installerService.getInstalled(manifest.id);
    for (const requirement of this.getRepairableRequirements(manifest)) {
      const envKey = String(requirement.envKey || '').trim();
      const nextValue = requirement.secret
        ? this.installerService.getStoredSecretValue(manifest.id, requirement.id)
        : this.normalizeRuntimeBindingValue(installed?.answers?.[requirement.id]);
      if (!envKey || nextValue === null) {
        continue;
      }

      this.applyRuntimeBinding(envKey, nextValue);
      appliedEnvKeys.push(envKey);
    }

    return Array.from(new Set(appliedEnvKeys));
  }

  public applyRuntimeBinding(envKey: string, value: string): void {
    this.upsertEnvValue(envKey, value);
    process.env[envKey] = value;
    this.syncConfigValue(envKey, value);
  }

  private upsertEnvValue(envKey: string, value: string): void {
    const normalizedKey = String(envKey || '').trim();
    if (!normalizedKey) {
      return;
    }

    const serializedValue = this.serializeEnvValue(value);
    const nextLine = `${normalizedKey}=${serializedValue}`;
    const existingText = fs.existsSync(this.envFilePath)
      ? fs.readFileSync(this.envFilePath, 'utf8')
      : '';
    const lines = existingText ? existingText.split(/\r?\n/) : [];
    const matcher = new RegExp(`^\\s*${normalizedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=`);
    const index = lines.findIndex((line) => matcher.test(line));

    if (index >= 0) {
      lines[index] = nextLine;
    } else {
      lines.push(nextLine);
    }

    const nextText = lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
    this.mkdirSyncImpl(path.dirname(this.envFilePath), { recursive: true });
    this.writeFileSyncImpl(this.envFilePath, nextText, 'utf8');
  }

  private serializeEnvValue(value: string): string {
    const normalized = String(value || '');
    if (!normalized) {
      return '""';
    }
    if (/^[A-Za-z0-9._\-/:=+]+$/.test(normalized)) {
      return normalized;
    }
    return `"${normalized
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/"/g, '\\"')}"`;
  }

  private normalizeRuntimeBindingValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized ? normalized : null;
    }
    if (Array.isArray(value)) {
      const normalized = value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .join(',');
      return normalized || null;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    return null;
  }

  private syncConfigValue(envKey: string, value: string): void {
    const runtimeConfig = config as Record<string, unknown>;
    switch (envKey) {
      case 'TELEGRAM_BOT_TOKEN':
        runtimeConfig.telegramBotToken = value;
        break;
      case 'TELEGRAM_ALLOWED_USER_IDS':
        runtimeConfig.allowedUserIds = value.split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case 'DISCORD_ALLOWED_CHANNEL_IDS':
        runtimeConfig.discordAllowedChannelIds = value.split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case 'DISCORD_ALLOW_DMS':
        runtimeConfig.discordAllowDms = value.toLowerCase() === 'true';
        break;
      case 'GEMINI_API_KEY':
        runtimeConfig.geminiApiKey = value;
        runtimeConfig.geminiApiKeys = Array.from(new Set([
          value,
          ...(Array.isArray(runtimeConfig.geminiApiKeys) ? runtimeConfig.geminiApiKeys as string[] : []),
        ].filter(Boolean)));
        break;
      case 'AISTUDIO_API_KEY':
        runtimeConfig.aiStudioApiKey = value;
        break;
      case 'OPENAI_API_KEY':
        runtimeConfig.openaiApiKey = value;
        break;
      case 'MINIMAX_API_KEY':
        runtimeConfig.minimaxApiKey = value;
        break;
      case 'MINIMAX_MODEL':
        runtimeConfig.minimaxModel = value;
        break;
      case 'MINIMAX_BASE_URL':
        runtimeConfig.minimaxBaseUrl = value;
        break;
      case 'OPENROUTER_API_KEY':
        runtimeConfig.openRouterApiKey = value;
        break;
      case 'OPENCODE_API_KEY':
        runtimeConfig.openCodeApiKey = value;
        break;
      case 'AIGateway_API_KEY':
        runtimeConfig.AIGatewayApiKey = value;
        break;
      case 'PUTER_AUTH_TOKEN':
      case 'QWEN_PUTER_AUTH_TOKEN':
        runtimeConfig.puterAuthToken = value;
        break;
      case 'OLLAMA_HOST':
      case 'OLLAMA_BASE_URL':
        runtimeConfig.ollamaBaseUrl = value;
        break;
      case 'DISCORD_BOT_TOKEN':
        runtimeConfig.discordBotToken = value;
        break;
      case 'DISCORD_ALLOWED_GUILD_IDS':
        runtimeConfig.discordAllowedGuildIds = value.split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case 'DISCORD_OWNER_USER_IDS':
        runtimeConfig.discordOwnerUserIds = value.split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case 'DISCORD_PUBLIC_SERVER_MODE':
        runtimeConfig.discordPublicServerMode = value.toLowerCase() === 'true';
        break;
      case 'DISCORD_COMMAND_EXPOSURE':
        runtimeConfig.discordCommandExposure = value;
        break;
      case 'SLACK_ENABLED':
        runtimeConfig.slackEnabled = value.toLowerCase() === 'true';
        break;
      case 'SLACK_TRANSPORT':
        runtimeConfig.slackTransport = value;
        break;
      case 'SLACK_BOT_TOKEN':
        runtimeConfig.slackBotToken = value;
        break;
      case 'SLACK_SIGNING_SECRET':
        runtimeConfig.slackSigningSecret = value;
        break;
      case 'SLACK_WORKSPACE_ID':
        runtimeConfig.slackWorkspaceId = value;
        break;
      case 'SLACK_API_BASE_URL':
        runtimeConfig.slackApiBaseUrl = value;
        break;
      case 'SLACK_ALLOWED_CHANNEL_IDS':
        runtimeConfig.slackAllowedChannelIds = value.split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case 'WHATSAPP_ENABLED':
        runtimeConfig.whatsappEnabled = value.toLowerCase() === 'true';
        break;
      case 'WHATSAPP_PROVIDER':
        runtimeConfig.whatsappProvider = value;
        break;
      case 'WHATSAPP_CLOUD_API_VERSION':
        runtimeConfig.whatsappCloudApiVersion = value;
        break;
      case 'WHATSAPP_ALLOWED_CHAT_IDS':
        runtimeConfig.whatsappAllowedChatIds = value.split(',').map((entry) => entry.trim()).filter(Boolean);
        break;
      case 'WHATSAPP_PHONE_NUMBER_ID':
        runtimeConfig.whatsappPhoneNumberId = value;
        break;
      case 'WHATSAPP_ACCESS_TOKEN':
        runtimeConfig.whatsappAccessToken = value;
        break;
      case 'WHATSAPP_WEBHOOK_VERIFY_TOKEN':
        runtimeConfig.whatsappWebhookVerifyToken = value;
        break;
      case 'WHATSAPP_SESSION_DIR':
        runtimeConfig.whatsappSessionDir = value;
        break;
      default:
        break;
    }
  }
}
