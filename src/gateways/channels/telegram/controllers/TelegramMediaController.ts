import { logger } from '../../../../logger.js';
import { TypingHeartbeat } from '../../../../channels/presence/TypingHeartbeat.js';
import { Context, InputFile } from 'grammy';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { config } from '@zavorth/config/index.js';
import { t } from '../../../../gateways/channels/telegram/i18n.js';
import { CapabilityLifecycleService } from '@zavorth/services/CapabilityLifecycleService.js';
import {
  CapabilityUnavailableError,
  isCapabilityUnavailableError,
  loadOptionalDependency,
} from '@zavorth/services/OptionalCapabilityGuard.js';
import { AudioHandler, type AudioTranscriptionResult } from '../../../../gateways/channels/telegram/AudioHandler.js';

import { logEchoTrace } from '../../../../gateways/channels/telegram/EchoTrace.js';
import { VideoHandler } from '../../../../services/media/VideoHandler.js';
import { EchoOutputStageService } from '@zavorth/services/EchoOutputStageService.js';
import { safeFetch } from '@zavorth/security/SafeFetchService.js';
import { TelegramOpsInsightPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramOpsInsightPresentationService.js';
import { wrapUntrustedContent } from '@zavorth/security/UntrustedContent.js';
import { asErrorLike } from '../../../../utils/errorLike.js';
import {
  formatDictationTranscriptNotice,
  getVoiceDictationIngress,
  normalizeDictationTranscript,
} from '../../../../services/voice/VoiceDictationIngress.js';
import { getVoicePreferenceService } from '../../../../services/voice/VoicePreferenceService.js';

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
  /** F5f — optional permission decision from STT transcript (Zavorth AudioTranscriptionService path). */
  private voicePermissionHandler: ((ctx: Context, transcript: string) => Promise<boolean>) | null = null;

  constructor(
    private audioHandler: AudioHandler,
    private videoHandler: VideoHandler,
    private dispatchConversational: ConversationalDispatch,
    private capabilityLifecycleService?: CapabilityLifecycleService,
    private echoPreferenceStore?: EchoPreferenceStoreLike | null,
    private echoOutputStage?: EchoOutputStageService | null,
  ) {}

  public setVoicePermissionHandler(handler: ((ctx: Context, transcript: string) => Promise<boolean>) | null): void {
    this.voicePermissionHandler = handler;
  }

  public async handlePhoto(ctx: Context): Promise<void> {
    const photoArray = ctx.message?.photo;
    if (!photoArray || photoArray.length === 0) return;

    const photo = photoArray[photoArray.length - 1];
    const caption = ctx.message?.caption || '';
    const userId = ctx.from!.id.toString();

    const chatIdForTyping1 = ctx.chat?.id;
        const typingHeartbeat1 =
          chatIdForTyping1
            ? new TypingHeartbeat({ sendAction: () => ctx.api.sendChatAction(chatIdForTyping1, 'typing') })
            : null;
    typingHeartbeat1?.start();

    try {
      const fileInfo = await ctx.api.getFile(photo.file_id);
      if (!fileInfo.file_path) throw new Error(t('media.path_not_returned'));

      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
      const response = await safeFetch(
        fileUrl,
        {},
        {
          serviceName: 'Telegram photo download',
        },
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      const inlineData = [{ mimeType: 'image/jpeg', data: buffer.toString('base64') }];

      const fullText = caption ? `${t('media.image_attached')}\n${caption}` : t('media.image_attached_prompt');

      await this.dispatchConversational(ctx, fullText, inlineData, {
        transport: 'photo',
        requestedBy: userId,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await ctx.reply(t('media.photo_analysis_failed', { error: getErrorMessage(err) }));
    } finally {
      typingHeartbeat1?.stop();
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
      if (!fileInfo.file_path) throw new Error(t('media.path_not_returned'));

      filePath = path.join(config.tmpDir, `audio_${Date.now()}.ogg`);
      if (!fs.existsSync(config.tmpDir)) fs.mkdirSync(config.tmpDir, { recursive: true });

      const downloadStartedAt = Date.now();
      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
      const response = await safeFetch(
        fileUrl,
        {},
        {
          serviceName: 'Telegram voice download',
        },
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      const audioConfig = config.tools.media.audio;

      // Inject real audio as inlineData for multimodal processing.
      // Gemini can "hear" intonation, emotion, and ambient sounds beyond text.
      const audioInlineData: InlineData = [
        {
          mimeType: file.mime_type || 'audio/ogg',
          data: buffer.toString('base64'),
        },
      ];
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
          `This audio is ${durationSeconds}s. The current limit for automatic STT is ${audioConfig.sttMaxSeconds}s.`,
        );
        return;
      }
      if (buffer.length > audioConfig.sttMaxBytes) {
        await ctx.reply(
          `This audio is ${Math.ceil(buffer.length / (1024 * 1024))} MB. The current limit for automatic STT is ${Math.ceil(audioConfig.sttMaxBytes / (1024 * 1024))} MB.`,
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
        asErrorLike(transcriptionError);

        const message = getErrorMessage(transcriptionError);
        transcriptWarning = message
          ? t('media.transcription_unavailable_detail', { error: message })
          : t('media.transcription_unavailable');
      }
      logEchoTrace(traceId, transcriptionResult ? 'voice.stt.completed' : 'voice.stt.failed', {
        provider: transcriptionResult?.provider || 'none',
        model: transcriptionResult?.model || 'default',
        languageCode: transcriptionResult?.languageCode || 'unknown',
        latencyMs: transcriptionResult?.latencyMs ?? 0,
        failures: transcriptionResult?.failures.length ?? 0,
        warnings: transcriptionResult?.warnings.length ?? 0,
      });
      logger.info(
        `[TelegramMedia] voice stt durationSec=${durationSeconds || 'unknown'} bytes=${buffer.length} provider=${transcriptionResult?.provider || 'none'} lang=${transcriptionResult?.languageCode || 'unknown'} sttMs=${transcriptionResult?.latencyMs ?? 0}`,
      );

      if (!transcript.trim()) {
        await this.replyToUntrustedVoice(
          ctx,
          transcriptWarning.trim() || t('media.transcription_unavailable_fallback'),
          traceId,
          this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        );
        return;
      }

      const transcriptEvaluation = this.evaluateVoiceTranscript(transcript, durationSeconds);
      if (!transcriptEvaluation.accepted) {
        const reason = transcriptEvaluation.reason || 'automatic transcription without confidence';
        logger.warn(`[TelegramMedia] Transcricao de audio descartada: ${reason}`);
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
        await ctx.reply(`Transcript detected (${transcriptionResult?.languageCode || 'auto'}): ${transcript}`);
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

      // F5f — if STT text is an approval decision for a pending task, consume it here
      // (uses same transcript already produced by AudioTranscriptionService / AudioHandler).
      if (this.voicePermissionHandler) {
        try {
          const consumed = await this.voicePermissionHandler(ctx, transcript);
          if (consumed) {
            logEchoTrace(traceId, 'voice.permission.consumed', {
              transcriptChars: transcript.length,
              sttProvider: transcriptionResult?.provider || 'unknown',
            });
            return;
          }
        } catch (permissionError: unknown) {
          logger.warn('[TelegramMedia] voice permission handler failed', permissionError);
        }
      }

      // dictation-first: transcript is the same agent input as typing.
      const dictation = getVoiceDictationIngress().prepare({
        transcript,
        provider: transcriptionResult?.provider || null,
        model: transcriptionResult?.model || null,
        languageCode: transcriptionResult?.languageCode || null,
        preference: getVoicePreferenceService().get(),
        surface: 'telegram',
        forceShowTranscript: Boolean(audioConfig.echoTranscript),
      });

      if (!dictation.ok) {
        const hint = dictation.configureHint ? `\n\n${dictation.configureHint}` : '';
        await ctx.reply(`${dictation.message}${hint}`.trim());
        logEchoTrace(traceId, 'voice.dictation.blocked', {
          code: dictation.code,
          message: dictation.message,
        });
        return;
      }

      if (dictation.showTranscript) {
        await ctx.reply(
          formatDictationTranscriptNotice({
            transcript: dictation.transcriptPreview,
            languageCode: transcriptionResult?.languageCode || null,
            provider: transcriptionResult?.provider || null,
            lowConfidence: dictation.lowConfidence,
          }),
        );
      }

      // Never invent media placeholders — agentText is pure dictation.
      const messageText = this.normalizeVoiceTranscriptForDispatch(dictation.agentText);

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
        transcriptChars: messageText.length,
        dispatchStartedAt: new Date(dispatchStartedAt).toISOString(),
        dispatchStartedAtMs: dispatchStartedAt,
        dictationMode: dictation.mode,
        dictationReason: dictation.reason,
        ttsReplyDesired: dictation.ttsReplyDesired,
        source: 'voice_dictation',
      };
      logEchoTrace(traceId, 'voice.dispatch.started', {
        sttProvider: transcriptionResult?.provider || 'unknown',
        languageCode: this.resolveVoiceLanguageCode(transcript, transcriptionResult?.languageCode || null),
        transcriptChars: messageText.length,
        dictationMode: dictation.mode,
      });
      await this.dispatchConversational(
        ctx,
        messageText,
        // Dictation-first: do not inject raw audio as multimodal by default.
        // Raw audio only when explicitly enabled AND conversation mode (not plain dictation).
        audioConfig.forwardRawAudio && dictation.mode === 'conversation' ? audioInlineData : undefined,
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
      logger.info(`[TelegramMedia] voice flow dispatched totalMs=${Date.now() - flowStartedAt}`);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (isCapabilityUnavailableError(err)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(err, userId, t('media.audio_processing_capability')));
        return;
      }
      await ctx.reply(t('media.audio_transcription_failed', { error: getErrorMessage(err) }));
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

    const chatIdForTyping2 = ctx.chat?.id;
        const typingHeartbeat2 =
          chatIdForTyping2
            ? new TypingHeartbeat({ sendAction: () => ctx.api.sendChatAction(chatIdForTyping2, 'typing') })
            : null;
    typingHeartbeat2?.start();

    try {
      const descriptor = {
        fileId: target.file_id,
        fileName: video ? 'video-upload.mp4' : 'video-note.mp4',
        mimeType: video ? video.mime_type || 'video/mp4' : 'video/mp4',
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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (isCapabilityUnavailableError(err)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(err, userId, t('media.video_processing_capability')));
        return;
      }
      await ctx.reply(t('media.video_processing_failed', { error: getErrorMessage(err) }));
    } finally {
      typingHeartbeat2?.stop();
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
    const isOdt = mimeType === 'application/vnd.oasis.opendocument.text' || lowerFileName.endsWith('.odt');

    if (fileSize > maxDocumentBytes) {
      await ctx.reply(
        `This document is ${Math.ceil(fileSize / (1024 * 1024))} MB. The current limit for direct reading is ${Math.ceil(maxDocumentBytes / (1024 * 1024))} MB.`,
      );
      return;
    }

    if (!isPdf && !isMd && !isTxt && !isDocx && !isOdt) {
      await ctx.reply(t('media.unsupported_format'));
      return;
    }

    const chatIdForTyping3 = ctx.chat?.id;
        const typingHeartbeat3 =
          chatIdForTyping3
            ? new TypingHeartbeat({ sendAction: () => ctx.api.sendChatAction(chatIdForTyping3, 'typing') })
            : null;
    typingHeartbeat3?.start();
    let filePath = '';

    try {
      const fileInfo = await ctx.api.getFile(document.file_id);
      if (!fileInfo.file_path) throw new Error(t('media.path_not_returned'));

      filePath = path.join(
        config.tmpDir,
        `doc_${Date.now()}${isPdf ? '.pdf' : isDocx ? '.docx' : isOdt ? '.odt' : isMd ? '.md' : '.txt'}`,
      );
      if (!fs.existsSync(config.tmpDir)) fs.mkdirSync(config.tmpDir, { recursive: true });

      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${fileInfo.file_path}`;
      const response = await safeFetch(
        fileUrl,
        {},
        {
          serviceName: 'Telegram document download',
        },
      );
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
        await ctx.reply(t('media.document_no_text'));
        return;
      }

      const safeText =
        normalizedText.length > maxDocumentChars ? `${normalizedText.slice(0, maxDocumentChars)}\n\n...${t('media.document_truncated')}`
          : normalizedText;

      const caption = ctx.message?.caption || '';
      const untrustedDocumentBlock = wrapUntrustedContent('untrusted_document_content', safeText, {
        source: 'telegram_document',
        file_name: fileName,
      });
      const fullText = caption ? `${t('media.document_prefix', { name: fileName })}\n${caption}\n\n---\n${untrustedDocumentBlock}`
        : `${t('media.document_prefix', { name: fileName })}\n${untrustedDocumentBlock}`;

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
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (isCapabilityUnavailableError(err)) {
        await ctx.reply(this.buildCapabilityUnavailableReply(err, userId, t('media.document_reading_capability')));
        return;
      }
      await ctx.reply(t('media.document_reading_failed', { error: getErrorMessage(err) }));
    } finally {
      typingHeartbeat3?.stop();
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
      const _pdfMod: Record<string, unknown> = await loadOptionalDependency<Record<string, unknown>>(
        'pdf-parse',
        'media',
        t('media.pdf_reader_missing'),
      );
      const pdfParse = (_pdfMod.default || _pdfMod) as (buffer: Buffer) => Promise<{ text: string }>;
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
      throw new Error(`Internal structure not found: ${internalPath}`);
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
      .replace(/\n{3}/g, '\n\n')
      .replace(/[ \t]{2}/g, ' ')
      .trim();
  }

  private buildCapabilityUnavailableReply(error: CapabilityUnavailableError, userId: string, reason: string): string {
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

    return this.opsPresentationService.formatCapabilityApprovalReply(demand.capability, demand.approval, {
      reason,
      remediation: error.remediation,
      dependencyName: error.dependencyName,
    });
  }

  private async transcribeVoice(filePath: string, durationSeconds?: number | null): Promise<AudioTranscriptionResult> {
    return await this.audioHandler.transcribeDetailed(filePath, {
      validator: (result) => this.evaluateVoiceTranscript(result.text, durationSeconds),
    });
  }

  private detectTranscriptLanguage(_transcript: string): string {
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

  private evaluateVoiceTranscript(transcript: string, durationSeconds?: number | null): VoiceTranscriptEvaluation {
    const normalizedTranscript = String(transcript || '').trim();
    if (!normalizedTranscript) {
      return { accepted: true };
    }

    if (normalizedTranscript.length > 6000) {
      return {
        accepted: false,
        reason: `transcription too large (${normalizedTranscript.length} characters)`,
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
        reason: `transcription impossible for ${roundedDuration}s (${normalizedTranscript.length}/${maxChars} characters)`,
      };
    }

    const wordCount = normalizedTranscript.split(/\s+/).filter(Boolean).length;
    const maxWords = Math.max(16, Math.ceil(roundedDuration * 3.4 + 10));
    if (wordCount > maxWords) {
      return {
        accepted: false,
        maxChars,
        reason: `too many words for ${roundedDuration}s (${wordCount}/${maxWords} words)`,
      };
    }

    const uncertainMarkers = (normalizedTranscript.match(/\[(?:uncertain|inaudible|unclear)\]/gi) || []).length;
    if (uncertainMarkers > 0 && uncertainMarkers >= Math.max(1, Math.ceil(wordCount / 6))) {
      return {
        accepted: false,
        maxChars,
        reason: 'transcript contains too many uncertainty markers',
      };
    }

    const sentenceCount = normalizedTranscript
      .split(/[.!...]+/)
      .map((entry) => entry.trim())
      .filter(Boolean).length;
    if (roundedDuration <= 8 && sentenceCount > 2 && normalizedTranscript.length > 120) {
      return {
        accepted: false,
        maxChars,
        reason: `transcription too structured for short audio (${sentenceCount} sentences in ${roundedDuration}s)`,
      };
    }

    return { accepted: true, maxChars };
  }

  private resolveMediaDurationSeconds(file: unknown): number | null {
    const duration = Number((file as unknown as Record<string, unknown>)?.duration);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  }

  /**
   * Free-text voice-capability FAQs must not short-circuit the agent product path.
   * Voice reply is activated only by structured flags (voiceFlow.ttsReplyDesired,
   * forceVoice, session conversation mode) — never by transcript keyword packs.
   */
  private isVoiceReplyCapabilityCheck(_transcript: string): boolean {
    return false;
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
    // same normalization as VoiceDictationIngress (no media placeholders).
    const cleaned = normalizeDictationTranscript(transcript)
      .replace(/^\s*(?:zavorth|echo|nexus|jarvis|friday)\b[\s,;:.!...-]*/i, '')
      .trim();
    return cleaned;
  }

  private async replyToVoiceConnectivityCheck(
    ctx: Context,
    transcript = '',
    traceId?: string,
    preferredLanguageCode?: string | null,
  ): Promise<void> {
    const reply = this.resolveSafetyMessage(ctx, 'connectivity', transcript, preferredLanguageCode);
    if (
      await this.tryEchoSafetyReply(
        ctx,
        reply,
        this.resolveSafetyLanguage(ctx, transcript, preferredLanguageCode),
        traceId,
      )
    ) {
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
    const reply =
      language === 'pt'
        ? 'Yes. When Echo is active, I can reply with audio. I will keep voice replies concise so they are easier to listen to.'
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

    if (
      await this.tryEchoSafetyReply(ctx, safeReply, this.resolveSafetyLanguage(ctx, '', preferredLanguageCode), traceId)
    ) {
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
      return kind === 'connectivity' ? t('media.audio_connectivity_pt') : t('media.audio_inconsistent_pt');
    }

    if (languageCode === 'es') {
      return kind === 'connectivity' ? t('media.audio_connectivity_es') : t('media.audio_inconsistent_es');
    }

    return kind === 'connectivity' ? t('media.audio_connectivity_en') : t('media.audio_inconsistent_en');
  }

  private resolveSafetyDetailLabel(ctx: Context, preferredLanguageCode?: string | null): string {
    const language = this.resolveSafetyLanguage(ctx, '', preferredLanguageCode);
    if (language === 'pt') {
      return t('media.safety_detail_pt');
    }
    if (language === 'es') {
      return t('media.safety_detail_es');
    }
    return t('media.safety_detail_en');
  }

  private resolveSafetyLanguage(
    ctx: Context,
    _transcript: string = '',
    preferredLanguageCode?: string | null,
  ): 'en' | 'es' | 'pt' {
    const supported = new Set(['en', 'es', 'pt']);
    const candidates = [preferredLanguageCode, (ctx.from as { language_code?: string } | undefined)?.language_code];
    for (const candidate of candidates) {
      const raw = String(candidate || '').trim();
      if (!raw) continue;
      try {
        const base = new Intl.Locale(raw).language;
        if (supported.has(base)) return base as 'en' | 'es' | 'pt';
      } catch {
        if (supported.has(raw)) return raw as 'en' | 'es' | 'pt';
      }
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
      const outputStage =
        this.echoOutputStage ||
        new EchoOutputStageService({
          audioHandler: this.audioHandler,
          preferenceStore: this.echoPreferenceStore || null,
        });
      const result = await outputStage.deliver({
        surface: 'telegram',
        text,
        rawInput: '',
        traceId,
        requestedBy: 'telegram-bot-safety',
        sessionId: ctx.chat?.id ? String(ctx.chat.id) : '',
        preferredLanguageCode: preferredLanguage === 'pt' ? 'en-US' : preferredLanguage,
        policyHint: 'safety',
        forceVoice: true,
        fallbackToText: false,
        sink: {
          sendText: async () => undefined,
          sendChatAction: async (action: 'record_voice' | 'typing') => {
            if (!ctx.chat?.id) {
              return;
            }
            await ctx.api.sendChatAction(ctx.chat.id, action);
          },
          sendVoice: async (audioPath: string) => {
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
      logger.warn(`[TelegramMedia] Security Echo failed for low-confidence audio: ${message}`);
      return false;
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || t('media.unknown_error'));
}
