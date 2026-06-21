import { config } from '../../config/index.js';

export type TeamsGraphBotClientConfig = {
  tenantId: string;
  appId: string;
  appSecret: string;
  allowedConversationIds: string[];
  graphBaseUrl: string;
};

export type TeamsTextSendInput = {
  conversationId: string;
  message: string;
  attachments?: Array<Record<string, unknown>>;
};

export type TeamsTextSendReceipt = {
  channelId: 'msteams';
  transport: 'microsoft-graph';
  status: 'sent' | 'edited';
  conversationIdRedacted: string;
  providerConfigured: true;
  liveIo: true;
  secretValuesSerialized: false;
  responseId: string | null;
  sentAt: string;
};

type TeamsGraphBotClientRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  settings?: Partial<TeamsGraphBotClientConfig>;
};

export class TeamsGraphBotClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly settings: TeamsGraphBotClientConfig;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(runtime: TeamsGraphBotClientRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
    this.settings = {
      tenantId: String(runtime.settings?.tenantId ?? config.teamsTenantId ?? '').trim(),
      appId: String(runtime.settings?.appId ?? config.teamsAppId ?? '').trim(),
      appSecret: String(
        runtime.settings?.appSecret
        ?? (config.teamsClientSecret || config.teamsAppPassword || '')
      ).trim(),
      allowedConversationIds: (
        runtime.settings?.allowedConversationIds
        ?? config.teamsAllowedConversationIds
        ?? []
      )
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
      graphBaseUrl: String(runtime.settings?.graphBaseUrl ?? 'https://graph.microsoft.com/v1.0')
        .trim()
        .replace(/\/+$/, ''),
    };
  }

  public isConfigured(): boolean {
    return Boolean(
      this.settings.tenantId
      && this.settings.appId
      && this.settings.appSecret
      && this.settings.allowedConversationIds.length > 0,
    );
  }

  public doctor(): {
    channelId: 'msteams';
    status: 'passed' | 'missing-config';
    requiredConfig: string[];
    configuredConfig: string[];
    secretValuesSerialized: false;
  } {
    const configuredConfig: string[] = [];
    if (this.settings.tenantId) {
      configuredConfig.push('TEAMS_TENANT_ID');
    }
    if (this.settings.appId) {
      configuredConfig.push('TEAMS_APP_ID');
    }
    if (this.settings.appSecret) {
      configuredConfig.push('TEAMS_CLIENT_SECRET or TEAMS_APP_PASSWORD');
    }
    if (this.settings.allowedConversationIds.length > 0) {
      configuredConfig.push('TEAMS_ALLOWED_CONVERSATION_IDS');
    }

    return {
      channelId: 'msteams',
      status: this.isConfigured() ? 'passed' : 'missing-config',
      requiredConfig: [
        'TEAMS_TENANT_ID',
        'TEAMS_APP_ID',
        'TEAMS_CLIENT_SECRET or TEAMS_APP_PASSWORD',
        'TEAMS_ALLOWED_CONVERSATION_IDS',
      ],
      configuredConfig,
      secretValuesSerialized: false,
    };
  }

  public async sendText(input: TeamsTextSendInput): Promise<TeamsTextSendReceipt> {
    const message = String(input.message || '').trim();
    const conversationId = this.normalizeConversationId(input.conversationId);
    if (!message) {
      throw new Error('Teams live send requires a non-empty message.');
    }
    if (!conversationId) {
      throw new Error('Teams live send requires a conversation id.');
    }
    this.assertAllowedConversation(conversationId);

    const payload = await this.callGraph(
      `/chats/${encodeURIComponent(conversationId)}/messages`,
      'POST',
      {
        body: {
          contentType: 'text',
          content: message,
        },
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      },
    );

    return this.receipt('sent', conversationId, payload);
  }

  public async replyText(input: TeamsTextSendInput & { replyToMessageId?: string | null }): Promise<TeamsTextSendReceipt> {
    const replyToMessageId = String(input.replyToMessageId || '').trim();
    if (!replyToMessageId) {
      return this.sendText(input);
    }
    const message = String(input.message || '').trim();
    const conversationId = this.normalizeConversationId(input.conversationId);
    if (!message) {
      throw new Error('Teams live reply requires a non-empty message.');
    }
    if (!conversationId) {
      throw new Error('Teams live reply requires a conversation id.');
    }
    this.assertAllowedConversation(conversationId);

    const payload = await this.callGraph(
      `/chats/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(replyToMessageId)}/replies`,
      'POST',
      {
        body: {
          contentType: 'text',
          content: message,
        },
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      },
    );
    return this.receipt('sent', conversationId, payload);
  }

  public async editText(input: TeamsTextSendInput & { messageId: string }): Promise<TeamsTextSendReceipt> {
    const message = String(input.message || '').trim();
    const conversationId = this.normalizeConversationId(input.conversationId);
    const messageId = String(input.messageId || '').trim();
    if (!message || !conversationId || !messageId) {
      throw new Error('Teams live edit requires conversation id, message id and text.');
    }
    this.assertAllowedConversation(conversationId);

    const payload = await this.callGraph(
      `/chats/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      'PATCH',
      {
        body: {
          contentType: 'text',
          content: message,
        },
      },
    );
    return this.receipt('edited', conversationId, payload);
  }

  private async callGraph(
    path: string,
    method: 'POST' | 'PATCH',
    body: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    if (!this.fetchImpl) {
      throw new Error('Teams Graph live send requires fetch in the runtime.');
    }
    if (!this.isConfigured()) {
      throw new Error('Teams Graph live send requires tenant, app, secret and allowed conversations.');
    }

    const token = await this.getAccessToken();
    const response = await this.fetchImpl(`${this.settings.graphBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let payload: Record<string, any> | null = null;
    try {
      payload = await response.json() as Record<string, any>;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const responseMessage = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `HTTP ${response.status}`;
      throw new Error(`Teams Graph request failed: ${responseMessage}`);
    }

    return payload || { ok: true };
  }

  private async getAccessToken(): Promise<string> {
    const nowMs = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > nowMs + 30_000) {
      return this.cachedToken.value;
    }
    if (!this.fetchImpl) {
      throw new Error('Teams Graph token request requires fetch in the runtime.');
    }

    const response = await this.fetchImpl(
      `https://login.microsoftonline.com/${encodeURIComponent(this.settings.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.settings.appId,
          client_secret: this.settings.appSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );

    let payload: Record<string, any> | null = null;
    try {
      payload = await response.json() as Record<string, any>;
    } catch {
      payload = null;
    }

    if (!response.ok || typeof payload?.access_token !== 'string') {
      const responseMessage = typeof payload?.error_description === 'string'
        ? payload.error_description
        : `HTTP ${response.status}`;
      throw new Error(`Teams Graph token request failed: ${responseMessage}`);
    }

    const expiresIn = Number(payload.expires_in || 3600);
    this.cachedToken = {
      value: payload.access_token,
      expiresAt: nowMs + Math.max(60, expiresIn) * 1000,
    };
    return this.cachedToken.value;
  }

  private assertAllowedConversation(conversationId: string): void {
    if (!this.settings.allowedConversationIds.includes(conversationId)) {
      throw new Error('Teams conversation id is not in TEAMS_ALLOWED_CONVERSATION_IDS.');
    }
  }

  private normalizeConversationId(value: string): string {
    return String(value || '').trim();
  }

  private receipt(
    status: 'sent' | 'edited',
    conversationId: string,
    payload: Record<string, any>,
  ): TeamsTextSendReceipt {
    return {
      channelId: 'msteams',
      transport: 'microsoft-graph',
      status,
      conversationIdRedacted: redactConversationId(conversationId),
      providerConfigured: true,
      liveIo: true,
      secretValuesSerialized: false,
      responseId: typeof payload.id === 'string' ? payload.id : null,
      sentAt: this.now().toISOString(),
    };
  }
}

function redactConversationId(value: string): string {
  const normalized = String(value || '').trim();
  if (normalized.length <= 8) {
    return normalized ? '[redacted]' : '';
  }
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}
