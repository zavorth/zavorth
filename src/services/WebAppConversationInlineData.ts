import type { WebComposerAttachment } from '../contracts/WebComposer.js';

type InlineMedia = {
  kind: 'image' | 'audio' | 'video';
  mimeType: string;
  content: string;
};

type InlineData = {
  mimeType: string;
  data: string;
};

type RuntimeRecord = Record<string, unknown>;

export function getReadyMediaAttachments(attachments: WebComposerAttachment[]): WebComposerAttachment[] {
  return (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => Boolean(resolveReadyMediaAttachment(attachment)))
    .slice(0, 5);
}

export function buildInlineDataFromAttachments(attachments: WebComposerAttachment[]): InlineData[] {
  return attachments
    .map((attachment) => resolveReadyMediaAttachment(attachment))
    .filter((entry): entry is InlineMedia => entry !== null)
    .map((entry) => ({
      mimeType: entry.mimeType,
      data: entry.content,
    }));
}

export function extractInlineDataFromComposerPayload(
  composerPayload?: RuntimeRecord | null,
): InlineData[] {
  if (!composerPayload || typeof composerPayload !== 'object') {
    return [];
  }
  const explicitInlineData = composerPayload.inlineData;
  if (Array.isArray(explicitInlineData)) {
    return explicitInlineData
      .map(normalizeInlineDataEntry)
      .filter((entry): entry is InlineData => entry !== null)
      .slice(0, 5);
  }
  return Array.isArray(composerPayload.attachments)
    ? buildInlineDataFromAttachments(composerPayload.attachments as WebComposerAttachment[])
    : [];
}

export function resolveReadyMediaAttachment(attachment: WebComposerAttachment | null | undefined): InlineMedia | null {
  if (!attachment) {
    return null;
  }
  const content = String(attachment.content || '').trim();
  if (!content) {
    return null;
  }
  const mediaKind = String(attachment.media?.kind || '').trim().toLowerCase();
  const mimeType = String(attachment.media?.mimeType || attachment.type || '').trim();
  const kind = mediaKind === 'image' || /^image\//i.test(mimeType)
    ? 'image'
    : mediaKind === 'audio' || /^audio\//i.test(mimeType)
      ? 'audio'
      : mediaKind === 'video' || /^video\//i.test(mimeType)
        ? 'video'
        : null;
  return kind && mimeType ? { kind, mimeType, content } : null;
}

function normalizeInlineDataEntry(entry: unknown): InlineData | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const record = entry as RuntimeRecord;
  const mimeType = String(record.mimeType || '').trim();
  const data = String(record.data || '').trim();
  return mimeType && data ? { mimeType, data } : null;
}
