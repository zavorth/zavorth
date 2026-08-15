import type { WebComposerAttachment } from '../contracts/WebComposer.js';
import type { MediaAnalysisType } from '../contracts/MediaUnderstandingContract.js';
import { getReadyMediaAttachments, resolveReadyMediaAttachment } from './WebAppConversationInlineData.js';
import type { AttachmentIntelligenceService, AttachmentTextProfile } from './AttachmentIntelligenceService.js';
import type { AudioTranscriptionService } from './AudioTranscriptionService.js';
import type { MediaUnderstandingService } from './MediaUnderstandingService.js';
import type { WebRealtimeService } from './WebRealtimeService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type WebAppConversationMediaDeps = {
  audioTranscription: AudioTranscriptionService;
  mediaUnderstanding: MediaUnderstandingService;
  attachmentIntelligence: AttachmentIntelligenceService;
  realtime: Pick<WebRealtimeService, 'recordAssistantMessage'>;
};

export class WebAppConversationMediaSupport {
  public constructor(private readonly deps: WebAppConversationMediaDeps) {}

  public async analyzeInlineMediaAttachment(
    sessionId: string,
    attachment: WebComposerAttachment,
    message: string,
  ): Promise<{
    ok: boolean;
    name: string;
    type: string;
    summary: string;
    text: string | null;
    error: string | null;
    attempts?: Array<{ provider: string; model: string | null; status: string; reason: string | null; latencyMs: number }>;
  }> {
    const media = resolveReadyMediaAttachment(attachment);
    if (!media) {
      return {
        ok: false,
        name: attachment.name,
        type: attachment.type,
        summary: 'Media payload was not available.',
        text: null,
        error: 'missing-media-payload',
      };
    }

    if (media.kind === 'audio') {
      const audioResult = await this.deps.audioTranscription.transcribe({
        audio: Buffer.from(media.content, 'base64'),
        mimeType: media.mimeType,
        fileName: attachment.name,
        prompt: message,
        sessionId,
        language: null,
      });
      return {
        ok: audioResult.ok,
        name: attachment.name,
        type: media.mimeType,
        summary: audioResult.ok ? `Audio transcribed with ${audioResult.provider || 'configured'} speech provider.` : 'Audio transcription failed.',
        text: audioResult.text,
        error: audioResult.error,
        attempts: audioResult.attempts,
      };
    }

    try {
      const result = await this.deps.mediaUnderstanding.analyze({
        source: {
          kind: 'buffer',
          data: Buffer.from(media.content, 'base64'),
          contentType: media.mimeType,
          fileName: attachment.name,
        },
        modality: media.kind,
        analysisType: this.resolveMediaAnalysisType(message),
        prompt: message,
        sessionId,
        providerHints: {
          surface: 'zavorth-control',
          fileName: attachment.name,
          responseLanguage: null,
        },
      });
      const analysisText = result.analysis?.answer || result.analysis?.extractedText || result.analysis?.description || result.summary;
      return {
        ok: result.ok,
        name: attachment.name,
        type: media.mimeType,
        summary: result.summary,
        text: String(analysisText || '').trim() || null,
        error: result.error?.message || null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Web App Conversation] string operation failed', error);
      return {
        ok: false,
        name: attachment.name,
        type: media.mimeType,
        summary: 'Media analysis could not run.',
        text: null,
        error: error instanceof Error ? err.message : String(error),
      };
    }
  }

  public renderMediaUnderstandingReply(message: string, attachments: WebComposerAttachment[], results: Array<{ ok: boolean; name: string; type: string; summary: string; text: string | null; error: string | null }>): string {
    const successful = results.filter((result) => result.ok && result.text);
    if (successful.length > 0) {
      return [successful.length === 1 ? `I analyzed ${successful[0].name}.` : `I analyzed ${successful.length} media files.`, '', ...successful.map((result) => [`**${result.name}**`, result.text].join('\n'))].join('\n\n');
    }

    const reasons = results
      .map((result) => result.error || result.summary)
      .filter(Boolean)
      .slice(0, 3);
    return [
      attachments.length === 1 ? `I received ${attachments[0].name} as a real media payload.` : `I received ${attachments.length} media files as real payloads.`,
      '',
      'Media understanding is wired in the backend, but no configured multimodal provider completed this analysis yet.',
      reasons.length ? `Reason: ${reasons.join(' | ')}` : null,
      '',
      `Your request: ${message}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  public buildMediaAttachmentPrompt(message: string, attachments: WebComposerAttachment[]): string {
    return [
      'The user attached media through Zavorth Control.',
      'Analyze the inline image/audio payloads directly. For images, describe visible content and extract readable text when useful. For audio, transcribe or summarize the spoken content.',
      'Answer naturally and do not mention internal payload IDs, gateway internals, or implementation details.',
      '',
      `User request: ${message}`,
      '',
      'Attached media:',
      ...attachments.map((attachment) => `- ${attachment.name} (${attachment.type || 'application/octet-stream'}, ${attachment.size || 0} bytes)`),
    ].join('\n');
  }

  public resolveMediaAnalysisType(_message: string): MediaAnalysisType {
    return 'describe';
  }

  public getReadyMediaAttachments(attachments: WebComposerAttachment[]): WebComposerAttachment[] {
    return getReadyMediaAttachments(attachments);
  }

  public isExplicitAttachmentDeliverableRequest(_message: string): boolean {
    return false;
  }

  public buildAttachmentConversationPrompt(message: string, attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>): string {
    const profiles = this.profileTextAttachments(attachments);
    const context = profiles.map((profile, index) => this.deps.attachmentIntelligence.renderPromptSection(profile, index)).join('\n\n---\n\n');

    return [
      'The user sent text attachments through ZavorthControl.',
      "You are Zavorth's file analyst. Reply with product quality: identify format, structural signals, risks, and honest limits.",
      'Answer the request using the attachment content and automatic profile in natural language.',
      'If the file looks like a token, key, hash, Base64, Base64URL, or URL-encoded payload, say that clearly and cite observable signals.',
      'Do not mention internal ids, runs, pipeline, payload, gateway, or prepared execution.',
      'Do not create an artifact, report, or run for simple questions about attachments.',
      'Do not repeat or decode full raw content when it appears sensitive; explain its structure.',
      'Avoid a generic one-line answer. Provide a short, useful, specific analysis.',
      '',
      `User request: ${message}`,
      '',
      context,
    ].join('\n');
  }

  public buildLocalAttachmentConversationReply(message: string, attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>): string {
    return this.deps.attachmentIntelligence.renderLocalReply({
      message,
      profiles: this.profileTextAttachments(attachments),
    });
  }

  public describeAttachmentText(text: string): string {
    const profile = this.deps.attachmentIntelligence.profileTextAttachment({ text });
    return this.deps.attachmentIntelligence.renderLocalReply({
      profiles: [profile],
    });
  }

  public profileTextAttachments(attachments: Array<{ name: string; type: string; size: number; text?: string | null; truncated?: boolean }>): AttachmentTextProfile[] {
    return attachments.slice(0, 5).map((attachment) =>
      this.deps.attachmentIntelligence.profileTextAttachment({
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        text: attachment.text,
        truncated: attachment.truncated,
      }),
    );
  }

  public maybeHandleUnsupportedAttachmentPayload(
    sessionId: string,
    payload: {
      attachments?: WebComposerAttachment[];
    },
  ): boolean {
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    if (attachments.length === 0) {
      return false;
    }

    const unsupported = attachments.filter((attachment) => !String(attachment.text || '').trim() && !resolveReadyMediaAttachment(attachment));
    if (unsupported.length === 0) {
      return false;
    }

    const lines = [
      unsupported.length === attachments.length ? 'I received the attachment, but it arrived as metadata only.' : 'I received the attachments. Some arrived as metadata only and will not be analyzed now.',
      '',
      ...unsupported.slice(0, 5).map((attachment) => `- ${attachment.name} (${attachment.type || 'unknown type'}, ${attachment.size || 0} bytes)`),
      '',
      'To analyze it directly, send a readable text/document file, image/audio under the media limit, or point Zavorth to a local file it can access.',
    ];
    this.deps.realtime.recordAssistantMessage(sessionId, lines.join('\n'), null, unsupported.length === attachments.length ? 'attachment-unsupported' : 'attachment-warning');

    return unsupported.length === attachments.length;
  }
}
