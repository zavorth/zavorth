import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

interface TtsVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  backend: string;
}

export class ZavorthTtsTool extends BaseTool {
  public readonly name = 'zavorth_tts';

  public readonly description =
    'Converts text to speech (Text-to-Speech) usando multiplos backends: local (macOS/Windows/Linux), Azure Speech, ElevenLabs, MLX (Apple Silicon), Gemini TTS, e Deepgram. Suporta selecao de voz, velocidade, idioma e salvamento em arquivo.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'speak', 'list_voices', 'list_backends', 'set_default'.",
      },
      text: {
        type: 'string',
        description: 'Texto para converter em fala.',
      },
      backend: {
        type: 'string',
        description: "Backend TTS: 'local' (default), 'azure', 'elevenlabs', 'mlx', 'gemini', 'deepgram'.",
      },
      voice_id: {
        type: 'string',
        description: 'Voice ID (especifico do backend).',
      },
      language: {
        type: 'string',
        description: "Idioma (ISO 639-1). Default: 'pt-BR'.",
      },
      speed: {
        type: 'number',
        description: 'Speech speed (0.5 a 2.0). Default: 1.0.',
      },
      pitch: {
        type: 'number',
        description: 'Voice pitch (-20 a 20, em semitons). Default: 0.',
      },
      output_path: {
        type: 'string',
        description: 'Path to save the audio file (mp3/wav).',
      },
      output_format: {
        type: 'string',
        description: "Formato do audio: 'mp3' (default), 'wav', 'ogg'.",
      },
      ssml: {
        type: 'boolean',
        description: 'If true, text is interpreted as SSML. Default: false.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  // NOTE: defaultBackend is instance-scoped and resets on restart.
  // For production, persist this choice to a config file or environment variable.
  private defaultBackend = 'local';

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'tts');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: 'action' parameter is required.';

    const validActions = ['speak', 'list_voices', 'list_backends', 'set_default'];
    if (!validActions.includes(action)) {
      return `Error: action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'speak': return await this.speak(args);
        case 'list_voices': return this.listVoices(args);
        case 'list_backends': return this.listBackends();
        case 'set_default': return this.setDefault(args);
        default: return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `TTS error: ${message}`;
    }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private async speak(args: Record<string, unknown>): Promise<string> {
    const text = String(args.text || '');
    if (!text) return 'Error: "text" parameter is required for speak.';

    if (text.length > 10000) {
      return 'Error: text exceeds 10.000 characters. Split into smaller parts.';
    }

    const backend = String(args.backend || this.defaultBackend);
    const voiceId = typeof args.voice_id === 'string' ? args.voice_id : undefined;
    const language = String(args.language || 'pt-BR');
    const speed = typeof args.speed === 'number' ? Math.max(0.5, Math.min(2.0, args.speed)) : 1.0;
    const pitch = typeof args.pitch === 'number' ? Math.max(-20, Math.min(20, args.pitch)) : 0;
    const outputFormat = String(args.output_format || 'mp3');
    const isSsml = args.ssml === true;

    const outputPath = typeof args.output_path === 'string'
      ? args.output_path
      : path.join(this.storageDir, `tts_${Date.now()}.${outputFormat}`);

    try {
      const result = await this.executeTts(text, {
        backend,
        voiceId,
        language,
        speed,
        pitch,
        outputPath,
        outputFormat,
        ssml: isSsml,
      });

      const fileSize = fs.existsSync(result) ? (fs.statSync(result).size / 1024).toFixed(1) : '?';

      const lines: string[] = [
        `Audio generated successfully.`,
        `  - Backend: ${backend}`,
        `  - Voice: ${voiceId || 'padrao'}`,
        `  - Idioma: ${language}`,
        `  - Velocidade: ${speed}x`,
        `  - Arquivo: ${result}`,
        `  - Tamanho: ${fileSize} KB`,
        `  - Texto: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
      ];
      return lines.join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Audio generation error: ${message}`;
    }
  }

  private listVoices(args: Record<string, unknown>): string {
    const backend = String(args.backend || this.defaultBackend);
    const language = typeof args.language === 'string' ? args.language : undefined;

    const voices = this.getVoicesForBackend(backend, language);

    if (voices.length === 0) {
      return `No voz encontrada para o backend "${backend}".`;
    }

    const lines: string[] = [`Voicees disponiveis (${backend}):`];
    for (const voice of voices) {
      const genderIcon = { male: '👨', female: '👩', neutral: '🧑' }[voice.gender];
      lines.push(`  ${genderIcon} ${voice.id} — ${voice.name} (${voice.language})`);
    }
    return lines.join('\n');
  }

  private listBackends(): string {
    const backends = [
      { id: 'local', name: 'Local (OS nativo)', platforms: 'macOS (say), Linux (espeak), Windows (System.Speech)', key: 'No chave necessaria' },
      { id: 'azure', name: 'Azure Speech', platforms: 'Todos', key: 'AZURE_SPEECH_KEY + AZURE_SPEECH_REGION' },
      { id: 'elevenlabs', name: 'ElevenLabs', platforms: 'Todos', key: 'ELEVENLABS_API_KEY' },
      { id: 'mlx', name: 'MLX (Apple Silicon)', platforms: 'macOS com Apple Silicon', key: 'No chave necessaria' },
      { id: 'gemini', name: 'Gemini TTS', platforms: 'Todos', key: 'GEMINI_API_KEY' },
      { id: 'deepgram', name: 'Deepgram Aura', platforms: 'Todos', key: 'DEEPGRAM_API_KEY' },
    ];

    const lines: string[] = ['Backends TTS disponiveis:'];
    for (const backend of backends) {
      const available = this.isBackendAvailable(backend.id) ? '✅' : '❌';
      lines.push(`  ${available} ${backend.id} — ${backend.name}`);
      lines.push(`     Plataformas: ${backend.platforms}`);
      lines.push(`     Chave: ${backend.key}`);
    }
    return lines.join('\n');
  }

  private setDefault(args: Record<string, unknown>): string {
    const backend = String(args.backend || '');
    if (!backend) return 'Error: "backend" is required.';

    const validBackends = ['local', 'azure', 'elevenlabs', 'mlx', 'gemini', 'deepgram'];
    if (!validBackends.includes(backend)) {
      return `Error: backend "${backend}" is invalid. Use: ${validBackends.join(', ')}.`;
    }

    this.defaultBackend = backend;
    return `Backend TTS padrao alterado para "${backend}".`;
  }

  private isBackendAvailable(backend: string): boolean {
    switch (backend) {
      case 'local': return true;
      case 'azure': return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
      case 'elevenlabs': return !!process.env.ELEVENLABS_API_KEY;
      case 'mlx': return process.platform === 'darwin';
      case 'gemini': return !!process.env.GEMINI_API_KEY;
      case 'deepgram': return !!process.env.DEEPGRAM_API_KEY;
      default: return false;
    }
  }

  private getVoicesForBackend(backend: string, language?: string): TtsVoice[] {
    const voices: TtsVoice[] = [];

    switch (backend) {
      case 'local': {
        if (process.platform === 'darwin') {
          voices.push(
            { id: 'default', name: 'Sistema macOS', language: 'pt-BR', gender: 'neutral', backend: 'local' },
            { id: 'Alex', name: 'Alex', language: 'en-US', gender: 'male', backend: 'local' },
            { id: 'Samantha', name: 'Samantha', language: 'en-US', gender: 'female', backend: 'local' },
            { id: 'Luciana', name: 'Luciana', language: 'pt-BR', gender: 'female', backend: 'local' },
          );
        } else if (process.platform === 'linux') {
          voices.push(
            { id: 'default', name: 'espeak', language: 'pt-BR', gender: 'neutral', backend: 'local' },
          );
        } else {
          voices.push(
            { id: 'default', name: 'System.Speech', language: 'pt-BR', gender: 'neutral', backend: 'local' },
          );
        }
        break;
      }
      case 'azure': {
        voices.push(
          { id: 'pt-BR-AntonioNeural', name: 'Antonio', language: 'pt-BR', gender: 'male', backend: 'azure' },
          { id: 'pt-BR-FranciscaNeural', name: 'Francisca', language: 'pt-BR', gender: 'female', backend: 'azure' },
          { id: 'en-US-GuyNeural', name: 'Guy', language: 'en-US', gender: 'male', backend: 'azure' },
          { id: 'en-US-JennyNeural', name: 'Jenny', language: 'en-US', gender: 'female', backend: 'azure' },
          { id: 'es-ES-ElviraNeural', name: 'Elvira', language: 'es-ES', gender: 'female', backend: 'azure' },
          { id: 'fr-FR-DeniseNeural', name: 'Denise', language: 'fr-FR', gender: 'female', backend: 'azure' },
          { id: 'de-DE-KatjaNeural', name: 'Katja', language: 'de-DE', gender: 'female', backend: 'azure' },
          { id: 'ja-JP-NanamiNeural', name: 'Nanami', language: 'ja-JP', gender: 'female', backend: 'azure' },
          { id: 'zh-CN-XiaoxiaoNeural', name: 'Xiaoxiao', language: 'zh-CN', gender: 'female', backend: 'azure' },
        );
        break;
      }
      case 'elevenlabs': {
        voices.push(
          { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'en-US', gender: 'female', backend: 'elevenlabs' },
          { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'en-US', gender: 'male', backend: 'elevenlabs' },
          { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', language: 'en-US', gender: 'female', backend: 'elevenlabs' },
          { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', language: 'en-US', gender: 'male', backend: 'elevenlabs' },
        );
        break;
      }
      default:
        break;
    }

    if (language) {
      return voices.filter((v) => v.language.startsWith(language.split('-')[0]));
    }
    return voices;
  }

  private async executeTts(
    text: string,
    options: {
      backend: string;
      voiceId?: string;
      language: string;
      speed: number;
      pitch: number;
      outputPath: string;
      outputFormat: string;
      ssml: boolean;
    },
  ): Promise<string> {
    const { execFileSync } = await import('child_process');
    const os = require('os');

    switch (options.backend) {
      case 'local': {
        if (process.platform === 'darwin') {
          const rate = Math.round(200 * options.speed);
          const args = ['-r', rate.toString(), '-o', options.outputPath];
          if (options.voiceId && options.voiceId !== 'default') {
            args.splice(0, 0, '-v', options.voiceId);
          }
          args.push(text);
          execFileSync('say', args, { timeout: 60000 });
          return options.outputPath;
        } else if (process.platform === 'linux') {
          const rate = Math.round(175 * options.speed);
          execFileSync('espeak', ['-s', rate.toString(), '-w', options.outputPath, text], { timeout: 60000 });
          return options.outputPath;
        } else if (process.platform === 'win32') {
          const rate = Math.round((options.speed - 1) * 10);
          const script = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SetOutputToWaveFile('${options.outputPath.replace(/\\/g, '\\\\')}'); $synth.Rate = ${rate}; $synth.Speak('${text.replace(/'/g, "''")}'); $synth.SetOutputToNull()`;
          execFileSync('powershell', ['-Command', script], { timeout: 60000 });
          return options.outputPath;
        }
        throw new Error(`TTS local not supported em ${process.platform}.`);
      }

      case 'elevenlabs': {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured.');
        const voice = options.voiceId || '21m00Tcm4TlvDq8ikWAM';
        const payload = JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: options.speed },
        });
        const tmpPayload = path.join(os.tmpdir(), `el_tts_${Date.now()}.json`);
        fs.writeFileSync(tmpPayload, payload);
        try {
          execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
            '-H', `xi-api-key: ${apiKey}`,
            '-H', 'Content-Type: application/json',
            '-d', `@${tmpPayload}`,
            '-o', options.outputPath,
          ], { timeout: 120000 });
        } finally {
          try { fs.unlinkSync(tmpPayload); } catch { /* ignore */ }
        }
        return options.outputPath;
      }

      case 'azure': {
        const apiKey = process.env.AZURE_SPEECH_KEY;
        const region = process.env.AZURE_SPEECH_REGION;
        if (!apiKey || !region) throw new Error('AZURE_SPEECH_KEY e AZURE_SPEECH_REGION not configureds.');
        const voice = options.voiceId || 'pt-BR-AntonioNeural';
        const ratePercent = Math.round((options.speed - 1) * 100);
        const pitchHz = options.pitch !== 0 ? `${options.pitch}Hz` : '+0Hz';
        const safeText = options.ssml ? text : xmlEscape(text);
        const ssmlBody = options.ssml
          ? text
          : `<speak version='1.0' xml:lang='${options.language}'><voice name='${voice}'><prosody rate='${ratePercent}%' pitch='${pitchHz}'>${safeText}</prosody></voice></speak>`;
        const tmpSsml = path.join(os.tmpdir(), `azure_tts_${Date.now()}.xml`);
        fs.writeFileSync(tmpSsml, ssmlBody);
        try {
          execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
            '-H', `Ocp-Apim-Subscription-Key: ${apiKey}`,
            '-H', 'Content-Type: application/ssml+xml',
            '-H', 'X-Microsoft-OutputFormat: audio-16khz-128kbitrate-mono-mp3',
            '-d', `@${tmpSsml}`,
            '-o', options.outputPath,
          ], { timeout: 120000 });
        } finally {
          try { fs.unlinkSync(tmpSsml); } catch { /* ignore */ }
        }
        return options.outputPath;
      }

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
        const prompt = `Convert the following text to speech. Idioma: ${options.language}. Velocidade: ${options.speed}x.\n\nTexto: ${text}`;
        const payload = JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        });
        const tmpPayload = path.join(os.tmpdir(), `gemini_tts_${Date.now()}.json`);
        fs.writeFileSync(tmpPayload, payload);
        try {
          execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            '-H', 'Content-Type: application/json',
            '-d', `@${tmpPayload}`,
            '-o', `${options.outputPath}.json`,
          ], { timeout: 60000 });
        } finally {
          try { fs.unlinkSync(tmpPayload); } catch { /* ignore */ }
        }
        return `${options.outputPath}.json`;
      }

      case 'deepgram': {
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured.');
        const voice = options.voiceId || 'asteria';
        const payload = JSON.stringify({ text });
        const tmpPayload = path.join(os.tmpdir(), `dg_tts_${Date.now()}.json`);
        fs.writeFileSync(tmpPayload, payload);
        try {
          execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://api.deepgram.com/v1/speak?model=${voice}&encoding=mp3&container=mp3`,
            '-H', `Authorization: Token ${apiKey}`,
            '-H', 'Content-Type: application/json',
            '-d', `@${tmpPayload}`,
            '-o', options.outputPath,
          ], { timeout: 120000 });
        } finally {
          try { fs.unlinkSync(tmpPayload); } catch { /* ignore */ }
        }
        return options.outputPath;
      }

      default:
        throw new Error(`Backend TTS "${options.backend}" not supported.`);
    }
  }
}
