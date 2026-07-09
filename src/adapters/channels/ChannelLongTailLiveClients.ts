import { execFile } from 'child_process';export type ChannelLongTailAdapterFamily =
  | 'webhook'
  | 'bot-http'
  | 'relay-http'
  | 'local-bridge'
  | 'apple-bridge';

export type ChannelLongTailSendInput = {
  channelId: string;
  message: string;
  recipients?: string[];
  threadId?: string | null;
  metadata?: Record<string, unknown>;
};

export type ChannelLongTailSendReceipt = {
  channelId: string;
  family: ChannelLongTailAdapterFamily;
  status: 'sent';
  recipientsCount: number;
  providerConfigured: true;
  liveIo: true;
  secretValuesSerialized: false;
  responseSummary: string;
  sentAt: string;
};

export type WebhookChannelLiveClientConfig = {
  webhookUrl: string;
  authHeaderName?: string | null;
  authToken?: string | null;
  defaultRecipients?: string[];
};

export type BotHttpChannelLiveClientConfig = {
  endpointUrl: string;
  bearerToken?: string | null;
  apiKeyHeaderName?: string | null;
  apiKey?: string | null;
  defaultRecipients?: string[];
};

export type LocalBridgeChannelLiveClientConfig = {
  endpointUrl?: string | null;
  scriptPath?: string | null;
  bridgeToken?: string | null;
  defaultRecipients?: string[];
};

export type ChannelLongTailExecFileImpl = (
  file: string,
  args: string[],
  options: { timeout: number },
) => Promise<{ stdout: string; stderr: string }>;

type ClientRuntime = {
  now?: () => Date;
  fetchImpl?: typeof fetch;
  execFileImpl?: ChannelLongTailExecFileImpl;
};

export class WebhookChannelLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly config: WebhookChannelLiveClientConfig;

  constructor(config: WebhookChannelLiveClientConfig, runtime: ClientRuntime = {}) {
    this.config = {
      ...config,
      defaultRecipients: normalizeList(config.defaultRecipients),
    };
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.webhookUrl);
  }

  public async sendText(input: ChannelLongTailSendInput): Promise<ChannelLongTailSendReceipt> {
    if (!this.fetchImpl) {
      throw new Error('Webhook channel live send requires fetch in the runtime.');
    }
    const message = normalizeMessage(input.message);
    const recipients = this.resolveRecipients(input.recipients);
    if (!this.config.webhookUrl) {
      throw new Error('Webhook channel live send requires a webhook URL.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const authHeaderName = String(this.config.authHeaderName || '').trim();
    const authToken = String(this.config.authToken || '').trim();
    if (authHeaderName && authToken) {
      headers[authHeaderName] = authToken;
    }

    const response = await this.fetchImpl(this.config.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        channelId: input.channelId,
        text: message,
        content: message,
        message,
        recipients,
        threadId: input.threadId || null,
        metadata: input.metadata || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook channel live send failed with HTTP ${response.status}.`);
    }

    return this.receipt(input.channelId, recipients.length, `webhook accepted HTTP ${response.status}`);
  }

  private resolveRecipients(inputRecipients: string[] | undefined): string[] {
    const recipients = normalizeList(inputRecipients);
    return recipients.length > 0 ? recipients : normalizeList(this.config.defaultRecipients);
  }

  private receipt(channelId: string, recipientsCount: number, responseSummary: string): ChannelLongTailSendReceipt {
    return {
      channelId,
      family: 'webhook',
      status: 'sent',
      recipientsCount,
      providerConfigured: true,
      liveIo: true,
      secretValuesSerialized: false,
      responseSummary,
      sentAt: this.now().toISOString(),
    };
  }
}

export class BotHttpChannelLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly config: BotHttpChannelLiveClientConfig;

  constructor(config: BotHttpChannelLiveClientConfig, runtime: ClientRuntime = {}) {
    this.config = {
      ...config,
      defaultRecipients: normalizeList(config.defaultRecipients),
    };
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.endpointUrl && (this.config.bearerToken || this.config.apiKey || true));
  }

  public async sendText(input: ChannelLongTailSendInput): Promise<ChannelLongTailSendReceipt> {
    if (!this.fetchImpl) {
      throw new Error('Bot HTTP channel live send requires fetch in the runtime.');
    }
    const message = normalizeMessage(input.message);
    const recipients = this.resolveRecipients(input.recipients);
    if (!this.config.endpointUrl) {
      throw new Error('Bot HTTP channel live send requires an endpoint URL.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const bearerToken = String(this.config.bearerToken || '').trim();
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }
    const apiKeyHeaderName = String(this.config.apiKeyHeaderName || '').trim();
    const apiKey = String(this.config.apiKey || '').trim();
    if (apiKeyHeaderName && apiKey) {
      headers[apiKeyHeaderName] = apiKey;
    }

    const response = await this.fetchImpl(this.config.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        channelId: input.channelId,
        recipients,
        text: message,
        message,
        threadId: input.threadId || null,
        metadata: input.metadata || {},
      }),
    });

    let payload: Record<string, any> | null = null;
    try {
      payload = await response.json() as Record<string, any>;
    } catch (error: unknown) {payload = null;
    }
    if (!response.ok) {
      const responseMessage = typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`;
      throw new Error(`Bot HTTP channel live send failed: ${responseMessage}`);
    }

    return {
      channelId: input.channelId,
      family: 'bot-http',
      status: 'sent',
      recipientsCount: recipients.length,
      providerConfigured: true,
      liveIo: true,
      secretValuesSerialized: false,
      responseSummary: typeof payload?.id === 'string' ? `accepted:${payload.id}` : `accepted HTTP ${response.status}`,
      sentAt: this.now().toISOString(),
    };
  }

  private resolveRecipients(inputRecipients: string[] | undefined): string[] {
    const recipients = normalizeList(inputRecipients);
    return recipients.length > 0 ? recipients : normalizeList(this.config.defaultRecipients);
  }
}

export class LocalBridgeChannelLiveClient {
  private readonly now: () => Date;
  private readonly fetchImpl: typeof fetch | null;
  private readonly execFileImpl: ChannelLongTailExecFileImpl;
  private readonly family: ChannelLongTailAdapterFamily;
  private readonly config: LocalBridgeChannelLiveClientConfig;

  constructor(
    family: Extract<ChannelLongTailAdapterFamily, 'relay-http' | 'local-bridge' | 'apple-bridge'>,
    config: LocalBridgeChannelLiveClientConfig,
    runtime: ClientRuntime = {},
  ) {
    this.family = family;
    this.config = {
      ...config,
      defaultRecipients: normalizeList(config.defaultRecipients),
    };
    this.now = runtime.now || (() => new Date());
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
    this.execFileImpl = runtime.execFileImpl || defaultExecFile;
  }

  public isConfigured(): boolean {
    return Boolean(this.config.endpointUrl || this.config.scriptPath);
  }

  public async sendText(input: ChannelLongTailSendInput): Promise<ChannelLongTailSendReceipt> {
    const message = normalizeMessage(input.message);
    const recipients = this.resolveRecipients(input.recipients);
    if (recipients.length === 0) {
      throw new Error('Local bridge channel live send requires at least one allowed recipient.');
    }
    if (this.config.endpointUrl) {
      await this.sendViaEndpoint(input.channelId, recipients, message, input);
    } else if (this.config.scriptPath) {
      await this.sendViaScript(input.channelId, recipients, message);
    } else {
      throw new Error('Local bridge channel live send requires endpointUrl or scriptPath.');
    }

    return {
      channelId: input.channelId,
      family: this.family,
      status: 'sent',
      recipientsCount: recipients.length,
      providerConfigured: true,
      liveIo: true,
      secretValuesSerialized: false,
      responseSummary: `${this.family} accepted ${recipients.length} recipient(s).`,
      sentAt: this.now().toISOString(),
    };
  }

  private async sendViaEndpoint(
    channelId: string,
    recipients: string[],
    message: string,
    input: ChannelLongTailSendInput,
  ): Promise<void> {
    if (!this.fetchImpl) {
      throw new Error('Local bridge endpoint send requires fetch in the runtime.');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const bridgeToken = String(this.config.bridgeToken || '').trim();
    if (bridgeToken) {
      headers.Authorization = `Bearer ${bridgeToken}`;
    }
    const response = await this.fetchImpl(String(this.config.endpointUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        channelId,
        recipients,
        text: message,
        message,
        threadId: input.threadId || null,
        metadata: input.metadata || {},
      }),
    });
    if (!response.ok) {
      throw new Error(`Local bridge endpoint send failed with HTTP ${response.status}.`);
    }
  }

  private async sendViaScript(channelId: string, recipients: string[], message: string): Promise<void> {
    await this.execFileImpl(String(this.config.scriptPath), [
      '--channel',
      channelId,
      '--recipients',
      recipients.join(','),
      '--message',
      message,
    ], { timeout: 30_000 });
  }

  private resolveRecipients(inputRecipients: string[] | undefined): string[] {
    const recipients = normalizeList(inputRecipients);
    return recipients.length > 0 ? recipients : normalizeList(this.config.defaultRecipients);
  }
}

function normalizeMessage(value: string): string {
  const message = String(value || '').trim();
  if (!message) {
    throw new Error('Channel long-tail live send requires a non-empty message.');
  }
  return message;
}

function normalizeList(values: string[] | null | undefined): string[] {
  return (values || [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function defaultExecFile(
  file: string,
  args: string[],
  options: { timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: String(stdout || ''),
        stderr: String(stderr || ''),
      });
    });
  });
}
