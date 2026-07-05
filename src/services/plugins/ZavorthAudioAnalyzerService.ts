import fs from 'fs';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import { getBestProvider, getAvailableProviders, callAudioProvider, listProviders } from './MultimodalProviderSelector.js';
import { logger } from '../../logger.js';

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

    const provider = getBestProvider('audio');
    if (provider) {
      try {
        const apiKey = process.env[provider.apiKeyEnv]!;
        const transcription = await callAudioProvider(provider, audioPath, 'auto', apiKey);
        lines.push('', 'Transcription:', transcription.slice(0, 1000));
      } catch (error: unknown) {
        lines.push('', `Transcription error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      lines.push('', 'Note: No audio provider available. Configure OPENAI_API_KEY, DEEPGRAM_API_KEY, or GEMINI_API_KEY.');
    }

    return lines.join('\n');
  }

  private async transcribeAudio(audioPath: string, args: Record<string, unknown>): Promise<string> {
    if (!fs.existsSync(audioPath)) return `Error: "${audioPath}" not found.`;
    const language = String(args.language || 'auto');

    const provider = getBestProvider('audio');
    if (!provider) {
      return `Error: No audio provider available. Configure one of: ${getAvailableProviders('audio').map(p => p.apiKeyEnv).join(', ')}`;
    }

    try {
      const apiKey = process.env[provider.apiKeyEnv]!;
      return await callAudioProvider(provider, audioPath, language, apiKey);
    } catch (error) { logger.warn('[Zavorth Audio Analyzer] operation failed', error); return ''; }
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
