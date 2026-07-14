/**
 * Shared voice-note ingest for messaging channels (Discord/WhatsApp/Slack/etc.).
 * Preference-controlled STT; fail closed; safeFetch only.
 * WhatsApp media id + Slack private URLs resolved with bot tokens (never logged).
 */

import type { MessageAttachment } from '../../contracts/IMessageBroker.js';
import { AudioTranscriptionService } from '../AudioTranscriptionService.js';
import { getVoiceDictationIngress } from './VoiceDictationIngress.js';
import { getVoicePreferenceService } from './VoicePreferenceService.js';
import { recordVoiceMetric } from './VoiceMetricsService.js';
import { safeFetch } from '../../security/SafeFetchService.js';
import { config } from '../../config/index.js';

const AUDIO_MIME = /^(audio\/|video\/webm|application\/ogg)/i;
const AUDIO_EXT = /\.(ogg|oga|mp3|wav|m4a|webm|opus|flac|aac|amr|3gp)$/i;
const MAX_DOWNLOAD_BYTES = 24 * 1024 * 1024;

export function isMessagingAudioAttachment(attachment: {
  contentType?: string | null;
  name?: string | null;
  url?: string | null;
}): boolean {
  const type = String(attachment.contentType || '').trim();
  const name = String(attachment.name || '').trim();
  if (type && AUDIO_MIME.test(type)) return true;
  if (name && AUDIO_EXT.test(name)) return true;
  return false;
}

export type MessagingVoiceIngestResult = {
  ok: boolean;
  transcript: string | null;
  agentText: string | null;
  provider: string | null;
  message: string | null;
};

function isAllowedMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export type ExtractedAudioMedia = {
  url?: string;
  /** WhatsApp Cloud API media id (resolved via Graph) */
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  /** slack | whatsapp | generic — selects auth headers */
  source?: 'slack' | 'whatsapp' | 'generic';
};

/**
 * Extract first audio media URL or media id from common channel payload shapes.
 */
export function extractAudioMediaFromPayload(
  payload: Record<string, unknown>,
): ExtractedAudioMedia | null {
  if (!payload || typeof payload !== 'object') return null;

  // Generic
  for (const key of ['audio_url', 'media_url', 'voice_url', 'file_url']) {
    const v = payload[key];
    if (typeof v === 'string' && isAllowedMediaUrl(v)) {
      return { url: v, mimeType: 'audio/ogg', source: 'generic' };
    }
  }

  // Nested audio object { url } or { link } or { id }
  const audio = payload.audio;
  if (audio && typeof audio === 'object') {
    const a = audio as Record<string, unknown>;
    const url = String(a.url || a.link || a.href || '').trim();
    const mediaId = String(a.id || a.media_id || '').trim();
    if (url && isAllowedMediaUrl(url)) {
      return {
        url,
        mimeType: String(a.mime_type || a.content_type || a.mimeType || 'audio/ogg'),
        fileName: String(a.filename || a.name || 'voice.ogg'),
        source: 'generic',
      };
    }
    if (mediaId) {
      return {
        mediaId,
        mimeType: String(a.mime_type || a.content_type || a.mimeType || 'audio/ogg'),
        fileName: 'whatsapp-voice.ogg',
        source: 'whatsapp',
      };
    }
  }

  // Slack files[]
  const files = payload.files;
  if (Array.isArray(files)) {
    for (const f of files) {
      if (!f || typeof f !== 'object') continue;
      const rec = f as Record<string, unknown>;
      const mimetype = String(rec.mimetype || rec.mime_type || '');
      const name = String(rec.name || rec.title || '');
      const url = String(
        rec.url_private_download || rec.url_private || rec.permalink_public || rec.url || '',
      ).trim();
      if (url && isAllowedMediaUrl(url) && (AUDIO_MIME.test(mimetype) || AUDIO_EXT.test(name))) {
        return {
          url,
          mimeType: mimetype || 'audio/webm',
          fileName: name || 'slack-audio',
          source: 'slack',
        };
      }
    }
  }

  // WhatsApp Cloud API style: messages[0].audio / voice with id or link
  if (Array.isArray(payload.messages)) {
    for (const m of payload.messages) {
      if (!m || typeof m !== 'object') continue;
      const msg = m as Record<string, unknown>;
      const type = String(msg.type || '');
      if (type === 'audio' || type === 'voice' || type === 'ptt') {
        const media = (msg.audio || msg.voice || msg.ptt) as Record<string, unknown> | undefined;
        const link = String(media?.link || media?.url || '').trim();
        const mediaId = String(media?.id || '').trim();
        if (link && isAllowedMediaUrl(link)) {
          return {
            url: link,
            mimeType: String(media?.mime_type || 'audio/ogg'),
            fileName: 'whatsapp-voice.ogg',
            source: 'whatsapp',
          };
        }
        if (mediaId) {
          return {
            mediaId,
            mimeType: String(media?.mime_type || 'audio/ogg'),
            fileName: 'whatsapp-voice.ogg',
            source: 'whatsapp',
          };
        }
      }
    }
  }

  // Teams / Bot Framework: attachments[].contentUrl
  const attachments = payload.attachments;
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (!att || typeof att !== 'object') continue;
      const a = att as Record<string, unknown>;
      const contentType = String(a.contentType || a.content_type || a.mimeType || '');
      const name = String(a.name || a.filename || '');
      const url = String(a.contentUrl || a.content_url || a.url || a.downloadUrl || '').trim();
      if (url && isAllowedMediaUrl(url) && (AUDIO_MIME.test(contentType) || AUDIO_EXT.test(name) || /audio|voice|ptt/i.test(contentType))) {
        return {
          url,
          mimeType: contentType || 'audio/ogg',
          fileName: name || 'teams-audio',
          source: 'generic',
        };
      }
    }
  }

  // Signal-ish: dataMessage.attachments / envelope with contentType audio
  const dataMessage = payload.dataMessage || payload.message;
  if (dataMessage && typeof dataMessage === 'object') {
    const dm = dataMessage as Record<string, unknown>;
    const atts = dm.attachments;
    if (Array.isArray(atts)) {
      for (const att of atts) {
        if (!att || typeof att !== 'object') continue;
        const a = att as Record<string, unknown>;
        const contentType = String(a.contentType || a.content_type || '');
        const url = String(a.url || a.downloadPath || a.id || '').trim();
        if (url && isAllowedMediaUrl(url) && AUDIO_MIME.test(contentType)) {
          return { url, mimeType: contentType, fileName: 'signal-audio', source: 'generic' };
        }
      }
    }
  }

  // Recursive shallow walk for common media keys (depth-limited)
  const found = walkForAudio(payload, 0, 3);
  if (found) return found;

  return null;
}

function walkForAudio(
  node: unknown,
  depth: number,
  maxDepth: number,
): ExtractedAudioMedia | null {
  if (depth > maxDepth || !node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walkForAudio(item, depth + 1, maxDepth);
      if (hit) return hit;
    }
    return null;
  }
  const rec = node as Record<string, unknown>;
  const url = String(rec.contentUrl || rec.media_url || rec.audio_url || rec.url || rec.link || '').trim();
  const mime = String(rec.mime_type || rec.contentType || rec.mimetype || '');
  const name = String(rec.filename || rec.name || '');
  if (url && isAllowedMediaUrl(url) && (AUDIO_MIME.test(mime) || AUDIO_EXT.test(name) || /audio|voice|ogg|opus/i.test(url))) {
    return { url, mimeType: mime || 'audio/ogg', fileName: name || 'voice', source: 'generic' };
  }
  for (const v of Object.values(rec)) {
    const hit = walkForAudio(v, depth + 1, maxDepth);
    if (hit) return hit;
  }
  return null;
}

/**
 * Resolve WhatsApp media id → temporary download URL via Graph API.
 */
export async function resolveWhatsAppMediaDownload(input: {
  mediaId: string;
  accessToken?: string;
  apiVersion?: string;
}): Promise<{ url: string; mimeType?: string }> {
  const mediaId = String(input.mediaId || '').trim();
  const token = String(
    input.accessToken || config.whatsappAccessToken || config.whatsappBotToken || '',
  ).trim();
  const apiVersion = String(input.apiVersion || config.whatsappCloudApiVersion || 'v20.0').trim() || 'v20.0';
  if (!mediaId || !token) {
    throw new Error(
      'WhatsApp media id requires WHATSAPP_ACCESS_TOKEN (and media id). Type your message instead.',
    );
  }
  // Step 1: metadata (url field)
  const metaRes = await safeFetch(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(mediaId)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    },
    { serviceName: 'WhatsApp Graph media metadata' },
  );
  if (!metaRes.ok) {
    throw new Error(`WhatsApp media metadata HTTP ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as Record<string, unknown>;
  const url = String(meta.url || '').trim();
  if (!url || !isAllowedMediaUrl(url)) {
    throw new Error('WhatsApp media metadata missing download url.');
  }
  return {
    url,
    mimeType: String(meta.mime_type || meta.mimeType || 'audio/ogg'),
  };
}

function authHeadersForSource(source?: string): Record<string, string> {
  if (source === 'slack') {
    const token = String(config.slackBotToken || '').trim();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  if (source === 'whatsapp') {
    const token = String(config.whatsappAccessToken || config.whatsappBotToken || '').trim();
    if (token) return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Download + STT + dictation prepare for messaging surfaces.
 */
export async function ingestMessagingVoiceFromUrl(input: {
  url?: string;
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  surface: string;
  userId?: string;
  source?: 'slack' | 'whatsapp' | 'generic';
  /** Optional auth headers (e.g. Slack Bearer) — never logged */
  headers?: Record<string, string>;
  stt?: AudioTranscriptionService;
}): Promise<MessagingVoiceIngestResult> {
  let url = String(input.url || '').trim();
  let mimeType = input.mimeType;
  const source = input.source || 'generic';

  try {
    if (!url && input.mediaId && source === 'whatsapp') {
      const resolved = await resolveWhatsAppMediaDownload({ mediaId: input.mediaId });
      url = resolved.url;
      mimeType = mimeType || resolved.mimeType;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      transcript: null,
      agentText: null,
      provider: null,
      message: `${message}. Type your message instead.`,
    };
  }

  if (!url || !isAllowedMediaUrl(url)) {
    return {
      ok: false,
      transcript: null,
      agentText: null,
      provider: null,
      message: 'Invalid media URL. Type your message instead.',
    };
  }

  const prefs = getVoicePreferenceService();
  const resolved = prefs.resolveStt();
  if (!resolved.ok) {
    recordVoiceMetric({
      kind: 'stt',
      ok: false,
      code: resolved.code,
      message: resolved.message,
      surface: input.surface,
      source: 'messaging_voice',
    });
    return {
      ok: false,
      transcript: null,
      agentText: null,
      provider: null,
      message: `${resolved.message} Type your message instead.`,
    };
  }

  try {
    const headers = {
      ...authHeadersForSource(source),
      ...(input.headers || {}),
    };
    const response = await safeFetch(
      url,
      {
        method: 'GET',
        headers,
      },
      { serviceName: `${input.surface} voice attachment download` },
    );
    if (!response.ok) {
      throw new Error(`Audio download HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
      throw new Error('Audio attachment exceeds size limit.');
    }
    const buffer = Buffer.from(arrayBuffer);
    const stt = input.stt || new AudioTranscriptionService();
    const result = await stt.transcribe({
      audio: buffer,
      mimeType: mimeType || input.mimeType || 'audio/ogg',
      fileName: input.fileName || 'voice.ogg',
      language: resolved.language === 'auto' ? null : resolved.language,
      sessionId: `${input.surface}:${input.userId || 'user'}`,
    });

    if (!result.ok || !result.text) {
      return {
        ok: false,
        transcript: null,
        agentText: null,
        provider: result.provider,
        message: `${result.error || 'STT failed'}. Type your message instead.`,
      };
    }

    const prepared = getVoiceDictationIngress().prepare({
      transcript: result.text,
      provider: result.provider,
      model: result.model,
      languageCode: resolved.language,
      preference: prefs.get(),
      surface: input.surface,
    });

    if (!prepared.ok) {
      return {
        ok: false,
        transcript: result.text,
        agentText: null,
        provider: result.provider,
        message: prepared.message,
      };
    }

    return {
      ok: true,
      transcript: result.text,
      agentText: prepared.agentText,
      provider: result.provider,
      message: null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    recordVoiceMetric({
      kind: 'stt',
      ok: false,
      message,
      surface: input.surface,
      source: 'messaging_voice',
    });
    return {
      ok: false,
      transcript: null,
      agentText: null,
      provider: null,
      message: `${message}. Type your message instead.`,
    };
  }
}

export async function ingestMessagingVoiceAttachments(input: {
  attachments: MessageAttachment[];
  surface: string;
  userId?: string;
  headers?: Record<string, string>;
  stt?: AudioTranscriptionService;
}): Promise<MessagingVoiceIngestResult> {
  const audio = (input.attachments || []).find(isMessagingAudioAttachment);
  if (!audio?.url) {
    return {
      ok: false,
      transcript: null,
      agentText: null,
      provider: null,
      message: null,
    };
  }
  return ingestMessagingVoiceFromUrl({
    url: audio.url,
    mimeType: audio.contentType || undefined,
    fileName: audio.name || undefined,
    surface: input.surface,
    userId: input.userId,
    headers: input.headers,
    stt: input.stt,
  });
}

export function mergeMessagingVoiceText(
  content: string,
  voice: MessagingVoiceIngestResult,
): string {
  const base = String(content || '').trim();
  if (voice.ok && voice.agentText) {
    return base ? `${base}\n\n${voice.agentText}` : voice.agentText;
  }
  if (voice.message && !base) {
    return voice.message;
  }
  return base;
}
