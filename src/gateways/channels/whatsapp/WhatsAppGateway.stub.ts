import fs from 'fs';
import path from 'path';
import { toDataURL } from 'qrcode';
import { IMessageBroker } from '../../../contracts/IMessageBroker.js';
import { type LiveChannelBroadcastGatewayContract, PlatformKey } from '../../../contracts/PlatformContract.js';
import { config } from '../../../config/index.js';

// Cloud API response when message is sent successfully
interface CloudApiSendMessageSuccess {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

// Cloud API error response structure
interface CloudApiErrorDetail {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

// Unified result type for sendCloudApiTextMessage
type CloudApiSendResult =
  | CloudApiSendMessageSuccess
  | { ok: false; error: string }
  | { error: CloudApiErrorDetail };

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
    } catch {
      return null;
    }
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
          ? 'WhatsApp ja esta conectado por Cloud API; este provider nao usa QR.'
          : 'Este runtime do WhatsApp nao expoe login por QR.',
        details: [loginQr.nextStep],
        loginQr,
      };
    }

    if (loginQr.state === 'ready' && loginQr.dataUrl) {
      return {
        ok: true,
        status: 'ready',
        summary: 'QR de login do WhatsApp pronto para exibicao no operador.',
        details: [
          'Mostre a imagem para o usuario autorizado escanear no WhatsApp.',
          'O QR foi gerado a partir do runtime local/sessao configurada; nao foi enviado para provedores externos.',
          loginQr.expiresAt ? `Expira em: ${loginQr.expiresAt}.` : 'Expiracao nao informada pelo provider atual.',
        ],
        loginQr,
      };
    }

    return {
      ok: false,
      status: loginQr.state === 'error' ? 'error' : 'pending',
      summary: 'QR do WhatsApp ainda nao esta disponivel neste runtime.',
      details: [
        loginQr.nextStep,
        'Defina WHATSAPP_QR_TEXT ou WHATSAPP_QR_TEXT_FILE em ambientes de teste, ou conecte uma bridge que publique qr.txt na sessao.',
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
        summary: 'WhatsApp Cloud API nao usa relink por QR neste runtime.',
        details: [
          'Rotacione WHATSAPP_ACCESS_TOKEN e webhook verify token no painel da Meta quando precisar religar o canal.',
          'Depois da rotacao, valide /api/webhooks/whatsapp e rode /channels broadcast-test whatsapp.',
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
      summary: 'Pareamento local do WhatsApp preparado com receipt auditavel.',
      details: [
        'O runtime local foi marcado como aguardando novo pareamento sem apagar credenciais persistentes automaticamente.',
        'Solicite /channels login-qr whatsapp quando a bridge publicar um qr.txt atualizado na sessao.',
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
        summary: 'WhatsApp Cloud API exige logout/revogacao no painel oficial da Meta.',
        details: [
          'O runtime local foi parado, mas token e webhook devem ser revogados fora do Zavorth.',
          'Mantenha allowlists e audit logs intactos ate concluir a investigacao ou migracao.',
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
      summary: 'Sessao local do WhatsApp encerrada no runtime supervisionado.',
      details: [
        'O Zavorth parou o runtime local e registrou logout sem remover arquivos sensiveis da sessao automaticamente.',
        'Remova ou rotacione credenciais persistentes somente apos confirmacao operacional.',
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
        textBody: 'WhatsApp Cloud API indisponivel neste runtime.',
      };
    }

    const verifyToken = String(config.whatsappWebhookVerifyToken || '').trim();
    if (!verifyToken) {
      this.lastError = 'WhatsApp Cloud API exige WHATSAPP_WEBHOOK_VERIFY_TOKEN configurado.';
      this.writeStatus();
      return {
        statusCode: 503,
        textBody: 'WhatsApp webhook verify token ausente.',
      };
    }

    const mode = String(url.searchParams.get('hub.mode') || '').trim();
    const token = String(url.searchParams.get('hub.verify_token') || '').trim();
    const challenge = String(url.searchParams.get('hub.challenge') || '').trim();

    if (mode !== 'subscribe' || token !== verifyToken) {
      this.lastError = 'WhatsApp Cloud API rejeitou a verificacao do webhook.';
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
        body: { ok: false, error: 'WhatsApp Cloud API indisponivel neste runtime.' },
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
      this.lastError = `WhatsApp ${this.getProviderLabel()} ainda nao foi iniciado.`;
      this.writeStatus();
      throw new Error(this.lastError);
    }

    const recipients = this.resolveBroadcastRecipients();
    if (recipients.length === 0) {
      this.lastError = `WhatsApp ${this.getProviderLabel()} nao tem chats permitidos configurados.`;
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
        this.lastError = `Nao foi possivel ler o QR do WhatsApp em ${candidate}: ${error instanceof Error ? error.message : String(error)}`;
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
        nextStep: 'A bridge local ainda nao publicou um QR valido para leitura.',
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
      return {
        ...status,
        state: 'error',
        dataUrl: null,
        updatedAt: new Date().toISOString(),
        nextStep: `Falha ao gerar imagem do QR do WhatsApp: ${error instanceof Error ? error.message : String(error)}`,
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
          ? 'Cloud API usa webhook/token permanente; monitore /api/webhooks/whatsapp em vez de QR.'
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
          ? 'QR expirado; solicite relink ou reinicie a bridge local para publicar um qr.txt novo.'
          : 'Exiba o QR para parear a sessao local supervisionada do WhatsApp.',
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
        ? 'Aguardando a bridge local publicar qr.txt dentro da sessao do WhatsApp.'
        : 'Defina WHATSAPP_SESSION_DIR ou conecte uma bridge local antes de solicitar QR.',
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
      const responseError = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.error === 'string'
          ? payload.error
          : null;
      if (payload?.messages && Array.isArray(payload.messages) && payload.messages.length > 0) {
        continue;
      }
      if (payload?.ok === true) {
        continue;
      }
      failures.push(`${recipient}: ${responseError || 'unknown_error'}`);
    }

    if (failures.length > 0) {
      this.lastError = `WhatsApp Cloud API falhou em ${failures.length} chat(s): ${failures.join(' | ')}`;
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
      const responseError = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.error === 'string'
          ? payload.error
          : null;
      if (!payload?.messages && payload?.ok !== true) {
        this.lastError = `WhatsApp Cloud API nao conseguiu responder em ${chatId}: ${responseError || 'unknown_error'}`;
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
      const responseError = typeof payload?.error?.message === 'string'
        ? payload.error.message
        : typeof payload?.error === 'string'
          ? payload.error
          : null;
      if (!payload?.messages && payload?.ok !== true) {
        this.lastError = `WhatsApp Cloud API nao conseguiu enviar a atualizacao da mensagem ${messageId}: ${responseError || 'unknown_error'}`;
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
      this.lastError = 'WhatsApp Cloud API exige WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_ACCESS_TOKEN.';
      this.writeStatus();
      throw new Error(this.lastError);
    }
    if (!this.fetchImpl) {
      this.lastError = 'WhatsApp Cloud API exige fetch disponivel no runtime.';
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
    } catch {
      responsePayload = null;
    }

    if (!response.ok && !responsePayload) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    return responsePayload || { ok: response.ok };
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
          ? value.messages as Array<Record<string, unknown>>
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
        ? 'Relink preparado sem apagar sessao persistente automaticamente.'
        : 'Logout local registrado sem remover credenciais persistentes automaticamente.',
      nextStep: kind === 'relink'
        ? 'Solicite /channels login-qr whatsapp apos a bridge publicar qr.txt.'
        : 'Revogue/remova credenciais persistentes manualmente quando a operacao exigir.',
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
      return 'Bridge local Baileys';
    }
    return 'Outbox local supervisionado';
  }

  private buildProviderDecision(
    provider: 'stub' | 'cloud-api' | 'baileys',
    providerConfigured: boolean,
  ): string {
    if (provider === 'cloud-api') {
      return providerConfigured
        ? 'Cloud API conectada; webhook verification, inbound e outbound oficial estao ativos.'
        : 'Cloud API escolhida como provider-alvo, mas ainda faltam credenciais minimas para ativar o runtime.';
    }
    if (provider === 'baileys') {
      return providerConfigured
        ? 'Baileys escolhido como provider-alvo com sessao local supervisionada configurada.'
        : 'Baileys escolhido como provider-alvo; falta configurar WHATSAPP_SESSION_DIR.';
    }
    return 'Stub local mantido enquanto o provider oficial do WhatsApp nao e conectado.';
  }

  private buildRecipientPolicy(recipients: string[]): WhatsAppRecipientPolicySnapshot {
    const count = recipients.length;
    return {
      state: count > 0 ? 'allowlist' : 'empty',
      allowedCount: count,
      allowlistConfigured: count > 0,
      summary: count > 0
        ? `${count} chat(s) permitidos por WHATSAPP_ALLOWED_CHAT_IDS.`
        : 'Nenhum chat permitido; outbound real fica bloqueado ate configurar allowlist.',
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
