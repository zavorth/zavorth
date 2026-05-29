import type {
  WebComposerAttachment,
  WebComposerMention,
  WebComposerMentionType,
  WebComposerSelectedSkill,
  WebComposerTrigger,
  WebComposerVoiceInput,
} from '../contracts/WebComposer.js';

export type NormalizedComposerPayload = {
  messageText: string;
  mentions: WebComposerMention[];
  attachments: WebComposerAttachment[];
  selectedSkills: WebComposerSelectedSkill[];
  voice: WebComposerVoiceInput | null;
};

const ALLOWED_MENTION_TYPES = new Set<WebComposerMentionType>([
  'command',
  'skill',
  'task',
  'permission',
  'artifact',
  'file',
  'action',
]);

const ALLOWED_TRIGGERS = new Set<WebComposerTrigger>(['/', '@', '#']);
const MAX_INLINE_MEDIA_CONTENT_CHARS = 28 * 1024 * 1024;

export class ComposerPayloadService {
  public normalize(input: {
    message?: unknown;
    mentions?: unknown;
    attachments?: unknown;
    selectedSkills?: unknown;
    skills?: unknown;
    voice?: unknown;
  }): NormalizedComposerPayload {
    const mentions = this.normalizeMentions(input.mentions);
    const attachments = this.normalizeAttachments(input.attachments);
    const selectedSkills = this.normalizeSelectedSkills(input.selectedSkills || input.skills);
    const voice = this.normalizeVoice(input.voice);
    const messageText = this.resolveMessageText(input.message, mentions);

    return {
      messageText,
      mentions,
      attachments,
      selectedSkills,
      voice,
    };
  }

  private resolveMessageText(
    rawMessage: unknown,
    mentions: WebComposerMention[],
  ): string {
    const normalizedMessage = String(rawMessage || '').trim();
    if (normalizedMessage) {
      return normalizedMessage;
    }

    return mentions
      .map((item) => item.label)
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private normalizeMentions(rawMentions: unknown): WebComposerMention[] {
    if (!Array.isArray(rawMentions)) {
      return [];
    }

    return rawMentions
      .map((item) => this.normalizeSingleMention(item))
      .filter((item): item is WebComposerMention => item !== null);
  }

  private normalizeSingleMention(rawMention: unknown): WebComposerMention | null {
    if (!rawMention || typeof rawMention !== 'object' || Array.isArray(rawMention)) {
      return null;
    }

    const mention = rawMention as Record<string, unknown>;
    const type = String(mention.type || '').trim().toLowerCase() as WebComposerMentionType;
    const label = String(mention.label || '').trim();
    const id =
      String(mention.id || '').trim() ||
      (type && label ? `${type}:${label.toLowerCase()}` : '');

    if (!ALLOWED_MENTION_TYPES.has(type) || !label || !id) {
      return null;
    }

    const description = String(mention.description || '').trim() || null;
    const triggerCandidate = String(mention.trigger || '').trim() as WebComposerTrigger;
    const trigger = ALLOWED_TRIGGERS.has(triggerCandidate) ? triggerCandidate : null;
    const aliases = Array.isArray(mention.aliases)
      ? mention.aliases
          .map((alias) => String(alias || '').trim())
          .filter(Boolean)
      : [];
    const payload =
      mention.payload && typeof mention.payload === 'object' && !Array.isArray(mention.payload)
        ? (mention.payload as Record<string, any>)
        : undefined;

    return {
      id,
      type,
      label,
      description,
      trigger,
      aliases,
      payload,
    };
  }

  private normalizeAttachments(rawAttachments: unknown): WebComposerAttachment[] {
    if (!Array.isArray(rawAttachments)) {
      return [];
    }

    return rawAttachments
      .map((item, index) => this.normalizeSingleAttachment(item, index))
      .filter((item): item is WebComposerAttachment => item !== null)
      .slice(0, 5);
  }

  private normalizeSingleAttachment(rawAttachment: unknown, index: number): WebComposerAttachment | null {
    if (!rawAttachment || typeof rawAttachment !== 'object' || Array.isArray(rawAttachment)) {
      return null;
    }

    const attachment = rawAttachment as Record<string, unknown>;
    const name = String(attachment.name || '').trim();
    if (!name) {
      return null;
    }
    const type = String(attachment.type || 'application/octet-stream').trim() || 'application/octet-stream';
    const size = Math.max(0, Number(attachment.size || 0) || 0);
    const id = String(attachment.id || '').trim() || `attachment:${index + 1}:${name}`;
    const text = String(attachment.text || '').trim();
    const content = this.normalizeAttachmentContent(attachment.content, type);
    const source = String(attachment.source || '').trim() || 'dashboard';
    const media = this.normalizeAttachmentMedia(attachment.media, type);
    const extraction = attachment.extraction && typeof attachment.extraction === 'object' && !Array.isArray(attachment.extraction)
      ? attachment.extraction as Record<string, unknown>
      : null;

    return {
      id,
      name,
      type,
      size,
      text: text || null,
      content,
      truncated: Boolean(attachment.truncated),
      source,
      media,
      extraction: extraction
        ? {
            kind: String(extraction.kind || '').trim() || null,
            label: String(extraction.label || '').trim() || null,
            detail: String(extraction.detail || '').trim() || null,
          }
        : null,
    };
  }

  private normalizeAttachmentContent(rawContent: unknown, type: string): string | null {
    const content = String(rawContent || '').trim();
    if (!content) {
      return null;
    }
    if (!/^(image|audio)\//i.test(type)) {
      return null;
    }
    if (content.length > MAX_INLINE_MEDIA_CONTENT_CHARS) {
      return null;
    }
    if (!/^[A-Za-z0-9+/=_-]+$/.test(content)) {
      return null;
    }
    return content;
  }

  private normalizeAttachmentMedia(rawMedia: unknown, fallbackType: string): WebComposerAttachment['media'] {
    if (!rawMedia || typeof rawMedia !== 'object' || Array.isArray(rawMedia)) {
      if (/^image\//i.test(fallbackType)) {
        return { kind: 'image', mimeType: fallbackType, encoding: 'base64' };
      }
      if (/^audio\//i.test(fallbackType)) {
        return { kind: 'audio', mimeType: fallbackType, encoding: 'base64' };
      }
      if (/^video\//i.test(fallbackType)) {
        return { kind: 'video', mimeType: fallbackType, encoding: 'base64' };
      }
      return null;
    }
    const media = rawMedia as Record<string, unknown>;
    const kind = String(media.kind || '').trim().toLowerCase();
    if (kind !== 'image' && kind !== 'audio' && kind !== 'video') {
      return null;
    }
    const mimeType = String(media.mimeType || fallbackType || '').trim() || null;
    const encoding = String(media.encoding || '').trim().toLowerCase() || 'base64';
    return {
      kind,
      mimeType,
      encoding: encoding === 'base64' ? 'base64' : encoding,
    };
  }

  private normalizeSelectedSkills(rawSkills: unknown): WebComposerSelectedSkill[] {
    if (!Array.isArray(rawSkills)) {
      return [];
    }

    const seen = new Set<string>();
    return rawSkills
      .map((item) => this.normalizeSingleSkill(item))
      .filter((item): item is WebComposerSelectedSkill => {
        if (!item || seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      })
      .slice(0, 8);
  }

  private normalizeSingleSkill(rawSkill: unknown): WebComposerSelectedSkill | null {
    if (!rawSkill || typeof rawSkill !== 'object' || Array.isArray(rawSkill)) {
      return null;
    }
    const skill = rawSkill as Record<string, unknown>;
    const id = String(skill.id || skill.name || skill.title || '').trim();
    if (!id) {
      return null;
    }
    const title = String(skill.title || skill.name || id).trim();
    const prompt = String(skill.prompt || '').trim() || null;
    const status = String(skill.status || '').trim() || null;
    const payload =
      skill.payload && typeof skill.payload === 'object' && !Array.isArray(skill.payload)
        ? (skill.payload as Record<string, any>)
        : undefined;

    return {
      id,
      title,
      prompt,
      status,
      payload,
    };
  }

  private normalizeVoice(rawVoice: unknown): WebComposerVoiceInput | null {
    if (!rawVoice || typeof rawVoice !== 'object' || Array.isArray(rawVoice)) {
      return null;
    }
    const voice = rawVoice as Record<string, unknown>;
    const transcript = String(voice.transcript || '').trim();
    if (!transcript) {
      return null;
    }
    const confidence = Number(voice.confidence);
    return {
      transcript,
      language: String(voice.language || '').trim() || null,
      source: String(voice.source || '').trim() || 'speech-recognition',
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    };
  }
}
