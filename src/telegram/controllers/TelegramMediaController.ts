import { Context, InputFile } from 'grammy';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { config } from '../../config/index.js';
import { CapabilityLifecycleService } from '../../services/CapabilityLifecycleService.js';
import {
  CapabilityUnavailableError,
  isCapabilityUnavailableError,
  loadOptionalDependency,
} from '../../services/OptionalCapabilityGuard.js';
import { AudioHandler, type AudioTranscriptionResult } from '../AudioHandler.js';
import { logEchoTrace } from '../EchoTrace.js';
import { VideoHandler } from '../VideoHandler.js';
import { EchoOutputStageService } from '../../services/EchoOutputStageService.js';
import { safeFetch } from '../../security/SafeFetchService.js';
import { TelegramOpsInsightPresentationService } from './TelegramOpsInsightPresentationService.js';
import { wrapUntrustedContent } from '../../security/UntrustedContent.js';

type InlineData = Array<{ mimeType: string; data: string }>;
type EchoPreferenceStoreLike = {
  isEchoModeActive: () => Promise<boolean>;
};
type VoiceTranscriptEvaluation = {
  accepted: boolean;
  reason?: string;
  maxChars?: number;
};

type ConversationalDispatch = (
  ctx: Context,
  messageText: string,
  inlineData?: InlineData,
  ingressMetadata?: {
    traceId?: string | null;
    voiceFlow?: Record<string, unknown> | null;
    transport?: string | null;
    requestedBy?: string | null;
    preferredLanguageCode?: string | null;
  },
) => Promise<void>;

export class TelegramMediaController {
  private readonly opsPresentationService = new TelegramOpsInsightPresentationService();

  constructor(
    private audioHandler: AudioHandler,
    private videoHandler: VideoHandler,
    private dispatchConversational: ConversationalDispatch,
    private capabilityLifecycleService?: CapabilityLifecycleService,
    private echoPreferenceStore?: EchoPreferenceStoreLike | null,
    private echoOutputStage?: EchoOutputStageService | null,
  ) {}

  public async handlePhoto(ctx: Context): Promise<void> {
    const photoArray = ctx.message?.photo;
    if (!photoArray || photoArray.length === 0) return;

    const photo = photoArray[photoArray.length - 1];
    const caption = ctx.message?.caption || '';
    const userId = ctx.from!.id.toString();

    await ctx.api.sendChatAction(ctx.chat!.id, 'typing');

    try {
      const fileInfo = await ctx.api.getFile(photo.file_id);
      if (!fileInfo.file_path) throw new Error('Caminho nao retornado pelo Telegram.');

      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
      const response = await safeFetch(fileUrl, {}, {
        serviceName: 'Telegram photo download',
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      const inlineData = [{ mimeType: 'image/jpeg', data: buffer.toString('base64') }];

      const fullText = caption
        ? `[Imagem anexada]\n${caption}`
        : '[Imagem anexada] Por favor, analise ou descreva esta imagem.';

      await this.dispatchConversational(ctx, fullText, inlineData, {
        transport: 'photo',
        requestedBy: userId,
      });
    } catch (e: unknown) {
      await ctx.reply(`Nao consegui analisar essa foto agora.\n\nMotivo: ${getErrorMessage(e)}`);
    }
  }

  public async handleVoice(ctx: Context): Promise<void> {
    const userId = ctx.from!.id.toString();
    let filePath = '';
    const flowStartedAt = Date.now();
    const traceId = `telegram-voice-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await ctx.api.sendChatAction(ctx.chat!.id, 'record_voice');

    try {
      const file = ctx.message?.voice || ctx.message?.audio;
      if (!file) return;

      const fileInfo = await ctx.api.getFile(file.file_id);
      if (!fileInfo.file_path) throw new Error('Caminho nao retornado pelo Telegram.');

      filePath = path.join(config.tmpDir, `audio_${Date.now()}.ogg`);
      if (!fs.existsSync(config.tmpDir)) fs.mkdirSync(config.tmpDir, { recursive: true });

      const downloadStartedAt = Date.now();
      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
      const response = await safeFetch(fileUrl, {}, {
        serviceName: 'Telegram voice download',
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      const audioConfig = config.tools.media.audio;

      // Certification matrix: Injetar o Ã¡udio real como inlineData para processamento multimodal.
      // O Gemini poderÃ¡ "ouvir" entonaÃ§Ã£o, emoÃ§Ã£o e sons ambiente alÃ©m do texto.
      const audioInlineData: InlineData = [{
        mimeType: file.mime_type || 'audio/ogg',
        data: buffer.toString('base64'),
      }];
      const durationSeconds = this.resolveMediaDurationSeconds(file);
      const downloadLatencyMs = Date.now() - downloadStartedAt;
      logEchoTrace(traceId, 'voice.download.completed', {
        bytes: buffer.length,
        durationSec: durationSeconds || 'unknown',
        mimeType: file.mime_type || 'audio/ogg',
        latencyMs: downloadLatencyMs,
      });
      if (durationSeconds !== null && durationSeconds > audioConfig.sttMaxSeconds) {
        await ctx.reply(
          `Esse audio tem ${durationSeconds}s. O limite atual para STT automatico e ${audioConfig.sttMaxSeconds}s.`,
        );
        return;
      }
      if (buffer.length > audioConfig.sttMaxBytes) {
        await ctx.reply(
          `Esse audio tem ${Math.ceil(buffer.length / (1024 * 1024))} MB. O limite atual para STT automatico e ${Math.ceil(audioConfig.sttMaxBytes / (1024 * 1024))} MB.`,
        );
        return;
      }

      let transcript = '';
      let transcriptWarning = '';
      let transcriptionResult: AudioTranscriptionResult | null = null;
      try {
        transcriptionResult = await this.transcribeVoice(filePath, durationSeconds);
        transcript = transcriptionResult.text;
      } catch (transcriptionError: unknown) {
        const message = getErrorMessage(transcriptionError);
        transcriptWarning = message
          ? `\n[Transcricao local indisponivel: ${message}]`
          : '\n[Transcricao local indisponivel]';
      }
      logEchoTrace(traceId, transcriptionResult ? 'voice.stt.completed' : 'voice.stt.failed', {
        provider: transcriptionResult?.provider || 'none',
        model: transcriptionResult?.model || 'default',
        languageCode: transcriptionResult?.languageCode || 'unknown',
        latencyMs: transcriptionResult?.latencyMs ?? 0,
        failures: transcriptionResult?.failures.length ?? 0,
        warnings: transcriptionResult?.warnings.length ?? 0,
      });
      console.log(
        `[TelegramMedia] voice stt durationSec=${durationSeconds || 'unknown'} bytes=${buffer.length} provider=${transcriptionResult?.provider || 'none'} lang=${transcriptionResult?.languageCode || 'unknown'} sttMs=${transcriptionResult?.latencyMs ?? 0}`,
      );

      if (!transcript.trim()) {
        await this.replyToUntrustedVoice(
          ctx,
          transcriptWarning.trim() || 'transcricao local indisponivel',
          traceId,
          this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        );
        return;
      }

      const transcriptEvaluation = this.evaluateVoiceTranscript(transcript, durationSeconds);
      if (!transcriptEvaluation.accepted) {
        const reason = transcriptEvaluation.reason || 'transcricao automatica sem confianca';
        console.warn(`[TelegramMedia] Transcricao de audio descartada: ${reason}`);
        logEchoTrace(traceId, 'voice.stt.rejected', {
          reason,
          transcriptChars: transcript.length,
          maxChars: transcriptEvaluation.maxChars ?? 'n/a',
        });
        await this.replyToUntrustedVoice(
          ctx,
          reason,
          traceId,
          this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        );
        return;
      }

      if (audioConfig.echoTranscript) {
        await ctx.reply(`Transcricao detectada (${transcriptionResult?.languageCode || 'auto'}): ${transcript}`);
      }

      if (this.isVoiceConnectivityCheck(transcript)) {
        await this.replyToVoiceConnectivityCheck(
          ctx,
          transcript,
          traceId,
          this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        );
        return;
      }

      if (this.isVoiceReplyCapabilityCheck(transcript)) {
        await this.replyToVoiceReplyCapabilityCheck(
          ctx,
          transcript,
          traceId,
          this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        );
        return;
      }

      const messageText = this.normalizeVoiceTranscriptForDispatch(transcript) || `[Audio enviado para analise direta]${transcriptWarning}`;

      const dispatchStartedAt = Date.now();
      const voiceFlow = {
        traceId,
        startedAt: new Date(flowStartedAt).toISOString(),
        startedAtMs: flowStartedAt,
        downloadLatencyMs,
        inputBytes: buffer.length,
        durationSeconds,
        sttProvider: transcriptionResult?.provider || null,
        sttModel: transcriptionResult?.model || null,
        sttLanguageCode: transcriptionResult?.languageCode || null,
        sttLatencyMs: transcriptionResult?.latencyMs ?? null,
        sttWarnings: transcriptionResult?.warnings || [],
        sttFailures: transcriptionResult?.failures || [],
        transcriptChars: transcript.length,
        dispatchStartedAt: new Date(dispatchStartedAt).toISOString(),
        dispatchStartedAtMs: dispatchStartedAt,
      };
      logEchoTrace(traceId, 'voice.dispatch.started', {
        sttProvider: transcriptionResult?.provider || 'unknown',
        languageCode: this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        transcriptChars: transcript.length,
      });
      await this.dispatchConversational(
        ctx,
        messageText,
        audioConfig.forwardRawAudio ? audioInlineData : undefined,
        {
          traceId,
          voiceFlow,
          transport: 'voice',
          requestedBy: userId,
          preferredLanguageCode: this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        },
      );
      logEchoTrace(traceId, 'voice.dispatch.completed', {
        totalMs: Date.now() - flowStartedAt,
      });
      console.log(`[TelegramMedia] voice flow dispatched totalMs=${Date.now() - flowStartedAt}`);
    } catch (e: unknown) {
      if (isCapabilityUnavailableError(e)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(
          e,
          userId,
          'Para processar este audio eu preciso ativar uma capability opcional deste host.',
        ));
        return;
      }
      await ctx.reply(`Nao consegui transcrever esse audio agora.\n\nMotivo: ${getErrorMessage(e)}`);
    } finally {
      if (filePath) {
        this.audioHandler.cleanup(filePath);
      }
    }
  }

  public async handleVideo(ctx: Context): Promise<void> {
    const userId = ctx.from!.id.toString();
    const video = ctx.message?.video;
    const videoNote = ctx.message?.video_note;
    const caption = ctx.message?.caption || '';
    const target = video || videoNote;
    if (!target) return;

    await ctx.api.sendChatAction(ctx.chat!.id, 'typing');

    try {
      const descriptor = {
        fileId: target.file_id,
        fileName: video ? 'video-upload.mp4' : 'video-note.mp4',
        mimeType: video ? (video.mime_type || 'video/mp4') : 'video/mp4',
        caption,
        durationSeconds: target.duration,
        width: video ? video.width : videoNote?.length,
        height: video ? video.height : videoNote?.length,
      };

      const preparedVideo = await this.videoHandler.prepareFromTelegramVideo(ctx, descriptor);
      await this.dispatchConversational(ctx, preparedVideo.messageText, preparedVideo.inlineData, {
        transport: 'video',
        requestedBy: userId,
      });
      this.capabilityLifecycleService?.registerCapabilityUsage(
        'media',
        `media flow used by ${userId} via Telegram video`,
      );
    } catch (e: unknown) {
      if (isCapabilityUnavailableError(e)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(
          e,
          userId,
          'Para preparar esse video eu preciso ativar a trilha multimidia opcional.',
        ));
        return;
      }
      await ctx.reply(`Nao consegui processar esse video agora.\n\nMotivo: ${getErrorMessage(e)}`);
    }
  }

  public async handleDocument(ctx: Context): Promise<void> {
    const userId = ctx.from!.id.toString();
    const document = ctx.message?.document;
    if (!document) return;

    const mimeType = document.mime_type || '';
    const fileName = document.file_name || '';
    const fileSize = document.file_size || 0;
    const maxDocumentBytes = 10 * 1024 * 1024;
    const maxDocumentChars = 24000;

    if (this.videoHandler.isVideoDocument(fileName, mimeType)) {
      await this.handleVideo(ctx);
      return;
    }

    const lowerFileName = fileName.toLowerCase();
    const isPdf = mimeType === 'application/pdf' || lowerFileName.endsWith('.pdf');
    const isMd = lowerFileName.endsWith('.md');
    const isTxt = lowerFileName.endsWith('.txt');
    const isDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerFileName.endsWith('.docx');
    const isOdt =
      mimeType === 'application/vnd.oasis.opendocument.text' ||
      lowerFileName.endsWith('.odt');

    if (fileSize > maxDocumentBytes) {
      await ctx.reply(
        `Esse documento tem ${Math.ceil(fileSize / (1024 * 1024))} MB. O limite atual para leitura direta e ${Math.ceil(maxDocumentBytes / (1024 * 1024))} MB.`,
      );
      return;
    }

    if (!isPdf && !isMd && !isTxt && !isDocx && !isOdt) {
      await ctx.reply(
        'Por enquanto eu consigo ler PDFs, DOCX, ODT, arquivos Markdown, TXT e midias suportadas. Se quiser, me envie em um desses formatos.',
      );
      return;
    }

    await ctx.api.sendChatAction(ctx.chat!.id, 'typing');
    let filePath = '';

    try {
      const fileInfo = await ctx.api.getFile(document.file_id);
      if (!fileInfo.file_path) throw new Error('Caminho nao retornado.');

      filePath = path.join(
        config.tmpDir,
        `doc_${Date.now()}${isPdf ? '.pdf' : isDocx ? '.docx' : isOdt ? '.odt' : isMd ? '.md' : '.txt'}`,
      );
      if (!fs.existsSync(config.tmpDir)) fs.mkdirSync(config.tmpDir, { recursive: true });

      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
      const response = await safeFetch(fileUrl, {}, {
        serviceName: 'Telegram document download',
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      const text = await this.extractDocumentText({
        buffer,
        filePath,
        isPdf,
        isDocx,
        isOdt,
      });

      const normalizedText = text.trim();
      if (!normalizedText) {
        await ctx.reply('Esse documento nao trouxe texto legivel. Tente outro arquivo ou um documento com texto extraivel.');
        return;
      }

      const safeText =
        normalizedText.length > maxDocumentChars
          ? `${normalizedText.slice(0, maxDocumentChars)}\n\n...[Documento truncado para caber na analise inicial. Se precisar, solicite leitura segmentada.]`
          : normalizedText;

      const caption = ctx.message?.caption || '';
      const untrustedDocumentBlock = wrapUntrustedContent('untrusted_document_content', safeText, {
        source: 'telegram_document',
        file_name: fileName,
      });
      const fullText = caption
        ? `[Documento: ${fileName}]\n${caption}\n\n---\n${untrustedDocumentBlock}`
        : `[Documento: ${fileName}]\n${untrustedDocumentBlock}`;

      await this.dispatchConversational(ctx, fullText, undefined, {
        transport: 'document',
        requestedBy: userId,
      });
      if (isPdf) {
        this.capabilityLifecycleService?.registerCapabilityUsage(
          'media',
          `media flow used by ${userId} via Telegram PDF`,
        );
      }
    } catch (e: unknown) {
      if (isCapabilityUnavailableError(e)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(
          e,
          userId,
          'Para ler esse documento eu preciso ativar a trilha multimidia opcional deste host.',
        ));
        return;
      }
      await ctx.reply(`Nao consegui ler esse documento agora.\n\nMotivo: ${getErrorMessage(e)}`);
    } finally {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  private async extractDocumentText(input: {
    buffer: Buffer;
    filePath: string;
    isPdf: boolean;
    isDocx: boolean;
    isOdt: boolean;
  }): Promise<string> {
    if (input.isPdf) {
      const _pdfMod: any = await loadOptionalDependency<any>(
        'pdf-parse',
        'media',
        'O leitor de PDF opcional nao esta instalado neste host.',
      );
      const pdfParse = _pdfMod.default || _pdfMod;
      const pdfData = await pdfParse(input.buffer);
      return String(pdfData.text || '');
    }

    if (input.isDocx) {
      return this.extractZippedXmlText(input.buffer, 'word/document.xml');
    }

    if (input.isOdt) {
      return this.extractZippedXmlText(input.buffer, 'content.xml');
    }

    return fs.readFileSync(input.filePath, 'utf-8');
  }

  private async extractZippedXmlText(buffer: Buffer, internalPath: string): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file(internalPath);
    if (!entry) {
      throw new Error(`Estrutura interna nao encontrada: ${internalPath}`);
    }

    const xml = await entry.async('string');
    return this.normalizeXmlDocumentText(xml);
  }

  private normalizeXmlDocumentText(xml: string): string {
    return xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/text:p>/g, '\n')
      .replace(/<text:tab[^>]*\/>/g, '\t')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private buildCapabilityUnavailableReply(
    error: CapabilityUnavailableError,
    userId: string,
    reason: string,
  ): string {
    if (!this.capabilityLifecycleService) {
      return `${reason}\n\n${error.message}`;
    }

    const demand = this.capabilityLifecycleService.registerCapabilityDemand(
      error.capabilityId,
      userId,
      reason,
      error.dependencyName,
    );
    if (!demand) {
      return `${reason}\n\n${error.message}`;
    }

    return this.opsPresentationService.formatCapabilityApprovalReply(
      demand.capability,
      demand.approval,
      {
        reason,
        remediation: error.remediation,
        dependencyName: error.dependencyName,
      },
    );
  }

  private async transcribeVoice(
    filePath: string,
    durationSeconds?: number | null,
  ): Promise<AudioTranscriptionResult> {
    return await this.audioHandler.transcribeDetailed(filePath, {
      validator: (result) => this.evaluateVoiceTranscript(result.text, durationSeconds),
    });
  }

  private detectTranscriptLanguage(transcript: string): string {
    const normalized = this.normalizeForIntent(transcript);
    const ptHits = (normalized.match(/\b(voce|nao|sim|audio|noticias?|ultimas?|obrigado|consegue|ouvir|resuma|explique)\b/g) || []).length;
    const enHits = (normalized.match(/\b(you|not|yes|audio|news|latest|thanks|can|hear|summarize|explain)\b/g) || []).length;
    const esHits = (normalized.match(/\b(usted|tu|no|si|audio|noticias?|ultimas?|gracias|puedes|oir|resume|explica)\b/g) || []).length;
    if (ptHits >= enHits && ptHits >= esHits && ptHits > 0) return 'en-US';
    if (esHits >= enHits && esHits > 0) return 'es';
    if (enHits > 0) return 'en';
    return 'auto';
  }

  private resolveVoiceLanguageCode(transcript: string, providerLanguageCode?: string | null): string {
    const detected = this.detectTranscriptLanguage(transcript);
    const provider = String(providerLanguageCode || '').trim();
    if (!provider || provider === 'auto' || provider === 'und') {
      return detected;
    }
    if (detected !== 'auto' && !provider.toLowerCase().startsWith(detected.toLowerCase())) {
      return detected;
    }
    return provider;
  }

  private evaluateVoiceTranscript(
    transcript: string,
    durationSeconds?: number | null,
  ): VoiceTranscriptEvaluation {
    const normalizedTranscript = String(transcript || '').trim();
    if (!normalizedTranscript) {
      return { accepted: true };
    }

    if (normalizedTranscript.length > 6000) {
      return {
        accepted: false,
        reason: `transcricao grande demais (${normalizedTranscript.length} caracteres)`,
      };
    }

    const safeDuration = Number(durationSeconds);
    if (!Number.isFinite(safeDuration) || safeDuration <= 0) {
      return { accepted: true };
    }

    const roundedDuration = Math.max(1, Math.ceil(safeDuration));
    const maxChars = Math.max(160, Math.ceil(roundedDuration * 24 + 90));
    if (normalizedTranscript.length > maxChars) {
      return {
        accepted: false,
        maxChars,
        reason: `transcricao impossivel para ${roundedDuration}s (${normalizedTranscript.length}/${maxChars} caracteres)`,
      };
    }

    const wordCount = normalizedTranscript.split(/\s+/).filter(Boolean).length;
    const maxWords = Math.max(16, Math.ceil(roundedDuration * 3.4 + 10));
    if (wordCount > maxWords) {
      return {
        accepted: false,
        maxChars,
        reason: `palavras demais para ${roundedDuration}s (${wordCount}/${maxWords} palavras)`,
      };
    }

    const uncertainMarkers = (
      normalizedTranscript.match(/\[(?:uncertain|inaudible|unclear)\]/gi)
      || normalizedTranscript.match(/\[(?:incerto|inaudivel|inaudÃ­vel)\]/gi)
      || []
    ).length;
    if (uncertainMarkers > 0 && uncertainMarkers >= Math.max(1, Math.ceil(wordCount / 6))) {
      return {
        accepted: false,
        maxChars,
        reason: 'transcricao com marcadores de incerteza demais',
      };
    }

    const sentenceCount = normalizedTranscript
      .split(/[.!?]+/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .length;
    if (roundedDuration <= 8 && sentenceCount > 2 && normalizedTranscript.length > 120) {
      return {
        accepted: false,
        maxChars,
        reason: `transcricao estruturada demais para audio curto (${sentenceCount} frases em ${roundedDuration}s)`,
      };
    }

    return { accepted: true, maxChars };
  }

  private resolveMediaDurationSeconds(file: unknown): number | null {
    const duration = Number((file as any)?.duration);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  }

  private isVoiceConnectivityCheck(transcript: string): boolean {
    const normalized = this.normalizeForIntent(transcript);
    if (!normalized) {
      return false;
    }

    return (
      /\b(consegue|consegues|pode)\b.*\b(me\s+)?ouvir\b/.test(normalized)
      || /\bconseguindo\b.*\b(me\s+)?ouvir\b/.test(normalized)
      || /\b(esta|ta)\b.*\b(me\s+)?ouvindo\b/.test(normalized)
      || /\bme\s+ouve\b/.test(normalized)
      || /\b(can|could|do)\b.*\b(you\s+)?hear\s+me\b/.test(normalized)
      || /\bare\s+you\s+hearing\s+me\b/.test(normalized)
      || /\b(me\s+)?escuchas\b/.test(normalized)
      || /\bpuedes\b.*\boirme\b/.test(normalized)
    );
  }

  private isVoiceReplyCapabilityCheck(transcript: string): boolean {
    const normalized = this.normalizeForIntent(transcript);
    if (!normalized || normalized.length > 160) {
      return false;
    }

    const asksVoice =
      /\b(consegue|pode|poderia)\b.*\b(responder|responda|mandar|enviar|falar)\b.*\b(audio|voz)\b/.test(normalized)
      || /\b(me\s+)?responde\b.*\b(audio|voz)\b/.test(normalized)
      || /\b(audio|voz)\b.*\b(resposta|responder|responda)\b/.test(normalized)
      || /\b(can|could)\b.*\b(reply|answer|respond|send)\b.*\b(audio|voice)\b/.test(normalized)
      || /\b(puedes|podrias)\b.*\b(responder|enviar|mandar)\b.*\b(audio|voz)\b/.test(normalized);
    const hasSubstantiveRequest =
      /\b(notici|pesquis|procure|explique|resuma|relatorio|compare|analise|diga\s+sobre|sobre)\b/.test(normalized);
    return asksVoice && !hasSubstantiveRequest;
  }

  private normalizeForIntent(value: string): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeVoiceTranscriptForDispatch(transcript: string): string {
    return String(transcript || '')
      .trim()
      .replace(/^\s*(?:zavorth|echo|nexus|jarvis|friday)\b[\s,;:.!?-]*/i, '')
      .trim();
  }

  private async replyToVoiceConnectivityCheck(
    ctx: Context,
    transcript = '',
    traceId?: string,
    preferredLanguageCode?: string | null,
  ): Promise<void> {
    const reply = this.resolveSafetyMessage(ctx, 'connectivity', transcript, preferredLanguageCode);
    if (await this.tryEchoSafetyReply(ctx, reply, this.resolveSafetyLanguage(ctx, transcript, preferredLanguageCode), traceId)) {
      return;
    }
    await ctx.reply(reply);
  }

  private async replyToVoiceReplyCapabilityCheck(
    ctx: Context,
    transcript = '',
    traceId?: string,
    preferredLanguageCode?: string | null,
  ): Promise<void> {
    const language = this.resolveSafetyLanguage(ctx, transcript, preferredLanguageCode);
    const reply = language === 'pt'
      ? 'Sim. Quando o Echo estiver ativo, eu consigo te responder em audio. Vou manter as respostas mais curtas para ficarem boas de ouvir.'
      : language === 'es'
        ? 'Si. Cuando Echo este activo, puedo responderte en audio. Mantendre las respuestas mas cortas para que sean buenas de escuchar.'
        : 'Yes. When Echo is active, I can reply with audio. I will keep voice replies concise so they are easier to listen to.';
    if (await this.tryEchoSafetyReply(ctx, reply, language, traceId)) {
      return;
    }
    await ctx.reply(reply);
  }

  private async replyToUntrustedVoice(
    ctx: Context,
    reason: string,
    traceId?: string,
    preferredLanguageCode?: string | null,
  ): Promise<void> {
    const safeReply = this.resolveSafetyMessage(ctx, 'untrusted', '', preferredLanguageCode);

    if (await this.tryEchoSafetyReply(ctx, safeReply, this.resolveSafetyLanguage(ctx, '', preferredLanguageCode), traceId)) {
      return;
    }

    await ctx.reply(`${safeReply}\n\n${this.resolveSafetyDetailLabel(ctx, preferredLanguageCode)}: ${reason}`);
  }

  private resolveSafetyMessage(
    ctx: Context,
    kind: 'connectivity' | 'untrusted',
    transcript = '',
    preferredLanguageCode?: string | null,
  ): string {
    const languageCode = this.resolveSafetyLanguage(ctx, transcript, preferredLanguageCode);

    if (languageCode === 'pt') {
      return kind === 'connectivity'
        ? 'Sim, consigo te ouvir corretamente.'
        : 'Recebi seu audio, mas a transcricao automatica veio inconsistente. Nao vou inventar conteudo em cima disso. Pode repetir em uma frase curta?';
    }

    if (languageCode === 'es') {
      return kind === 'connectivity'
        ? 'Si, puedo escucharte correctamente.'
        : 'Recibi tu audio, pero la transcripcion automatica fue inconsistente. No voy a inventar contenido. Puedes repetirlo en una frase corta?';
    }

    return kind === 'connectivity'
      ? 'Yes, I can hear you correctly.'
      : 'I received your audio, but the automatic transcription looked unreliable. I will not invent content from it. Could you repeat it in one short sentence?';
  }

  private resolveSafetyDetailLabel(ctx: Context, preferredLanguageCode?: string | null): string {
    const language = this.resolveSafetyLanguage(ctx, '', preferredLanguageCode);
    if (language === 'pt') {
      return 'Detalhe tecnico';
    }
    if (language === 'es') {
      return 'Detalle tecnico';
    }
    return 'Technical detail';
  }

  private resolveSafetyLanguage(
    ctx: Context,
    transcript = '',
    preferredLanguageCode?: string | null,
  ): 'en' | 'es' | 'pt' {
    const explicitLanguage = String(preferredLanguageCode || '').toLowerCase();
    if (explicitLanguage.startsWith('pt')) {
      return 'pt';
    }
    if (explicitLanguage.startsWith('es')) {
      return 'es';
    }
    if (explicitLanguage.startsWith('en')) {
      return 'en';
    }

    const normalizedTranscript = this.normalizeForIntent(transcript);
    if (/\b(consegue|consegues|pode|ouvir|ouvindo|ouve)\b/.test(normalizedTranscript)) {
      return 'pt';
    }
    if (/\b(escuchas|puedes|oirme)\b/.test(normalizedTranscript)) {
      return 'es';
    }

    const languageCode = String((ctx.from as { language_code?: string } | undefined)?.language_code || '')
      .toLowerCase();
    if (languageCode.startsWith('pt')) {
      return 'pt';
    }
    if (languageCode.startsWith('es')) {
      return 'es';
    }
    return 'en';
  }

  private async tryEchoSafetyReply(
    ctx: Context,
    text: string,
    preferredLanguage: 'en' | 'es' | 'pt' = 'en',
    traceId?: string,
  ): Promise<boolean> {
    try {
      const outputStage = this.echoOutputStage || new EchoOutputStageService({
        audioHandler: this.audioHandler,
        preferenceStore: this.echoPreferenceStore || null,
      });
      const result = await outputStage.deliver({
        surface: 'telegram',
        text,
        rawInput: `Detected language: ${preferredLanguage === 'pt' ? 'en-US' : preferredLanguage}`,
        traceId,
        requestedBy: 'telegram-bot-safety',
        sessionId: ctx.chat?.id ? String(ctx.chat.id) : '',
        preferredLanguageCode: preferredLanguage === 'pt' ? 'en-US' : preferredLanguage,
        policyHint: 'safety',
        forceVoice: true,
        fallbackToText: false,
        sink: {
          sendText: async () => undefined,
          sendChatAction: async (action) => {
            if (!ctx.chat?.id) {
              return;
            }
            await ctx.api.sendChatAction(ctx.chat.id, action);
          },
          sendVoice: async (audioPath) => {
            await ctx.replyWithVoice(new InputFile(audioPath));
          },
        },
      });
      if (traceId && result.delivered === 'voice') {
        logEchoTrace(traceId, 'voice.safety.completed', {
          spokenChars: result.spokenChars || 0,
        });
      }
      return result.delivered === 'voice';
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      console.warn(`[TelegramMedia] Falha no Echo de seguranca para audio sem confianca: ${message}`);
      return false;
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || 'erro desconhecido');
}
