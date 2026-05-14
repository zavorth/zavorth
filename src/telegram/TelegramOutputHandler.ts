import { Context, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { buildCapabilityProvisionHint, isCapabilityUnavailableError } from '../services/OptionalCapabilityGuard.js';
import { AudioHandler } from './AudioHandler.js';

const TELEGRAM_MAX_LENGTH = 4096;

export interface OutputResult {
  text: string;
  isAudio: boolean;
  isFile: boolean;
  fileName?: string;
}

/**
 * TelegramOutputHandler - Gerencia as estrategias de output do bot.
 */
export class TelegramOutputHandler {
  private readonly audioHandler: AudioHandler;

  constructor(audioHandler?: AudioHandler) {
    this.audioHandler = audioHandler || new AudioHandler();
  }

  public async send(ctx: Context, result: OutputResult): Promise<void> {
    try {
      if (result.isAudio) {
        await this.sendAudio(ctx, result.text);
      } else if (result.isFile) {
        await this.sendFile(ctx, result.text, result.fileName || 'documento.md');
      } else {
        await this.sendText(ctx, result.text);
      }
    } catch (error) {
      console.error(`[OutputHandler] Erro ao enviar resposta: ${error}`);
      await this.sendError(ctx, 'Falha ao enviar resposta. Tente novamente.');
    }
  }

  public async sendText(ctx: Context, text: string): Promise<void> {
    if (text.length <= TELEGRAM_MAX_LENGTH) {
      await this.safeSend(ctx, text);
      return;
    }

    const chunks = this.splitIntoChunks(text, TELEGRAM_MAX_LENGTH);
    for (const chunk of chunks) {
      await this.safeSend(ctx, chunk);
      await this.sleep(300);
    }
  }

  public async sendFile(ctx: Context, content: string, fileName: string): Promise<void> {
    const filePath = path.join(config.tmpDir, fileName);

    try {
      if (!fs.existsSync(config.tmpDir)) {
        fs.mkdirSync(config.tmpDir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');

      await ctx.replyWithDocument(new InputFile(filePath, fileName), {
        caption: `Documento gerado: ${fileName}`,
      });
    } catch (error) {
      console.error(`[OutputHandler] Erro ao enviar arquivo: ${error}`);
      await this.sendText(ctx, `Nao consegui gerar o arquivo. Conteudo em texto:\n\n${content}`);
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  /**
   * Sintetiza TTS e envia como voice note ou audio, dependendo do formato gerado.
   */
  public async sendAudio(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.api.sendChatAction(ctx.chat!.id, 'record_voice');

      let audioPath: string | null = null;
      try {
        audioPath = await this.audioHandler.synthesize(text);
      } catch (error) {
        if (isCapabilityUnavailableError(error)) {
          await this.sendText(
            ctx,
            `A resposta em audio pediu a capability opcional de midia, que ainda nao esta ativa neste host.\n${buildCapabilityProvisionHint(error.capabilityId)}\n\nResposta em texto:\n\n${text}`,
          );
          return;
        }
        throw error;
      }

      if (audioPath && fs.existsSync(audioPath)) {
        const file = new InputFile(audioPath, path.basename(audioPath));
        await this.sendTelegramAudio(ctx, file, audioPath);
        this.audioHandler.cleanup(audioPath);
        console.log('[OutputHandler] Audio enviado com sucesso.');
        return;
      }

      console.warn('[OutputHandler] TTS falhou, enviando como texto.');
      await this.sendText(ctx, text);
    } catch (error) {
      console.error(`[OutputHandler] Erro no envio de audio: ${error}`);
      await this.sendText(ctx, `Falha ao gerar audio. Resposta em texto:\n\n${text}`);
    }
  }

  public async sendError(ctx: Context, errorMessage: string): Promise<void> {
    await this.safeSend(ctx, `Aviso: ${errorMessage}`);
  }

  private async sendTelegramAudio(ctx: Context, file: InputFile, filePath: string): Promise<void> {
    const preferVoice = /\.(ogg|opus)$/i.test(filePath);

    if (preferVoice && typeof (ctx as any).replyWithVoice === 'function') {
      await (ctx as any).replyWithVoice(file);
      return;
    }

    if (typeof (ctx as any).replyWithAudio === 'function') {
      await (ctx as any).replyWithAudio(file, {
        caption: 'Resposta em audio',
        title: path.basename(filePath),
      });
      return;
    }

    if (typeof (ctx as any).replyWithVoice === 'function') {
      await (ctx as any).replyWithVoice(file);
      return;
    }

    throw new Error('Nenhum metodo de envio de audio disponivel no Telegram.');
  }

  private splitIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      let splitIndex = remaining.lastIndexOf('\n', maxLength);
      if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
        splitIndex = remaining.lastIndexOf(' ', maxLength);
      }
      if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
        splitIndex = maxLength;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex).trimStart();
    }

    return chunks;
  }

  private async safeSend(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch (error: any) {
      if (error?.error_code === 429) {
        const retryAfter = error?.parameters?.retry_after || 5;
        await this.sleep(retryAfter * 1000);
        await ctx.reply(text);
        return;
      }

      if (error?.error_code === 403) {
        console.warn('[OutputHandler] Usuario bloqueou o bot. Mensagem descartada.');
        return;
      }

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
