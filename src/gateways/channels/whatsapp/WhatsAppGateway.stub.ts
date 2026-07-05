import fs from 'fs';
import path from 'path';
import { toDataURL } from 'qrcode';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';
import { logger } from '../../../logger.js';

interface CloudApiSendResult {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  ok?: boolean;
  error?: string | CloudApiErrorDetail;
}

interface CloudApiErrorDetail {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

// Cloud API webhook message structure
interface CloudApiWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: {
    type?: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  [key: string]: unknown;
}

export interface WhatsAppGatewayStubMessage {
  userId: string;
  chatId: string;
  rawText: string;
  isGroup?: boolean;
}

type WhatsAppGatewayRuntime = {
  fetchImpl?: typeof fetch;
};

export type WhatsAppLoginQrState =
  | 'unsupported'
  | 'not_requested'
  | 'pending'
  | 'ready'
  | 'expired'
  | 'connected'
  | 'error';

export type WhatsAppLoginQrSnapshot = {
  supported: boolean;
  state: WhatsAppLoginQrState;
  source: string | null;
  dataUrl: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  nextStep: string;
};

export type WhatsAppLoginQrReceipt = {
  ok: boolean;
  status: 'ready' | 'pending' | 'unsupported' | 'connected' | 'error';
  summary: string;
  details: string[];
  loginQr: WhatsAppLoginQrSnapshot;
};

export type WhatsAppLifecycleActionReceipt = {
  ok: boolean;
  status: 'applied' | 'manual';
  summary: string;
  details: string[];
  receiptFile?: string | null;
};

export type WhatsAppLifecycleState =
  | 'stopped'
  | 'awaiting_qr'
  | 'linked'
  | 'connected'
  | 'unconfigured'
  | 'error';

export type WhatsAppRecipientPolicySnapshot = {
  state: 'allowlist' | 'empty';
  allowedCount: number;
  allowlistConfigured: boolean;
  summary: string;
};

export type WhatsAppLocalBridgeSnapshot = {
  provider: 'stub' | 'baileys';
  sessionDir: string | null;
  sessionDirConfigured: boolean;
  qrFile: string | null;
  qrState: WhatsAppLoginQrState;
  baileysReady: boolean;
  nextStep: string;
};

export type WhatsAppGatewayStatusSnapshot = {
  mode: 'stub' | 'cloud-api' | 'baileys';
  enabled: boolean;
  started: boolean;
  running: boolean;
  linked: boolean;
  connected: boolean;
  recipientsConfigured: number;
  allowedChatIds: string[];
  provider: 'stub' | 'cloud-api' | 'baileys';
  providerModeLabel: string;
  providerConfigured: boolean;
  providerDecision: string;
  sessionDir: string | null;
  sessionDirConfigured: boolean;
  phoneNumberId: string | null;
  webhookConfigured: boolean;
  webhookStatus: 'configured' | 'missing' | 'not_applicable';
  lifecycleState: WhatsAppLifecycleState;
  recipientPolicy: WhatsAppRecipientPolicySnapshot;
  localBridge: WhatsAppLocalBridgeSnapshot | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastStartAt: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  authAgeMs: number | null;
  loginQr: WhatsAppLoginQrSnapshot;
  updatedAt: string;
};

export class WhatsAppGateway implements LiveChannelBroadcastGatewayContract {
  public readonly platform: PlatformKey = 'whatsapp';
  public readonly supportsRoleAwareBroadcast = false;

  private broker: IMessageBroker | null;
  private started = false;
  private lastStartAt: string | null = null;
  private lastConnectedAt: string | null = null;
  private lastInboundAt: string | null = null;
  private lastOutboundAt: string | null = null;
  private lastError: string | null = null;
  private readonly fetchImpl: typeof fetch | null;

  constructor(broker?: IMessageBroker, runtime: WhatsAppGatewayRuntime = {}) {
    this.broker = broker ?? null;
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public attachBroker(broker: IMessageBroker): void {
    this.broker = broker;
  }

  public async start(): Promise<void> {
    this.started = true;
    this.lastStartAt = new Date().toISOString();
    this.lastError = null;
    this.ensureRuntimePaths();
    if (this.getProviderMode() === 'cloud-api' && this.isProviderConfigured(this.getProviderMode())) {
      this.lastConnectedAt = this.lastStartAt;
    }
    this.writeStatus();
  }

  public async stop(): Promise<void> {
    this.started = false;
    this.writeStatus();
  }

  public isStarted(): boolean {
    return this.started;
  }

  public readStatus(): WhatsAppGatewayStatusSnapshot | null {
    if (!fs.existsSync(config.whatsappStatusFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(config.whatsappStatusFile, 'utf8')) as WhatsAppGatewayStatusSnapshot;
    } catch (error) { logger.warn('[Whats App way.stub] JSON parse failed', error); return null; }
  }

  public async requestLoginQr(): Promise<WhatsAppLoginQrReceipt> {
    this.ensureRuntimePaths();
    const loginQr = await this.buildLoginQrSnapshot(true);
    this.writeStatus();

    if (!loginQr.supported) {
      return {
        ok: false,
        status: loginQr.state === 'connected' ? 'connected' : 'unsupported',
        summary: loginQr.state === 'connected'
          ? 'WhatsApp is already connected through Cloud API; this provider does not use QR.'
          : 'This WhatsApp runtime does not expose QR login.',
        details: [loginQr.nextStep],
        loginQr,
      };
    }

    if (loginQr.state === 'ready' && loginQr.dataUrl) {
      return {
        ok: true,
        status: 'ready',
        summary: 'WhatsApp login QR is ready for operator display.',
        details: [
          'Show the image to the authorized user for WhatsApp scanning.',
          'The QR was generated from the configured local runtime/session; it was not sent to external providers.',
          loginQr.expiresAt ? `Expires at: ${loginQr.expiresAt}.` : 'The current provider did not report an expiration time.',
        ],
        loginQr,
      };
    }

    return {
      ok: false,
      status: loginQr.state === 'error' ? 'error' : 'pending',
      summary: 'WhatsApp QR is not available in this runtime yet.',
      details: [
        loginQr.nextStep,
        'Set WHATSAPP_QR_TEXT or WHATSAPP_QR_TEXT_FILE in test environments, or connect a bridge that publishes qr.txt in the session.',
      ],
      loginQr,
    };
  }

  public async relink(): Promise<WhatsAppLifecycleActionReceipt> {
    this.ensureRuntimePaths();
    const provider = this.getProviderMode();

    if (provider === 'cloud-api') {
      this.writeStatus();
      return {
        ok: false,
        status: 'manual',
        summary: 'WhatsApp Cloud API does not use QR relink in this runtime.',
        details: [
          'Rotate WHATSAPP_ACCESS_TOKEN and the webhook verify token in Meta when you need to reconnect the channel.',
          'After rotation, validate /api/webhooks/whatsapp and run /channels broadcast-test whatsapp.',
        ],
      };
    }

    this.started = true;
    this.lastStartAt = this.lastStartAt || new Date().toISOString();
    this.lastConnectedAt = null;
    this.lastError = null;
    const receiptFile = this.writeLifecycleReceipt('relink');
    this.writeStatus();

    return {
      ok: true,
      status: 'applied',
      summary: 'Local WhatsApp pairing was prepared with an auditable receipt.',
      details: [
        'The local runtime was marked as waiting for new pairing without automatically deleting persistent credentials.',
        'Request /channels login-qr whatsapp when the bridge publishes an updated qr.txt in the session.',
        `Receipt: ${receiptFile}.`,
      ],
      receiptFile,
    };
  }

  public async logout(): Promise<WhatsAppLifecycleActionReceipt> {
    this.ensureRuntimePaths();
    const provider = this.getProviderMode();

    if (provider === 'cloud-api') {
      this.started = false;
      this.writeStatus();
      return {
        ok: false,
        status: 'manual',
        summary: 'WhatsApp Cloud API requires logout/revocation in the official Meta console.',
        details: [
          'The local runtime was stopped, but the token and webhook must be revoked outside Zavorth.',
          'Keep allowlists and audit logs intact until the investigation or migration is complete.',
        ],
      };
    }

    this.started = false;
    this.lastConnectedAt = null;
    this.lastError = null;
    const receiptFile = this.writeLifecycleReceipt('logout');
    this.writeStatus();

    return {
      ok: true,
      status: 'applied',
      summary: 'Local WhatsApp session closed in the supervised runtime.',
      details: [
        'Zavorth stopped the local runtime and recorded logout without automatically removing sensitive session files.',
        'Remove or rotate persistent credentials only after operational confirmation.',
        `Receipt: ${receiptFile}.`,
      ],
      receiptFile,
    };
  }

  public async simulateIncomingMessage(message: WhatsAppGatewayStubMessage): Promise<void> {
    await this.dispatchIncomingMessage({
      userId: String(message.userId || ''),
      chatId: String(message.chatId || ''),
      rawText: String(message.rawText || ''),
      isGroup: Boolean(message.isGroup),
      messageId: null,
    });
  }

  public handleWebhookVerification(url: URL): { statusCode: number; textBody: string } {
    if (this.getProviderMode() !== 'cloud-api') {
      return {
        statusCode: 503,
        textBody: 'WhatsApp Cloud API is unavailable in this runtime.',
      };
    }

    const verifyToken = String(config.whatsappWebhookVerifyToken || '').trim();
    if (!verifyToken) {
      this.lastError = 'WhatsApp Cloud API requires WHATSAPP_WEBHOOK_VERIFY_TOKEN to be configured.';
      this.writeStatus();
      return {
        statusCode: 503,
        textBody: 'WhatsApp webhook verify token is missing.',
      };
    }

    const mode = String(url.searchParams.get('hub.mode') || '').trim();
    const token = String(url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = String(url.searchParams.get('hub.challenge') || '').trim();

    if (mode !== 'subscribe' || token !== verifyToken) {
      this.lastError = 'WhatsApp Cloud API rejected webhook verification.';
      this.writeStatus();
      return {
        statusCode: 403,
        textBody: 'forbidden',
      };
    }

    this.lastError = null;
    this.writeStatus();
    return {
      statusCode: 200,
      textBody: challenge,
    };
  }

  public async handleWebhookEvent(input: {
    body: Record<string, unknown>;
  }): Promise<{
    statusCode: number;
    body: unknown;
  }> {
    if (this.getProviderMode() !== 'cloud-api') {
      return {
        statusCode: 503,
        body: { ok: false, error: 'WhatsApp Cloud API is unavailable in this runtime.' },
      };
    }

    const messages = this.extractCloudApiMessages(input.body);
    let accepted = 0;

    for (const message of messages) {
      const rawText = this.extractTextFromCloudApiMessage(message);
      if (!rawText) {
        continue;
      }

      accepted += 1;
      await this.dispatchIncomingMessage({
        userId: String(message.from || '').trim(),
        chatId: String(message.from || '').trim(),
        rawText,
        isGroup: false,
        messageId: String(message.id || '').trim() || null,
      });
    }

    return {
      statusCode: 200,
      body: {
        ok: true,
        accepted: accepted > 0,
        received: messages.length,
        processed: accepted,
      },
    };
  }

  public resolveBroadcastRecipients(): string[] {
    return config.whatsappAllowedChatIds
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  public async broadcast(message: string): Promise<void> {
    if (!this.started) {
      this.lastError = `WhatsApp ${this.getProviderLabel()} has not started yet.`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = `WhatsApp ${this.getProviderLabel()} has no configured allowed chats.`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const normalizedMessage = String(message || '');
    if (this.getProviderMode() === 'cloud-api') {
      await this.broadcastViaCloudApi(normalizedMessage, recipients);
      return;
    }

    this.writeStubEnvelope(normalizedMessage, recipients);
  }

  public getIdentityHints(): { linkedBy: string; verificationMethod: string } {
    return {
      linkedBy: 'whatsapp-gateway',
      verificationMethod: this.getProviderVerificationMethod(),
    };
  }

  private ensureRuntimePaths(): void {
    fs.mkdirSync(config.whatsappOutboxDir, { recursive: true });
    fs.mkdirSync(path.dirname(config.whatsappStatusFile), { recursive: true });
  }

  private async dispatchIncomingMessage(input: {
    userId: string;
    chatId: string;
    rawText: string;
    isGroup: boolean;
    messageId: string | null;
  }): Promise<void> {
    if (!this.broker) {
      throw new Error('WhatsAppGateway has no broker attached.');
    }

    this.lastInboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
    await this.broker.processMessage({
      platform: 'whatsapp',
      userId: input.userId,
      chatId: input.chatId,
      messageId: input.messageId,
      isGroup: input.isGroup,
      rawText: input.rawText,
      reply: async (text: string) => {
        await this.replyToChat(input.chatId, text, input.messageId);
      },
      editMessage: async (messageId: string, text: string) => {
        await this.editWhatsAppMessage(input.chatId, messageId, text);
      },
    });
  }

  private getProviderMode(): 'stub' | 'cloud-api' | 'baileys' {
    if (config.whatsappProvider === 'cloud-api' || config.whatsappProvider === 'baileys') {
      return config.whatsappProvider;
    }
    return 'stub';
  }

  private getProviderLabel(): string {
    const provider = this.getProviderMode();
    if (provider === 'cloud-api') {
      return 'cloud-api';
    }
    if (provider === 'baileys') {
      return 'baileys';
    }
    return 'stub';
  }

  private getProviderVerificationMethod(): string {
    const provider = this.getProviderMode();
    if (provider === 'cloud-api') {
      return 'whatsapp-cloud-api';
    }
    if (provider === 'baileys') {
      return 'whatsapp-baileys-planned';
    }
    return 'whatsapp-stub-outbox';
  }

  private readQrText(): { value: string; source: string } | null {
    const envQr = String(process.env.WHATSAPP_QR_TEXT || '').trim();
    if (envQr) {
      return { value: envQr, source: 'env:WHATSAPP_QR_TEXT' };
    }

    const candidateFiles = [
      String(process.env.WHATSAPP_QR_TEXT_FILE || '').trim(),
      this.defaultQrTextFile(),
    ].filter(Boolean);

    for (const candidate of candidateFiles) {
      try {
        if (!candidate || !fs.existsSync(candidate)) {
          continue;
        }
        const value = fs.readFileSync(candidate, 'utf8').trim();
        if (value) {
          return { value, source: candidate };
        }
      } catch (error) {
        this.lastError = `Could not read the WhatsApp QR from ${candidate}: ${error instanceof Error ? error.message : String(error)}`;
        return null;
      }
    }

    return null;
  }

  private defaultQrTextFile(): string {
    const sessionDir = String(config.whatsappSessionDir || '').trim()
      || path.resolve(config.projectRoot, 'data', 'whatsapp-bridge', 'session');
    return path.join(sessionDir, 'qr.txt');
  }

  private async buildLoginQrSnapshot(includeDataUrl: boolean): Promise<WhatsAppLoginQrSnapshot> {
    const status = this.buildLoginQrStatusSnapshot();
    if (!includeDataUrl || !status.supported || status.state !== 'ready') {
      return status;
    }

    const qrText = this.readQrText();
    if (!qrText) {
      return {
        ...status,
        state: 'pending',
        nextStep: 'The local bridge has not published a valid readable QR yet.',
      };
    }

    try {
      return {
        ...status,
        source: qrText.source,
        dataUrl: await toDataURL(qrText.value, {
          margin: 1,
          scale: 6,
          errorCorrectionLevel: 'M',
        }),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
    logger.warn('[Whats App way.stub] validation failed', error);
    return {
        ...status,
        state: 'error',
        dataUrl: null,
        updatedAt: new Date().toISOString(),
        nextStep: `Failed to generate WhatsApp QR image: ${error instanceof Error ? error.message : String(error)}`,
      };
  }
  }

  private buildLoginQrStatusSnapshot(): WhatsAppLoginQrSnapshot {
    const provider = this.getProviderMode();
    const updatedAt = new Date().toISOString();

    if (provider === 'cloud-api') {
      return {
        supported: false,
        state: this.isProviderConfigured(provider) ? 'connected' : 'unsupported',
        source: 'meta-cloud-api',
        dataUrl: null,
        expiresAt: null,
        updatedAt,
        nextStep: this.isProviderConfigured(provider)
          ? 'Cloud API uses a persistent webhook/token; monitor /api/webhooks/whatsapp instead of QR.'
          : 'Complete WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN e WHATSAPP_WEBHOOK_VERIFY_TOKEN.',
      };
    }

    const qrText = this.readQrText();
    if (qrText) {
      const expiresAt = this.resolveQrExpiresAt();
      const expired = expiresAt ? Date.parse(expiresAt) <= Date.now() : false;
      return {
        supported: true,
        state: expired ? 'expired' : 'ready',
        source: qrText.source,
        dataUrl: null,
        expiresAt,
        updatedAt,
        nextStep: expired
          ? 'QR expired; request relink or restart the local bridge to publish a new qr.txt.'
          : 'Display the QR to pair the supervised local WhatsApp session.',
      };
    }

    return {
      supported: true,
      state: String(config.whatsappSessionDir || '').trim() ? 'pending' : 'not_requested',
      source: null,
      dataUrl: null,
      expiresAt: null,
      updatedAt,
      nextStep: String(config.whatsappSessionDir || '').trim()
        ? 'Waiting for the local bridge to publish qr.txt inside the WhatsApp session.'
        : 'Set WHATSAPP_SESSION_DIR or connect a local bridge before requesting QR.',
    };
  }

  private resolveQrExpiresAt(): string | null {
    const explicit = String(process.env.WHATSAPP_QR_EXPIRES_AT || '').trim();
    if (explicit) {
      const timestamp = Date.parse(explicit);
      return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : explicit;
    }

    const ttlMs = Number(process.env.WHATSAPP_QR_EXPIRES_IN_MS || 0);
    if (Number.isFinite(ttlMs) && ttlMs > 0) {
      return new Date(Date.now() + ttlMs).toISOString();
    }

    return null;
  }

  private isProviderConfigured(provider: 'stub' | 'cloud-api' | 'baileys'): boolean {
    if (provider === 'cloud-api') {
      return Boolean(
        String(config.whatsappPhoneNumberId || '').trim()
        && String(config.whatsappAccessToken || '').trim()
        && String(config.whatsappWebhookVerifyToken || '').trim(),
      );
    }

    if (provider === 'baileys') {
      return Boolean(String(config.whatsappSessionDir || '').trim());
    }

    return true;
  }

  private async broadcastViaCloudApi(message: string, recipients: string[]): Promise<void> {
    const failures: string[] = [];

    for (const recipient of recipients) {
      const payload = await this.sendCloudApiTextMessage(recipient, message);
      const responseError = this.describeCloudApiSendError(payload);
      if (this.isCloudApiSendSuccess(payload)) {
        continue;
      }
      failures.push(`${recipient}: ${responseError || 'unknown_error'}`);
    }

    if (failures.length > 0) {
      this.lastError = `WhatsApp Cloud API failed for ${failures.length} chat(s): ${failures.join(' | ')}`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    this.lastOutboundAt = new Date().toISOString();
    this.lastError = null;
    this.writeStatus();
  }

  private async replyToChat(chatId: string, text: string, replyToMessageId: string | null): Promise<void> {
    if (this.getProviderMode() === 'cloud-api') {
      const payload = await this.sendCloudApiTextMessage(chatId, text, {
        contextMessageId: replyToMessageId,
      });
      const responseError = this.describeCloudApiSendError(payload);
      if (!this.isCloudApiSendSuccess(payload)) {
        this.lastError = `WhatsApp Cloud API could not reply in ${chatId}: ${responseError || 'unknown_error'}`;
        this.writeStatus();
        throw new Error(this.lastError);
      }
      this.lastOutboundAt = new Date().toISOString();
      this.lastError = null;
      this.writeStatus();
      return;
    }

    this.writeStubEnvelope(text, [chatId], {
      chatId,
      messageId: replyToMessageId,
      kind: 'reply',
    });
  }

  private async editWhatsAppMessage(chatId: string, messageId: string, text: string): Promise<void> {
    if (!messageId) {
      return;
    }

    if (this.getProviderMode() === 'cloud-api') {
      const payload = await this.sendCloudApiTextMessage(chatId, text, {
        contextMessageId: messageId,
      });
      const responseError = this.describeCloudApiSendError(payload);
      if (!this.isCloudApiSendSuccess(payload)) {
        this.lastError = `WhatsApp Cloud API could not send the message update ${messageId}: ${responseError || 'unknown_error'}`;
        this.writeStatus();
        throw new Error(this.lastError);
      }
      this.lastOutboundAt = new Date().toISOString();
      this.lastError = null;
      this.writeStatus();
      return;
    }

    this.writeStubEnvelope(text, [chatId], {
      chatId,
      messageId,
      kind: 'edit',
    });
  }

  private async sendCloudApiTextMessage(
    chatId: string,
    text: string,
    options: { contextMessageId?: string | null } = {},
  ): Promise<CloudApiSendResult> {
    const phoneNumberId = String(config.whatsappPhoneNumberId || '').trim();
    const accessToken = String(config.whatsappAccessToken || '').trim();
    const apiVersion = String(config.whatsappCloudApiVersion || 'v20.0').trim() || 'v20.0';
    if (!phoneNumberId || !accessToken) {
      this.lastError = 'WhatsApp Cloud API requires WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.';
      this.writeStatus();
      throw new Error(this.lastError);
    }
    if (!this.fetchImpl) {
      this.lastError = 'WhatsApp Cloud API requires fetch to be available in the runtime.';
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const response = await this.fetchImpl(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: chatId,
          type: 'text',
          text: {
            body: text,
          },
          ...(options.contextMessageId
            ? {
                context: {
                  message_id: options.contextMessageId,
                },
              }
            : {}),
        }),
      },
    );

    let responsePayload: CloudApiSendResult | null = null;
    try {
      responsePayload = await response.json() as CloudApiSendResult;
    } catch (error) {
    logger.warn('[Whats App way.stub] load operation failed', error);
    responsePayload = null;
  }

    if (!response.ok && !responsePayload) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return responsePayload || {
      messaging_product: 'whatsapp',
      ok: response.ok,
    };
  }

  private isCloudApiSendSuccess(payload: CloudApiSendResult | null): boolean {
    return Boolean(
      payload?.ok === true
      || (Array.isArray(payload?.messages) && payload.messages.length > 0),
    );
  }

  private describeCloudApiSendError(payload: CloudApiSendResult | null): string | null {
    const error = payload?.error;
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error.message === 'string') {
      return error.message;
    }
    return null;
  }

  private extractCloudApiMessages(body: Record<string, unknown>): CloudApiWebhookMessage[] {
    const entries = Array.isArray(body.entry) ? body.entry : [];
    const messages: CloudApiWebhookMessage[] = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const changes = Array.isArray((entry as Record<string, unknown>).changes)
        ? (entry as Record<string, unknown>).changes as Array<Record<string, unknown>>
        : [];
      for (const change of changes) {
        const value = change?.value && typeof change.value === 'object'
          ? change.value as Record<string, unknown>
          : null;
        if (!value) {
          continue;
        }
        const valueMessages = Array.isArray(value.messages)
          ? value.messages.filter((message): message is CloudApiWebhookMessage =>
              Boolean(message && typeof message === 'object'))
          : [];
        messages.push(...valueMessages);
      }
    }

    return messages;
  }

  private extractTextFromCloudApiMessage(message: CloudApiWebhookMessage): string | null {
    const type = String(message.type || '').trim().toLowerCase();
    if (type === 'text') {
      const text = message.text?.body?.trim() || '';
      return text || null;
    }

    if (type === 'button') {
      const button = message.button?.text?.trim() || '';
      return button || null;
    }

    if (type === 'interactive') {
      const buttonReply = message.interactive?.button_reply?.title?.trim() || '';
      const listReply = message.interactive?.list_reply?.title?.trim() || '';
      return buttonReply || listReply || null;
    }

    return null;
  }

  private writeStubEnvelope(
    message: string,
    recipients: string[],
    extra: {
      chatId?: string | null;
      messageId?: string | null;
      kind?: 'broadcast' | 'reply' | 'edit';
    } = {},
  ): void {
    this.ensureRuntimePaths();
    const envelope = {
      id: `whatsapp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      transport: 'stub',
      recipients,
      chatId: String(extra.chatId || '').trim() || null,
      messageId: String(extra.messageId || '').trim() || null,
      message,
      kind: extra.kind || 'broadcast',
    };
    const envelopeFile = path.join(
      config.whatsappOutboxDir,
      `${envelope.createdAt.replace(/[:.]/g, '-')}-${envelope.id}.json`,
    );
    fs.writeFileSync(envelopeFile, JSON.stringify(envelope, null, 2), 'utf8');
    this.lastOutboundAt = envelope.createdAt;
    this.lastError = null;
    this.writeStatus();
  }

  private writeLifecycleReceipt(kind: 'relink' | 'logout'): string {
    this.ensureRuntimePaths();
    const createdAt = new Date().toISOString();
    const provider = this.getProviderMode();
    const receipt = {
      id: `whatsapp-${kind}-${Date.now()}`,
      kind,
      createdAt,
      platform: 'whatsapp',
      provider,
      sessionDir: String(config.whatsappSessionDir || '').trim() || null,
      qrFile: provider === 'cloud-api' ? null : this.defaultQrTextFile(),
      destructive: false,
      note: kind === 'relink'
        ? 'Relink prepared without automatically deleting the persistent session.'
        : 'Local logout recorded without automatically removing persistent credentials.',
      nextStep: kind === 'relink'
        ? 'Request /channels login-qr whatsapp after the bridge publishes qr.txt.'
        : 'Revoke/remove persistent credentials manually when the operation requires it.',
    };
    const receiptFile = path.join(
      config.whatsappOutboxDir,
      `${createdAt.replace(/[:.]/g, '-')}-${receipt.id}.json`,
    );
    fs.writeFileSync(receiptFile, JSON.stringify(receipt, null, 2), 'utf8');
    return receiptFile;
  }

  private buildProviderModeLabel(provider: 'stub' | 'cloud-api' | 'baileys'): string {
    if (provider === 'cloud-api') {
      return 'Meta WhatsApp Cloud API';
    }
    if (provider === 'baileys') {
      return 'Local Baileys bridge';
    }
    return 'Supervised local outbox';
  }

  private buildProviderDecision(
    provider: 'stub' | 'cloud-api' | 'baileys',
    providerConfigured: boolean,
  ): string {
    if (provider === 'cloud-api') {
      return providerConfigured
        ? 'Cloud API connected; webhook verification, official inbound, and official outbound are active.'
        : 'Cloud API selected as the target provider, but minimum credentials are still missing to activate the runtime.';
    }
    if (provider === 'baileys') {
      return providerConfigured
        ? 'Baileys selected as the target provider with a configured supervised local session.'
        : 'Baileys selected as the target provider; WHATSAPP_SESSION_DIR still needs to be configured.';
    }
    return 'Local stub is kept until the official WhatsApp provider is connected.';
  }

  private buildRecipientPolicy(recipients: string[]): WhatsAppRecipientPolicySnapshot {
    const count = recipients.length;
    return {
      state: count > 0 ? 'allowlist' : 'empty',
      allowedCount: count,
      allowlistConfigured: count > 0,
      summary: count > 0
        ? `${count} chat(s) allowed by WHATSAPP_ALLOWED_CHAT_IDS.`
        : 'No allowed chats; real outbound remains blocked until an allowlist is configured.',
    };
  }

  private buildLocalBridgeSnapshot(
    provider: 'stub' | 'cloud-api' | 'baileys',
    loginQr: WhatsAppLoginQrSnapshot,
  ): WhatsAppLocalBridgeSnapshot | null {
    if (provider === 'cloud-api') {
      return null;
    }

    const sessionDir = String(config.whatsappSessionDir || '').trim() || null;
    return {
      provider,
      sessionDir,
      sessionDirConfigured: Boolean(sessionDir),
      qrFile: this.defaultQrTextFile(),
      qrState: loginQr.state,
      baileysReady: provider === 'baileys' && Boolean(sessionDir),
      nextStep: loginQr.nextStep,
    };
  }

  private resolveLifecycleState(input: {
    enabled: boolean;
    started: boolean;
    connected: boolean;
    linked: boolean;
    providerConfigured: boolean;
    loginQr: WhatsAppLoginQrSnapshot;
  }): WhatsAppLifecycleState {
    if (this.lastError) {
      return 'error';
    }
    if (!input.started) {
      return 'stopped';
    }
    if (input.connected) {
      return 'connected';
    }
    if (input.loginQr.state === 'ready' || input.loginQr.state === 'pending' || input.loginQr.state === 'expired') {
      return 'awaiting_qr';
    }
    if (input.linked || input.providerConfigured) {
      return 'linked';
    }
    if (!input.enabled) {
      return 'stopped';
    }
    return 'unconfigured';
  }

  private writeStatus(): void {
    this.ensureRuntimePaths();
    const recipients = this.resolveBroadcastRecipients();
    const updatedAt = new Date().toISOString();
    const provider = this.getProviderMode();
    const cloudApiConfigured = Boolean(
      String(config.whatsappPhoneNumberId || '').trim()
      && String(config.whatsappAccessToken || '').trim(),
    );
    const providerConfigured = this.isProviderConfigured(provider);
    const enabled = Boolean(
      config.whatsappEnabled
      || config.whatsappBotToken
      || config.whatsappSessionDir
      || provider !== 'stub'
      || cloudApiConfigured
    );
    const linked = provider === 'cloud-api'
      ? providerConfigured
      : Boolean(String(config.whatsappSessionDir || '').trim());
    const connected = provider === 'cloud-api'
      ? this.started && providerConfigured && !this.lastError
      : this.started && Boolean(this.lastConnectedAt) && !this.lastError;
    const loginQr = this.buildLoginQrStatusSnapshot();
    const webhookConfigured = Boolean(String(config.whatsappWebhookVerifyToken || '').trim());
    const webhookStatus = provider === 'cloud-api'
      ? webhookConfigured
        ? 'configured'
        : 'missing'
      : 'not_applicable';
    const recipientPolicy = this.buildRecipientPolicy(recipients);
    const localBridge = this.buildLocalBridgeSnapshot(provider, loginQr);
    const lifecycleState = this.resolveLifecycleState({
      enabled,
      started: this.started,
      connected,
      linked,
      providerConfigured,
      loginQr,
    });
    fs.writeFileSync(
      config.whatsappStatusFile,
      JSON.stringify(
        {
          mode: provider,
          enabled,
          started: this.started,
          running: this.started,
          linked,
          connected,
          recipientsConfigured: recipients.length,
          allowedChatIds: recipients,
          provider,
          providerModeLabel: this.buildProviderModeLabel(provider),
          providerConfigured,
          providerDecision: this.buildProviderDecision(provider, providerConfigured),
          sessionDir: String(config.whatsappSessionDir || '').trim() || null,
          sessionDirConfigured: Boolean(String(config.whatsappSessionDir || '').trim()),
          phoneNumberId: String(config.whatsappPhoneNumberId || '').trim() || null,
          webhookConfigured,
          webhookStatus,
          lifecycleState,
          recipientPolicy,
          localBridge,
          lastInboundAt: this.lastInboundAt,
          lastOutboundAt: this.lastOutboundAt,
          lastStartAt: this.lastStartAt,
          lastConnectedAt: this.lastConnectedAt,
          lastError: this.lastError,
          authAgeMs: this.lastConnectedAt ? Date.now() - Date.parse(this.lastConnectedAt) : null,
          loginQr,
          updatedAt,
        },
        null,
        2,
      ),
      'utf8',
    );
  }
}
