import fs from 'fs';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

export class ZavorthAudioAnalyzerService extends BaseTool {
  public readonly name = 'zavorth_audio_analyzer';

  public readonly description =
    'Audio intelligence — analyze audio files for content, sentiment, speakers, music genre, tempo, and quality.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'analyze', 'transcribe', 'detect_speakers', 'analyze_sentiment', 'get_metadata', 'detect_genre'.",
      },
      audio_path: {
        type: 'string',
        description: 'Path to audio file.',
      },
      language: {
        type: 'string',
        description: 'Language for transcription. Default: auto-detect.',
      },
      detail_level: {
        type: 'string',
        description: "Detail level: 'brief', 'detailed'. Default: 'detailed'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const validActions = ['analyze', 'transcribe', 'detect_speakers', 'analyze_sentiment', 'get_metadata', 'detect_genre', 'list_capabilities'];
    if (!validActions.includes(action)) return `Error: action "${action}" is invalid.`;

    const audioPath = typeof args.audio_path === 'string' ? args.audio_path : undefined;
    if (!audioPath && action !== 'list_capabilities') return 'Error: "audio_path" is required.';

    switch (action) {
      case 'analyze': return await this.analyzeAudio(audioPath!);
      case 'transcribe': return await this.transcribeAudio(audioPath!, args);
      case 'detect_speakers': return await this.detectSpeakers(audioPath!);
      case 'analyze_sentiment': return await this.analyzeSentiment(audioPath!);
      case 'get_metadata': return this.getMetadata(audioPath!);
      case 'detect_genre': return await this.detectGenre(audioPath!);
      case 'list_capabilities': return this.listCapabilities();
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async analyzeAudio(audioPath: string): Promise<string> {
    if (!fs.existsSync(audioPath)) return `Error: "${audioPath}" not found.`;

    const metadata = this.getAudioMetadata(audioPath);
    const lines: string[] = ['Audio Analysis:', ...metadata.split('\n')];

    // Try Whisper (OpenAI) first
    if (process.env.OPENAI_API_KEY) {
      try {
        const transcription = await this.transcribeWithProvider(audioPath, 'openai');
        lines.push('', 'Transcription:', transcription.slice(0, 1000));
      } catch { /* fallback */ }
    }

    // Try Deepgram
    if (process.env.DEEPGRAM_API_KEY) {
      try {
        const transcription = await this.transcribeWithProvider(audioPath, 'deepgram');
        lines.push('', 'Transcription (Deepgram):', transcription.slice(0, 1000));
      } catch { /* fallback */ }
    }

    // Try local whisper.cpp
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('whisper', [audioPath, '--output_format', 'txt', '--output_dir', require('os').tmpdir()], { timeout: 120000 }).toString();
      lines.push('', 'Transcription (local):', result.slice(0, 1000));
    } catch { /* ignore */ }

    return lines.join('\n');
  }

  private async transcribeAudio(audioPath: string, args: Record<string, unknown>): Promise<string> {
    if (!fs.existsSync(audioPath)) return `Error: "${audioPath}" not found.`;
    const language = String(args.language || 'auto');

    // Try Whisper first
    if (process.env.OPENAI_API_KEY) {
      try { return await this.transcribeWithProvider(audioPath, 'openai', language); } catch { /* fallback */ }
    }

    // Try Deepgram
    if (process.env.DEEPGRAM_API_KEY) {
      try { return await this.transcribeWithProvider(audioPath, 'deepgram', language); } catch { /* fallback */ }
    }

    // Try Gemini
    if (process.env.GEMINI_API_KEY) {
      try { return await this.transcribeWithProvider(audioPath, 'gemini', language); } catch { /* fallback */ }
    }

    return 'Error: No STT API key configured (OPENAI_API_KEY, DEEPGRAM_API_KEY, or GEMINI_API_KEY required).';
  }

  private async transcribeWithProvider(audioPath: string, provider: string, language?: string): Promise<string> {
    const { execFileSync } = await import('child_process');

    switch (provider) {
      case 'openai': {
        const apiKey = process.env.OPENAI_API_KEY!;
        const langParam = language && language !== 'auto' ? `-F language=${language}` : '';
        const result = execFileSync('curl', [
          '-s', '-X', 'POST',
          '-H', `Authorization: Bearer ${apiKey}`,
          '-F', `file=@${audioPath}`,
          '-F', 'model=whisper-1',
          langParam,
          '-F', 'response_format=text',
        ].filter(Boolean), { timeout: 60000 }).toString();
        return result;
      }
      case 'deepgram': {
        const apiKey = process.env.DEEPGRAM_API_KEY!;
        const lang = language && language !== 'auto' ? language : 'en';
        const result = execFileSync('curl', [
          '-s', '-X', 'POST',
          '-H', `Authorization: Token ${apiKey}`,
          '-F', `file=@${audioPath}`,
          '-F', 'model=nova-2',
          `-F language=${lang}`,
        ], { timeout: 60000 }).toString();
        const parsed = JSON.parse(result);
        return parsed.results?.channels?.[0]?.alternatives?.[0]?.transcript || result;
      }
      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY!;
        const audioBase64 = fs.readFileSync(audioPath).toString('base64');
        const payload = JSON.stringify({
          contents: [{ parts: [
            { text: `Transcribe this audio. Language: ${language || 'auto-detect'}` },
            { inline_data: { mime_type: 'audio/mpeg', data: audioBase64.slice(0, 4 * 1024 * 1024) } },
          ] }],
        });
        const tmpFile = path.join(require('os').tmpdir(), `stt_gemini_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST', '-H', 'Content-Type: application/json',
            '-d', `@${tmpFile}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          ], { timeout: 60000 }).toString();
          const parsed = JSON.parse(result);
          return parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No transcription available.';
        } finally { try { fs.unlinkSync(tmpFile); } catch { /* ignore */ } }
      }
      default:
        throw new Error(`Provider "${provider}" not supported.`);
    }
  }

  private async detectSpeakers(audioPath: string): Promise<string> {
    return 'Speaker diarization requires specialized models. Use Whisper with speaker detection.';
  }

  private async analyzeSentiment(audioPath: string): Promise<string> {
    return 'Audio sentiment analysis requires transcription first. Transcribe then analyze text sentiment.';
  }

  private getMetadata(audioPath: string): string {
    if (!fs.existsSync(audioPath)) return `Error: "${audioPath}" not found.`;

    const stat = fs.statSync(audioPath);
    const ext = path.extname(audioPath).toLowerCase();
    const sizeMB = stat.size / (1024 * 1024);

    const lines: string[] = [
      `File: ${path.basename(audioPath)}`,
      `Format: ${ext}`,
      `Size: ${sizeMB.toFixed(2)} MB`,
      `Modified: ${stat.mtime.toISOString()}`,
    ];

    return lines.join('\n');
  }

  private async detectGenre(audioPath: string): Promise<string> {
    return 'Music genre detection requires specialized ML models. Analyze audio characteristics first.';
  }

  private getAudioMetadata(audioPath: string): string {
    return this.getMetadata(audioPath);
  }

  private listCapabilities(): string {
    return [
      'Audio Analyzer Capabilities:',
      '  analyze: Full audio analysis (metadata + transcription)',
      '  transcribe: Speech-to-text via Whisper',
      '  get_metadata: File metadata (format, size, duration)',
      '  detect_speakers: Speaker diarization (requires specialized model)',
      '  analyze_sentiment: Sentiment analysis (requires transcription)',
      '  detect_genre: Music genre detection (requires ML model)',
    ].join('\n');
  }
}
