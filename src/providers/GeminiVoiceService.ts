import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config/index.js';
import { readSafeJsonResponse } from '../security/SafeFetchService.js';

export type GeminiVoiceSynthesisOptions = {
  model?: string;
  voiceName?: string;
  languageCode?: string;
};

export type GeminiVoiceSynthesisResult = {
  filePath: string;
  model: string;
  voiceName: string;
  languageCode: string;
  mimeType: string;
  sourceMimeType: string | null;
  latencyMs: number;
  inputChars: number;
  outputBytes: number;
};

export type GeminiVoiceServiceOptions = {
  apiKey?: string;
  apiBaseUrl?: string;
  apiVersion?: string;
  model?: string;
  voiceName?: string;
  languageCode?: string;
  customHeaders?: Record<string, string>;
  tmpDir?: string;
  fetchImpl?: typeof fetch;
};

/**
 * Provider-specific Gemini TTS adapter.
 * Uses the official `generateContent` TTS shape with AUDIO modality and saves
 * the returned PCM payload as a local WAV file.
 */
export class GeminiVoiceService {
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly apiVersion: string;
  private readonly model: string;
  private readonly voiceName: string;
  private readonly languageCode: string;
  private readonly customHeaders: Record<string, string>;
  private readonly tmpDir: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options?: GeminiVoiceServiceOptions) {
    this.apiKey = String(options?.apiKey || config.geminiVoiceApiKey || config.geminiApiKey || '').trim();
    this.apiBaseUrl = String(options?.apiBaseUrl || config.geminiApiBaseUrl || 'https://generativelanguage.googleapis.com').trim().replace(/\/+$/, '');
    this.apiVersion = String(options?.apiVersion || config.geminiApiVersion || 'v1beta').trim();
    this.model = String(options?.model || config.geminiVoiceModel || 'gemini-2.5-flash').trim();
    this.voiceName = String(options?.voiceName || config.geminiVoiceName || 'Kore').trim();
    this.languageCode = String(options?.languageCode || config.geminiVoiceLanguageCode || 'en-US').trim();
    this.customHeaders = { ...(options?.customHeaders || config.geminiCustomHeaders || {}) };
    this.tmpDir = String(options?.tmpDir || config.tmpDir || path.resolve(process.cwd(), 'tmp')).trim();
    this.fetchImpl = options?.fetchImpl || fetch;
  }

  public isConfigured(): boolean {
    return this.apiKey.length > 0 && this.model.length > 0;
  }

  public async synthesize(text: string, options?: GeminiVoiceSynthesisOptions): Promise<string | null> {
    const result = await this.synthesizeDetailed(text, options);
    return result?.filePath || null;
  }

  public async synthesizeDetailed(
    text: string,
    options?: GeminiVoiceSynthesisOptions,
  ): Promise<GeminiVoiceSynthesisResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const cleanText = String(text || '').trim();
    if (!cleanText) {
      return null;
    }

    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }

    const startedAt = Date.now();
    const model = String(options?.model || this.model).trim();
    const voiceName = String(options?.voiceName || this.voiceName).trim();
    const languageCode = String(options?.languageCode || this.languageCode).trim();
    const endpoint = `${this.apiBaseUrl}/${this.apiVersion}/models/${encodeURIComponent(model)}:generateContent`;

    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.customHeaders,
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: cleanText }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
            languageCode,
          },
        },
        model,
      }),
    });

    const body = await readSafeJsonResponse<any>(response as any, 'Gemini Voice Service').catch(() => null);
    if (!response.ok) {
      const message =
        body?.error?.message
        || body?.message
        || `Gemini TTS failed with status ${response.status}`;
      throw new Error(message);
    }

    const inlineData = readInlineAudio(body);
    if (!inlineData?.data) {
      return null;
    }

    const pcmBuffer = Buffer.from(inlineData.data, 'base64');
    if (pcmBuffer.length === 0) {
      return null;
    }

    const outputFile = path.join(this.tmpDir, `gemini_tts_${Date.now()}.wav`);
    const wavBuffer = buildWavFile(pcmBuffer, {
      channels: 1,
      sampleRate: 24000,
      bitsPerSample: 16,
    });
    fs.writeFileSync(outputFile, wavBuffer);
    return {
      filePath: outputFile,
      model,
      voiceName,
      languageCode,
      mimeType: 'audio/wav',
      sourceMimeType: inlineData.mimeType ? String(inlineData.mimeType) : null,
      latencyMs: Date.now() - startedAt,
      inputChars: cleanText.length,
      outputBytes: wavBuffer.length,
    };
  }

  public cleanup(filePath: string): void {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }
}

function readInlineAudio(body: any): { data?: string; mimeType?: string } | null {
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const inlineData = part?.inlineData || part?.inline_data;
      if (inlineData?.data) {
        return {
          data: String(inlineData.data),
          mimeType: typeof inlineData.mimeType === 'string' ? inlineData.mimeType : undefined,
        };
      }
    }
  }
  return null;
}

function buildWavFile(
  pcmData: Buffer,
  options: { channels: number; sampleRate: number; bitsPerSample: number },
): Buffer {
  const { channels, sampleRate, bitsPerSample } = options;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}
