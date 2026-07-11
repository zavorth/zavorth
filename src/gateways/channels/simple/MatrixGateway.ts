import { config } from '../../../config/index.js';
import type { ChannelAdapterStatus } from '../../../contracts/ChannelMeshContract.js';
import { WebhookGateway, type WebhookGatewayMode, type WebhookGatewayOptions } from '../../WebhookGateway.js';
import { asErrorLike } from '../../../utils/errorLike.js';

export class MatrixGateway extends WebhookGateway {
  public readonly id = 'matrix';
  public readonly name = 'Matrix';
  public readonly type: 'async' = 'async';
  public readonly mode: WebhookGatewayMode = 'matrix';

  constructor(options: WebhookGatewayOptions) {
    super({
      ...options,
      outboxDir: options.outboxDir || config.matrixOutboxDir,
      statusFile: options.statusFile || config.matrixStatusFile,
    });
  }

  public describe(): ChannelAdapterStatus {
    return {
      ...this.buildDefaultDescribe(),
      webhookPath: '/api/webhooks/matrix',
      doctorCommand: '/channels doctor matrix',
      operatorNextStep: this.resolveConfigured()
        ? 'Matrix configurado. Envie mensagens via API HTTP nativa.'
        : 'Defina MATRIX_BASE_URL e MATRIX_ACCESS_TOKEN para ativar.',
    };
  }

  public resolveConfigured(): boolean {
    return Boolean(
      String(config.matrixBaseUrl || '').trim()
      && String(config.matrixAccessToken || '').trim(),
    );
  }

  public resolveEnabled(): boolean {
    return Boolean(
      String(config.matrixBaseUrl || '').trim()
      || String(config.matrixAccessToken || '').trim(),
    );
  }

  public override doctorSnapshot() {
    const base = super.doctorSnapshot();
    return {
      ...base,
      installHint: this.resolveConfigured()
        ? 'Matrix Client-Server API ready for room send (m.room.message).'
        : 'Set MATRIX_BASE_URL + MATRIX_ACCESS_TOKEN (+ MATRIX_DEFAULT_ROOM_ID).',
      allowlist: {
        ...base.allowlist,
        defaultRoomConfigured: Boolean(String(config.matrixDefaultRoomId || '').trim()),
      },
    };
  }

  protected resolveOutboxDir(): string {
    return config.matrixOutboxDir;
  }

  protected resolveStatusFile(): string {
    return config.matrixStatusFile;
  }

  protected extractInboundPayload(webhookPayload: Record<string, unknown>): {
    userId: string;
    chatId: string;
    rawText: string;
    messageId?: string | null;
    isGroup?: boolean;
    fields?: Record<string, unknown>;
  } | null {
    const sender = String(
      (webhookPayload.sender as string)
      || (webhookPayload.user_id as string)
      || (webhookPayload.userId as string)
      || '',
    ).trim();
    const roomId = String(
      (webhookPayload.room_id as string)
      || (webhookPayload.roomId as string)
      || (webhookPayload.chatId as string)
      || config.matrixDefaultRoomId
      || '',
    ).trim();
    const content = webhookPayload.content && typeof webhookPayload.content === 'object'
      ? webhookPayload.content as Record<string, unknown>
      : null;
    const rawText = String(
      (content?.body as string)
      || (webhookPayload.body as string)
      || (webhookPayload.text as string)
      || (webhookPayload.rawText as string)
      || '',
    ).trim();
    const messageId = String(
      (webhookPayload.event_id as string)
      || (webhookPayload.eventId as string)
      || (webhookPayload.messageId as string)
      || '',
    ).trim() || null;

    if (!rawText) {
      return null;
    }

    return {
      userId: sender || 'matrix-user',
      chatId: roomId || 'matrix',
      rawText,
      messageId,
      isGroup: true,
      fields: {
        roomId: roomId || null,
        messageType: String(content?.msgtype || 'm.text'),
      },
    };
  }

  public async sendToRoom(roomId: string, text: string): Promise<void> {
    if (!this.resolveConfigured() || !this.fetchImpl) {
      this.writeStubOutbound(roomId, text);
      return;
    }

    const baseUrl = String(config.matrixBaseUrl || '').replace(/\/+$/, '');
    const accessToken = String(config.matrixAccessToken || '').trim();
    const txnId = `zav-${Date.now()}`;

    try {
      const response = await this.fetchImpl(
        `${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            msgtype: 'm.text',
            body: text,
          }),
        },
      );

      if (!response.ok) {
        this.recordError(`Matrix API error: HTTP ${response.status}`);
        return;
      }

      this.markOutbound();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.recordError(`Matrix send failed: ${error instanceof Error ? err.message : String(error)}`);
    }
  }

  private writeStubOutbound(roomId: string, text: string): void {
    this.sendMessage({
      recipients: [roomId],
      text,
      chatId: roomId,
    });
  }
}
