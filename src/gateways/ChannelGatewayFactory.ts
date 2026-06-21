import type { ZavorthConfig } from '../config/index.js';
import { config } from '../config/index.js';
import { GatewayEventBus } from '../gateway/events/GatewayEventBus.js';
import { ChannelPolicyManager } from '../channels/policies/ChannelPolicyManager.js';
import { SecurityAuditLogger } from '../services/SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import type { WebhookGateway, WebhookGatewayOptions } from './WebhookGateway.js';
import { ChannelGatewayRegistry } from './ChannelGatewayRegistry.js';

import { MatrixGateway } from './MatrixGateway.js';
import { LineGateway } from './LineGateway.js';
import { GoogleChatGateway } from './GoogleChatGateway.js';
import { FeishuGateway } from './FeishuGateway.js';
import { IrcGateway } from './IrcGateway.js';
import { QQGateway } from './QQGateway.js';
import { ZaloGateway } from './ZaloGateway.js';
import { WeComGateway } from './WeComGateway.js';
import { WeixinGateway } from './WeixinGateway.js';
import { YuanbaoGateway } from './YuanbaoGateway.js';
import { SmsGateway } from './SmsGateway.js';
import { HomeAssistantGateway } from './HomeAssistantGateway.js';
import { VoiceCallGateway } from './VoiceCallGateway.js';
import { GoogleMeetGateway } from './GoogleMeetGateway.js';
import { TwitchGateway } from './TwitchGateway.js';
import { NextcloudTalkGateway } from './NextcloudTalkGateway.js';
import { MattermostGateway } from './MattermostGateway.js';
import { SynologyChatGateway } from './SynologyChatGateway.js';
import { ClickClackGateway } from './ClickClackGateway.js';
import { NostrGateway } from './NostrGateway.js';
import { TelegramGateway } from './TelegramGateway.js';
import { DiscordGateway } from './DiscordGateway.js';
import { SlackGateway } from './SlackGateway.js';
import { WhatsAppGateway } from './WhatsAppGateway.js';
import { SignalGateway } from './SignalGateway.js';
import { IMessageGateway } from './IMessageGateway.js';
import { TeamsGateway } from './TeamsGateway.js';
import { EmailGateway } from './EmailGateway.js';
import { InstagramGateway } from './InstagramGateway.js';

type GatewayClass = new (options: WebhookGatewayOptions) => WebhookGateway;

type GatewayRegistration = {
  id: string;
  GatewayClass: GatewayClass;
  isConfigured: () => boolean;
};

const GATEWAY_REGISTRATIONS: GatewayRegistration[] = [
  {
    id: 'matrix',
    GatewayClass: MatrixGateway,
    isConfigured: () => Boolean(String(config.matrixBaseUrl || '').trim() && String(config.matrixAccessToken || '').trim()),
  },
  {
    id: 'line',
    GatewayClass: LineGateway,
    isConfigured: () => Boolean(String(config.lineChannelAccessToken || '').trim()),
  },
  {
    id: 'google-chat',
    GatewayClass: GoogleChatGateway,
    isConfigured: () => Boolean(String(config.googleChatWebhookUrl || '').trim()),
  },
  {
    id: 'feishu',
    GatewayClass: FeishuGateway,
    isConfigured: () => Boolean(String(config.feishuWebhookUrl || '').trim()),
  },
  {
    id: 'irc',
    GatewayClass: IrcGateway,
    isConfigured: () => Boolean(String(config.ircBridgeUrl || '').trim() || String(config.ircWebhookUrl || '').trim() || String(config.ircScriptPath || '').trim()),
  },
  {
    id: 'qq',
    GatewayClass: QQGateway,
    isConfigured: () => Boolean(String(config.qqBotWebhookUrl || '').trim() || String(config.qqSendUrl || '').trim()),
  },
  {
    id: 'zalo',
    GatewayClass: ZaloGateway,
    isConfigured: () => Boolean(String(config.zaloSendUrl || '').trim() && String(config.zaloAccessToken || '').trim()),
  },
  {
    id: 'wecom',
    GatewayClass: WeComGateway,
    isConfigured: () => Boolean(String(config.wecomWebhookUrl || '').trim()),
  },
  {
    id: 'weixin',
    GatewayClass: WeixinGateway,
    isConfigured: () => Boolean(String(config.weixinBridgeUrl || '').trim() || String(config.weixinBridgeScript || '').trim()),
  },
  {
    id: 'yuanbao',
    GatewayClass: YuanbaoGateway,
    isConfigured: () => Boolean(String(config.yuanbaoBridgeUrl || '').trim() || String(config.yuanbaoBridgeScript || '').trim()),
  },
  {
    id: 'sms',
    GatewayClass: SmsGateway,
    isConfigured: () => Boolean((String(config.smsSendUrl || '').trim() || String(config.smsApiBaseUrl || '').trim()) && String(config.smsProviderToken || '').trim()),
  },
  {
    id: 'home-assistant',
    GatewayClass: HomeAssistantGateway,
    isConfigured: () => Boolean(String(config.homeAssistantWebhookUrl || '').trim() || (String(config.homeAssistantUrl || '').trim() && String(config.homeAssistantToken || '').trim())),
  },
  {
    id: 'voice-call',
    GatewayClass: VoiceCallGateway,
    isConfigured: () => Boolean(String(config.voiceCallBridgeUrl || '').trim() || String(config.voiceCallBridgeScript || '').trim()),
  },
  {
    id: 'google-meet',
    GatewayClass: GoogleMeetGateway,
    isConfigured: () => Boolean(String(config.googleMeetBridgeUrl || '').trim() || String(config.googleMeetBridgeScript || '').trim()),
  },
  {
    id: 'twitch',
    GatewayClass: TwitchGateway,
    isConfigured: () => Boolean(String(config.twitchBridgeUrl || '').trim() || String(config.twitchWebhookUrl || '').trim() || String(config.twitchScriptPath || '').trim()),
  },
  {
    id: 'nextcloud-talk',
    GatewayClass: NextcloudTalkGateway,
    isConfigured: () => Boolean(String(config.nextcloudTalkWebhookUrl || '').trim()),
  },
  {
    id: 'mattermost',
    GatewayClass: MattermostGateway,
    isConfigured: () => Boolean(String(config.mattermostWebhookUrl || '').trim()),
  },
  {
    id: 'synology-chat',
    GatewayClass: SynologyChatGateway,
    isConfigured: () => Boolean(String(config.synologyChatWebhookUrl || '').trim()),
  },
  {
    id: 'clickclack',
    GatewayClass: ClickClackGateway,
    isConfigured: () => Boolean(String(config.clickclackWebhookUrl || '').trim()),
  },
  {
    id: 'nostr',
    GatewayClass: NostrGateway,
    isConfigured: () => Boolean(String(config.nostrBridgeUrl || '').trim()),
  },
  {
    id: 'telegram',
    GatewayClass: TelegramGateway,
    isConfigured: () => Boolean(String((config as any).telegramBotToken || '').trim() && String((config as any).telegramDefaultChatId || '').trim()),
  },
  {
    id: 'discord',
    GatewayClass: DiscordGateway,
    isConfigured: () => Boolean(String((config as any).discordWebhookUrl || '').trim()),
  },
  {
    id: 'slack',
    GatewayClass: SlackGateway,
    isConfigured: () => Boolean(String((config as any).slackWebhookUrl || '').trim()),
  },
  {
    id: 'whatsapp',
    GatewayClass: WhatsAppGateway,
    isConfigured: () => Boolean(String((config as any).whatsappBridgeUrl || '').trim() || String((config as any).whatsappWebhookUrl || '').trim()),
  },
  {
    id: 'signal',
    GatewayClass: SignalGateway,
    isConfigured: () => Boolean(String(config.signalJsonRpcUrl || '').trim() || String(config.signalCliPath || '').trim()),
  },
  {
    id: 'imessage',
    GatewayClass: IMessageGateway,
    isConfigured: () => Boolean(String((config as any).imessageBridgeUrl || '').trim() || String(config.imessageBridgeScript || '').trim()),
  },
  {
    id: 'teams',
    GatewayClass: TeamsGateway,
    isConfigured: () => Boolean(String((config as any).teamsWebhookUrl || '').trim()),
  },
  {
    id: 'email',
    GatewayClass: EmailGateway,
    isConfigured: () => Boolean(String(config.emailSmtpHost || '').trim() || String(config.emailImapHost || '').trim()),
  },
  {
    id: 'instagram',
    GatewayClass: InstagramGateway,
    isConfigured: () => Boolean(String(config.instagramAccessToken || '').trim()),
  },
];

export class ChannelGatewayFactory {
  static createFromId(channelId: string, options?: Partial<WebhookGatewayOptions>): WebhookGateway | null {
    const normalized = String(channelId || '').trim().toLowerCase();
    const registration = GATEWAY_REGISTRATIONS.find((entry) => entry.id === normalized);
    if (!registration) {
      return null;
    }
    const baseOptions = ChannelGatewayFactory.buildBaseOptions(options);
    return new registration.GatewayClass(baseOptions);
  }

  static createAll(options?: Partial<WebhookGatewayOptions>): ChannelGatewayRegistry {
    const registry = new ChannelGatewayRegistry();
    const baseOptions = ChannelGatewayFactory.buildBaseOptions(options);

    for (const registration of GATEWAY_REGISTRATIONS) {
      try {
        const gateway = new registration.GatewayClass(baseOptions);
        registry.registerGateway(gateway);
      } catch {
        // Gateway construction failed; skip silently
      }
    }

    return registry;
  }

  static createConfigured(options?: Partial<WebhookGatewayOptions>): ChannelGatewayRegistry {
    const registry = new ChannelGatewayRegistry();
    const baseOptions = ChannelGatewayFactory.buildBaseOptions(options);

    for (const registration of GATEWAY_REGISTRATIONS) {
      if (!registration.isConfigured()) {
        continue;
      }
      try {
        const gateway = new registration.GatewayClass(baseOptions);
        registry.registerGateway(gateway);
      } catch {
        // Gateway construction failed; skip silently
      }
    }

    return registry;
  }

  static listSupportedChannelIds(): string[] {
    return GATEWAY_REGISTRATIONS.map((entry) => entry.id);
  }

  private static buildBaseOptions(overrides?: Partial<WebhookGatewayOptions>): WebhookGatewayOptions {
    return {
      eventBus: overrides?.eventBus || new GatewayEventBus(),
      policyManager: overrides?.policyManager || new ChannelPolicyManager(),
      auditLogger: overrides?.auditLogger || new SecurityAuditLogger(overrides?.logRepo || new LogRepository()),
      logRepo: overrides?.logRepo,
      now: overrides?.now,
      outboxDir: overrides?.outboxDir,
      statusFile: overrides?.statusFile,
      fetchImpl: overrides?.fetchImpl,
    };
  }
}
