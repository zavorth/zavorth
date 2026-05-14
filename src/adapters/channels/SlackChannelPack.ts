import { WebClient } from '@slack/web-api';
import type {
  ChannelRuntimeReceipt,
} from '../../contracts/SourceChannelMeshExpansionContract.js';
import { SourceChannelSecretPolicyService } from '../../services/SourceChannelSecretPolicyService.js';

export type SlackChannelPackOptions = {
  botToken?: string | null;
  allowedChannelIds?: string[];
  client?: SlackWebApiLikeClient;
  now?: () => Date;
};

export type SlackLiveSmokeInput = {
  channelId: string;
  text?: string;
  confirmLiveIo?: boolean;
};

type SlackWebApiLikeClient = {
  chat: {
    postMessage(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

export class SlackChannelPack {
  private readonly botToken: string;
  private readonly allowedChannelIds: string[];
  private readonly injectedClient: SlackWebApiLikeClient | null;
  private readonly now: () => Date;

  constructor(options: SlackChannelPackOptions = {}) {
    this.botToken = String(options.botToken || process.env.SLACK_BOT_TOKEN || '').trim();
    this.allowedChannelIds = normalizeList(options.allowedChannelIds || splitEnv(process.env.SLACK_ALLOWED_CHANNEL_IDS));
    this.injectedClient = options.client || null;
    this.now = options.now || (() => new Date());
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken && this.allowedChannelIds.length > 0);
  }

  public buildSecretPolicy() {
    return new SourceChannelSecretPolicyService().buildReceipt({
      channelId: 'slack',
      requiredSecretRefs: ['SLACK_BOT_TOKEN'],
      optionalSecretRefs: ['SLACK_SIGNING_SECRET', 'SLACK_WORKSPACE_ID'],
      allowlistRefs: ['SLACK_ALLOWED_CHANNEL_IDS'],
    });
  }

  public async runLiveSmoke(input: SlackLiveSmokeInput): Promise<ChannelRuntimeReceipt> {
    if (input.confirmLiveIo !== true) {
      return this.receipt('blocked', null, null, 'Slack live smoke requires explicit --confirm-live-io.');
    }
    if (!this.isConfigured() && !this.injectedClient) {
      return this.receipt('blocked', null, null, 'Slack live smoke requires SLACK_BOT_TOKEN and SLACK_ALLOWED_CHANNEL_IDS.');
    }
    if (!this.allowedChannelIds.includes(input.channelId) && !this.injectedClient) {
      return this.receipt('blocked', null, null, 'Slack channel is not in SLACK_ALLOWED_CHANNEL_IDS.');
    }

    const response = await this.client().chat.postMessage({
      channel: input.channelId,
      text: String(input.text || 'Zavorth Phase 4 Slack live smoke').trim(),
      unfurl_links: false,
      unfurl_media: false,
    });
    const message = asRecord(response.message);
    const ts = String(response.ts || message?.ts || '').trim();
    return this.receipt('applied', ts || null, ts || null, 'Slack Web API postMessage returned a receipt.');
  }

  private client(): SlackWebApiLikeClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    return new WebClient(this.botToken) as unknown as SlackWebApiLikeClient;
  }

  private receipt(
    status: ChannelRuntimeReceipt['status'],
    messageId: string | null,
    threadId: string | null,
    reason: string,
  ): ChannelRuntimeReceipt {
    return {
      id: `slack-live-smoke-${this.now().toISOString()}`,
      channelId: 'slack',
      action: 'send',
      status,
      messageId,
      threadId,
      liveIoPerformed: status === 'applied',
      secretValuesSerialized: false,
      reason,
    };
  }
}

function splitEnv(value: unknown): string[] {
  return String(value || '').split(/[,;\n]/g);
}

function normalizeList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
