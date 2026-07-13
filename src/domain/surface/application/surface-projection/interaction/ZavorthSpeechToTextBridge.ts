/**
 * Bridge from surface voice_reply → existing Zavorth STT stack.
 * Uses AudioTranscriptionService (same path as Telegram AudioHandler):
 * gemini → openai → groq → deepgram → whisper.cpp per config.tools.media.audio.sttProviderOrder
 * and the models already configured for those providers — no parallel voice system.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AudioTranscriptionService } from '../../../../../services/AudioTranscriptionService.js';
import type { SpeechToTextAdapter, SpeechToTextResult } from './VoiceReplyPipeline.js';

export type ZavorthSpeechToTextBridgeOptions = {
  transcriptionService?: Pick<AudioTranscriptionService, 'transcribe'>;
  /** Optional file-based path used by AudioHandler-style callers. */
  tempDir?: string;
};

function resolveMimeType(hint?: string | null): string {
  const raw = String(hint || '').trim().toLowerCase();
  if (raw.startsWith('audio/')) return raw;
  if (raw === 'ogg' || raw.endsWith('.ogg')) return 'audio/ogg';
  if (raw === 'mp3' || raw.endsWith('.mp3')) return 'audio/mpeg';
  if (raw === 'wav' || raw.endsWith('.wav')) return 'audio/wav';
  if (raw === 'webm' || raw.endsWith('.webm')) return 'audio/webm';
  if (raw === 'm4a' || raw.endsWith('.m4a')) return 'audio/mp4';
  return 'audio/ogg';
}

function extensionForMime(mime: string): string {
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'ogg';
}

/**
 * Create a SpeechToTextAdapter backed by Zavorth's AudioTranscriptionService.
 * Provider order + models come from existing config (user/environment choices).
 */
export function createZavorthSpeechToTextAdapter(
  options: ZavorthSpeechToTextBridgeOptions = {},
): SpeechToTextAdapter {
  const service = options.transcriptionService || new AudioTranscriptionService();

  return {
    async transcribe(input): Promise<SpeechToTextResult> {
      let audio: Buffer;
      let mimeType = resolveMimeType(input.mimeType);
      let fileName: string | null = null;

      if (typeof input.audio === 'string') {
        const p = path.resolve(input.audio);
        if (!fs.existsSync(p)) {
          throw new Error(`Audio file not found: ${p}`);
        }
        audio = fs.readFileSync(p);
        fileName = path.basename(p);
        if (!input.mimeType) {
          mimeType = resolveMimeType(path.extname(p));
        }
      } else if (Buffer.isBuffer(input.audio)) {
        audio = input.audio;
      } else if (input.audio instanceof Uint8Array) {
        audio = Buffer.from(input.audio);
      } else {
        throw new Error('Zavorth STT bridge requires audio Buffer, Uint8Array, or file path');
      }

      const result = await service.transcribe({
        audio,
        mimeType,
        fileName: fileName || `voice-reply.${extensionForMime(mimeType)}`,
        language: input.language || null,
        prompt:
          'Transcribe the spoken content accurately. If the speaker is giving an approval command (approve/reject/once/session/always/deny), preserve those words exactly.',
        sessionId: input.surface || null,
      });

      if (!result.ok || !String(result.text || '').trim()) {
        throw new Error(result.error || 'Zavorth AudioTranscriptionService returned empty transcript');
      }

      return {
        text: String(result.text).trim(),
        confidence: null,
        language: input.language || null,
        provider: result.provider || 'zavorth-audio-transcription',
        // model surfaces via provider evidence in attempts; keep provider field stable
      };
    },
  };
}

/** Singleton default adapter for processVoiceReply when stt is omitted. */
let defaultAdapter: SpeechToTextAdapter | null = null;

export function getDefaultZavorthSpeechToTextAdapter(): SpeechToTextAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createZavorthSpeechToTextAdapter();
  }
  return defaultAdapter;
}

/** Test helper */
export function setDefaultZavorthSpeechToTextAdapterForTests(
  adapter: SpeechToTextAdapter | null,
): void {
  defaultAdapter = adapter;
}

/**
 * Convenience: write buffer to temp file (for callers that only have AudioHandler.transcribeFile).
 */
export function writeTempAudioFile(
  audio: Buffer,
  mimeType?: string | null,
  tempDir?: string,
): string {
  const dir = tempDir || path.join(os.tmpdir(), 'zavorth-voice-reply');
  fs.mkdirSync(dir, { recursive: true });
  const ext = extensionForMime(resolveMimeType(mimeType));
  const filePath = path.join(dir, `vr-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`);
  fs.writeFileSync(filePath, audio);
  return filePath;
}
