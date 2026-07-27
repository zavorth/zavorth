import { Context, InputFile, InlineKeyboard } from 'grammy';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DndService } from './DndService.js';
import { logger } from '../logger.js';

const SPLIT_THRESHOLD = 3800;

// Telegram reply markup types (ForceReply, ReplyKeyboardMarkup, ReplyKeyboardRemove, InlineKeyboardMarkup)
type TelegramReplyMarkup = Record<string, unknown>;

type ReplyMarkup = InlineKeyboard | TelegramReplyMarkup | undefined;

type SmartOutputOptions = {
  parse_mode?: 'Markdown' | 'HTML';
  prefix?: string;
  reply_markup?: ReplyMarkup;
  includeDeleteAction?: boolean;
};

type SendMessageOptions = {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: ReplyMarkup;
  caption?: string;
};

type SendDocumentOptions = {
  caption?: string;
  reply_markup?: ReplyMarkup;
};

type BotApiLike = {
  sendMessage(chatId: string | number, text: string, options?: SendMessageOptions): Promise<unknown>;
  sendDocument?(chatId: string | number, document: InputFile, options?: SendDocumentOptions): Promise<unknown>;
};

type SendTarget = {
  sendText(text: string, options?: SendMessageOptions): Promise<unknown>;
  sendDocument?: (filePath: string, fileName: string, options?: SendDocumentOptions) => Promise<unknown>;
};

// Extended Context that may have replyWithDocument (grammy bot context)
type ExtendedContext = Context & {
  replyWithDocument?: (document: InputFile, options?: SendDocumentOptions) => Promise<unknown>;
};

export class SmartOutputService {
  public static async reply(
    ctx: Context,
    text: string,
    options?: SmartOutputOptions,
  ): Promise<void> {
    const fullText = options?.prefix ? `${options.prefix}\n\n${text}` : text;

    // Check DND (Do Not Disturb) for chatbot messages
    if (ctx.chat?.id) {
       const isQueued = await DndService.queueMessageOrSend(null, ctx.chat.id, fullText);
       if (isQueued) return;
    }

    const replyMarkup = this.resolveReplyMarkup(options);

    if (fullText.length <= SPLIT_THRESHOLD) {
      await this.sendTextWithFormattingFallback(
        (nextText, sendOptions) => ctx.reply(nextText, sendOptions as Parameters<Context['reply']>[1]),
        fullText,
        {
          parse_mode: options?.parse_mode,
          reply_markup: replyMarkup as TelegramReplyMarkup,
        },
      );
      return;
    }

    const extendedCtx = ctx as ExtendedContext;

    await this.sendLongText(
      {
        sendText: (nextText, sendOptions) => ctx.reply(nextText, sendOptions as Parameters<Context['reply']>[1]),
        sendDocument:
          typeof extendedCtx.replyWithDocument === 'function'
            ? (filePath, fileName, sendOptions) =>
                extendedCtx.replyWithDocument!(new InputFile(filePath, fileName), sendOptions)
            : undefined,
      },
      fullText,
      {
        reply_markup: replyMarkup,
      },
    );
  }

  public static async send(
    botApi: BotApiLike,
    chatId: string | number,
    text: string,
    options?: Omit<SmartOutputOptions, 'includeDeleteAction'>,
  ): Promise<void> {
    const fullText = options?.prefix ? `${options.prefix}\n\n${text}` : text;

    // Check DND (Do Not Disturb) for background sending
    const isQueued = await DndService.queueMessageOrSend(botApi, chatId, fullText);
    if (isQueued) return;

    if (fullText.length <= SPLIT_THRESHOLD) {
      await this.sendTextWithFormattingFallback(
        (nextText, sendOptions) => botApi.sendMessage(chatId, nextText, sendOptions),
        fullText,
        {
          parse_mode: options?.parse_mode,
          reply_markup: options?.reply_markup,
        },
      );
      return;
    }

    await this.sendLongText(
      {
        sendText: (nextText, sendOptions) => botApi.sendMessage(chatId, nextText, sendOptions),
        sendDocument:
          typeof botApi.sendDocument === 'function'
            ? (filePath, fileName, sendOptions) =>
                botApi.sendDocument!(chatId, new InputFile(filePath, fileName), sendOptions)
            : undefined,
      },
      fullText,
      {
        reply_markup: options?.reply_markup,
      },
    );
  }

  private static async sendLongText(
    target: SendTarget,
    text: string,
    options?: {
      reply_markup?: ReplyMarkup;
    },
  ): Promise<void> {
    if (target.sendDocument) {
      try {
        await this.sendAsDocument(target, text, options);
        return;
      } catch (error: unknown) {logger.warn('[Smart Output] filesystem check failed', error);
    // Fall back to chunked messages when this context cannot upload documents
        // or when Telegram rejects the upload.
  }
    }

    await this.sendAsChunks(target, text, options);
  }

  private static async sendTextWithFormattingFallback(
    sendText: (text: string, options?: SendMessageOptions) => Promise<unknown>,
    text: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    try {
      await sendText(text, options);
      return;
    } catch (error: unknown) {if (!this.shouldRetryWithoutParseMode(error, options)) {
        throw error;
      }
    }

    const fallbackOptions = { ...(options || {}) };
    delete fallbackOptions.parse_mode;
    await sendText(text, fallbackOptions);
  }

  private static shouldRetryWithoutParseMode(error: unknown, options?: SendMessageOptions): boolean {
    const parseMode = String(options?.parse_mode || '').trim();
    if (!parseMode) {
      return false;
    }

    const errorObj = error as { message?: string } | string;
    const message = String(typeof errorObj === 'object' ? errorObj?.message : errorObj || '').toLowerCase();
    return message.includes("can't parse entities") || message.includes('cant parse entities');
  }

  private static async sendAsDocument(
    target: SendTarget,
    text: string,
    options?: {
      reply_markup?: ReplyMarkup;
    },
  ): Promise<void> {
    const tmpDir = path.join(os.tmpdir(), 'zavorth-output');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const filename = `zavorth-response-${Date.now()}.txt`;
    const filepath = path.join(tmpDir, filename);

    try {
      fs.writeFileSync(filepath, text, 'utf-8');
      const summary = this.generateSummary(text);

      await target.sendDocument!(filepath, filename, {
        caption: `Documento completo (${text.length} caracteres)\n\n${summary}`.slice(0, 1024),
        reply_markup: options?.reply_markup,
      });
    } finally {
      try {
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (error: unknown) {// ignore cleanup errors
      logger.warn('[Smart Output] file cleanup failed', error);
    }
    }
  }

  private static async sendAsChunks(
    target: SendTarget,
    text: string,
    options?: {
      reply_markup?: ReplyMarkup;
    },
  ): Promise<void> {
    const chunks = this.splitMessage(text, 3600);

    for (const [index, chunk] of chunks.entries()) {
      const prefix = chunks.length > 1 ? `Parte ${index + 1}/${chunks.length}\n` : '';
      await target.sendText(`${prefix}${chunk}`, {
        reply_markup: index === 0 ? options?.reply_markup : undefined,
      });
    }
  }

  private static generateSummary(text: string): string {
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    let summary = '';

    for (const line of lines) {
      if (summary.length + line.length > 800) {
        break;
      }
      summary += `${line}\n`;
    }

    if (summary.length < text.length) {
      summary += '\n... (continue reading the file to see everything)';
    }

    return summary.trim();
  }

  public static splitMessage(text: string, maxLength = SPLIT_THRESHOLD): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if (current.length + line.length + 1 > maxLength) {
        if (current.length > 0) {
          chunks.push(current.trimEnd());
          current = '';
        }

        if (line.length > maxLength) {
          for (let index = 0; index < line.length; index += maxLength) {
            chunks.push(line.substring(index, index + maxLength));
          }
          continue;
        }
      }

      current += (current.length > 0 ? '\n' : '') + line;
    }

    if (current.length > 0) {
      chunks.push(current.trimEnd());
    }

    return chunks;
  }

  private static resolveReplyMarkup(options?: SmartOutputOptions): ReplyMarkup {
    if (options?.reply_markup) {
      return options.reply_markup;
    }

    if (options?.includeDeleteAction === false) {
      return undefined;
    }

    return new InlineKeyboard().text('Apagar', 'action:delete');
  }
}
