import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

interface TranscriptionResult {
  success: boolean;
  text: string;
  language?: string;
  duration_seconds?: number;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
  backend: string;
  error?: string;
}

export class ZavorthSttTool extends BaseTool {
  public readonly name = 'zavorth_stt';

  public readonly description =
    'Converte fala em texto (Speech-to-Text) usando multiplos backends: Whisper (OpenAI), Deepgram, Gemini, Azure Speech e local (whisper.cpp). Suporta deteccao de idioma, timestamps por palavra, e multiplos formatos de audio.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'transcribe', 'detect_language', 'list_backends', 'set_default'.",
      },
      audio_path: {
        type: 'string',
        description: 'Caminho do arquivo de audio (mp3, wav, ogg, flac, m4a, webm).',
      },
      backend: {
        type: 'string',
        description: "Backend STT: 'whisper' (default), 'deepgram', 'gemini', 'azure', 'local'.",
      },
      language: {
        type: 'string',
        description: "Idioma do audio (ISO 639-1). Default: auto-detectado.",
      },
      model: {
        type: 'string',
        description: "Modelo especifico (whisper-1, nova-2, etc).",
      },
      word_timestamps: {
        type: 'boolean',
        description: 'Se true, retorna timestamps por palavra. Default: false.',
      },
      output_format: {
        type: 'string',
        description: "Formato de saida: 'text' (default), 'json', 'srt', 'vtt'.",
      },
      output_path: {
        type: 'string',
        description: 'Caminho para salvar a transcricao.',
      },
      prompt: {
        type: 'string',
        description: 'Prompt de contexto para melhorar a transcricao (nomes proprios, termos tecnicos).',
      },
      temperature: {
        type: 'number',
        description: 'Temperatura para geracao (0-1). Default: 0.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;
  private defaultBackend = 'whisper';

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'stt');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Erro: o parametro "action" e obrigatorio.';

    const validActions = ['transcribe', 'detect_language', 'list_backends', 'set_default'];
    if (!validActions.includes(action)) {
      return `Erro: acao "${action}" invalida. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'transcribe': return await this.transcribe(args);
        case 'detect_language': return await this.detectLanguage(args);
        case 'list_backends': return this.listBackends();
        case 'set_default': return this.setDefault(args);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro no STT: ${message}`;
    }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private async transcribe(args: Record<string, unknown>): Promise<string> {
    const audioPath = String(args.audio_path || '');
    if (!audioPath) return 'Erro: o parametro "audio_path" e obrigatorio.';

    const resolvedPath = path.resolve(audioPath);
    if (!fs.existsSync(resolvedPath)) {
      return `Erro: arquivo de audio "${audioPath}" nao encontrado.`;
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.size > 25 * 1024 * 1024) {
      return 'Erro: arquivo de audio excede 25MB. Divida ou comprima.';
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    const supportedFormats = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.webm', '.mp4', '.aac', '.wma'];
    if (!supportedFormats.includes(ext)) {
      return `Erro: formato "${ext}" nao suportado. Use: ${supportedFormats.join(', ')}.`;
    }

    const backend = String(args.backend || this.defaultBackend);
    const language = typeof args.language === 'string' ? args.language : undefined;
    const model = typeof args.model === 'string' ? args.model : undefined;
    const wordTimestamps = args.word_timestamps === true;
    const outputFormat = String(args.output_format || 'text');
    const outputPath = typeof args.output_path === 'string' ? args.output_path : undefined;
    const prompt = typeof args.prompt === 'string' ? args.prompt : undefined;
    const temperature = typeof args.temperature === 'number' ? args.temperature : 0;

    try {
      const result = await this.executeTranscription(resolvedPath, {
        backend,
        language,
        model,
        wordTimestamps,
        prompt,
        temperature,
      });

      if (!result.success) {
        return `Erro na transcricao: ${result.error}`;
      }

      const formatted = this.formatTranscription(result, outputFormat);

      if (outputPath) {
        fs.writeFileSync(path.resolve(outputPath), formatted, 'utf-8');
        return `Transcricao salva em ${outputPath}. Backend: ${backend}. Tamanho: ${formatted.length} chars.`;
      }

      const lines: string[] = [
        `Transcricao (${backend}):`,
        formatted,
      ];
      if (result.language) lines.push(`Idioma detectado: ${result.language}`);
      if (result.duration_seconds) lines.push(`Duracao: ${result.duration_seconds.toFixed(1)}s`);
      if (result.words && result.words.length > 0) {
        lines.push(`Palavras: ${result.words.length}`);
      }

      return lines.join('\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro na transcricao: ${message}`;
    }
  }

  private async detectLanguage(args: Record<string, unknown>): Promise<string> {
    const audioPath = String(args.audio_path || '');
    if (!audioPath) return 'Erro: o parametro "audio_path" e obrigatorio.';

    const resolvedPath = path.resolve(audioPath);
    if (!fs.existsSync(resolvedPath)) {
      return `Erro: arquivo de audio "${audioPath}" nao encontrado.`;
    }

    const backend = String(args.backend || this.defaultBackend);

    try {
      const result = await this.executeTranscription(resolvedPath, {
        backend,
        language: undefined,
        wordTimestamps: false,
        prompt: undefined,
        temperature: 0,
      });

      if (!result.success) {
        return `Erro na deteccao: ${result.error}`;
      }

      return `Idioma detectado: ${result.language || 'desconhecido'}. Texto: "${result.text.slice(0, 100)}..."`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `Erro na deteccao de idioma: ${message}`;
    }
  }

  private listBackends(): string {
    const backends = [
      { id: 'whisper', name: 'Whisper (OpenAI)', key: 'OPENAI_API_KEY', note: 'Mais preciso, suporta 99 idiomas' },
      { id: 'deepgram', name: 'Deepgram Nova', key: 'DEEPGRAM_API_KEY', note: 'Mais rapido, bom para tempo real' },
      { id: 'gemini', name: 'Gemini', key: 'GEMINI_API_KEY', note: 'Multimodal, contexto longo' },
      { id: 'azure', name: 'Azure Speech', key: 'AZURE_SPEECH_KEY', note: 'Enterprise, muitos idiomas' },
      { id: 'local', name: 'Local (whisper.cpp)', key: 'Nenhuma', note: 'Offline, privacidade total' },
    ];

    const lines: string[] = ['Backends STT disponiveis:'];
    for (const backend of backends) {
      const available = this.isBackendAvailable(backend.id) ? '✅' : '❌';
      lines.push(`  ${available} ${backend.id} — ${backend.name}`);
      lines.push(`     Chave: ${backend.key}`);
      lines.push(`     Nota: ${backend.note}`);
    }
    return lines.join('\n');
  }

  private setDefault(args: Record<string, unknown>): string {
    const backend = String(args.backend || '');
    if (!backend) return 'Erro: "backend" e obrigatorio.';

    const validBackends = ['whisper', 'deepgram', 'gemini', 'azure', 'local'];
    if (!validBackends.includes(backend)) {
      return `Erro: backend "${backend}" invalido. Use: ${validBackends.join(', ')}.`;
    }

    this.defaultBackend = backend;
    return `Backend STT padrao alterado para "${backend}".`;
  }

  private isBackendAvailable(backend: string): boolean {
    switch (backend) {
      case 'whisper': return !!process.env.OPENAI_API_KEY;
      case 'deepgram': return !!process.env.DEEPGRAM_API_KEY;
      case 'gemini': return !!process.env.GEMINI_API_KEY;
      case 'azure': return !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
      case 'local': {
        try {
          const { execFileSync } = require('child_process');
          execFileSync('whisper', ['--help'], { timeout: 3000 });
          return true;
        } catch {
          return false;
        }
      }
      default: return false;
    }
  }

  private async executeTranscription(
    audioPath: string,
    options: {
      backend: string;
      language?: string;
      model?: string;
      wordTimestamps: boolean;
      prompt?: string;
      temperature: number;
    },
  ): Promise<TranscriptionResult> {
    const { execFileSync } = await import('child_process');
    const os = require('os');

    switch (options.backend) {
      case 'whisper': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY nao configurada.');

        const curlArgs = [
          '-s', '-X', 'POST',
          'https://api.openai.com/v1/audio/transcriptions',
          '-H', `Authorization: Bearer ${apiKey}`,
          '-F', `file=@${audioPath}`,
          '-F', `model=${options.model || 'whisper-1'}`,
        ];
        if (options.language) curlArgs.push('-F', `language=${options.language.split('-')[0]}`);
        if (options.wordTimestamps) {
          curlArgs.push('-F', 'timestamp_granularities[]=word', '-F', 'response_format=verbose_json');
        } else {
          curlArgs.push('-F', 'response_format=text');
        }
        if (options.prompt) curlArgs.push('-F', `prompt=${options.prompt}`);

        const result = execFileSync('curl', curlArgs, {
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        }).toString();

        try {
          const parsed = JSON.parse(result);
          if (options.wordTimestamps && parsed.words) {
            return {
              success: true,
              text: parsed.text,
              language: parsed.language,
              duration_seconds: parsed.duration,
              words: parsed.words.map((w: { word: string; start: number; end: number }) => ({
                word: w.word,
                start: w.start,
                end: w.end,
                confidence: 1.0,
              })),
              backend: 'whisper',
            };
          }
          return { success: true, text: parsed.text || result, language: parsed.language, backend: 'whisper' };
        } catch {
          return { success: true, text: result, backend: 'whisper' };
        }
      }

      case 'deepgram': {
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) throw new Error('DEEPGRAM_API_KEY nao configurada.');

        const model = options.model || 'nova-2';
        let url = `https://api.deepgram.com/v1/listen?model=${model}`;
        if (options.language) url += `&language=${options.language.split('-')[0]}`;
        url += '&smart_format=true';
        if (options.wordTimestamps) url += '&diarize=true';

        const result = execFileSync('curl', [
          '-s', '-X', 'POST', url,
          '-H', `Authorization: Token ${apiKey}`,
          '-H', 'Content-Type: audio/mp3',
          '--data-binary', `@${audioPath}`,
        ], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }).toString();

        try {
          const parsed = JSON.parse(result);
          const transcript = parsed.results?.channels?.[0]?.alternatives?.[0];
          return {
            success: true,
            text: transcript?.transcript || result,
            language: parsed.results?.language,
            duration_seconds: parsed.metadata?.duration,
            words: transcript?.words?.map((w: { word: string; start: number; end: number; confidence: number }) => ({
              word: w.word,
              start: w.start,
              end: w.end,
              confidence: w.confidence,
            })),
            backend: 'deepgram',
          };
        } catch {
          return { success: true, text: result, backend: 'deepgram' };
        }
      }

      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada.');

        const audioBase64 = fs.readFileSync(audioPath).toString('base64');
        const langHint = options.language ? ` Idioma esperado: ${options.language}.` : '';
        const promptText = `${options.prompt ? options.prompt + ' ' : ''}Transcreva este audio com precisao.${langHint}`;

        const payload = JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: 'audio/mpeg', data: audioBase64.slice(0, 4 * 1024 * 1024) } },
            ],
          }],
          generationConfig: { temperature: options.temperature },
        });

        const tmpPayload = path.join(os.tmpdir(), `gemini_stt_${Date.now()}.json`);
        fs.writeFileSync(tmpPayload, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            '-H', 'Content-Type: application/json',
            '-d', `@${tmpPayload}`,
          ], { timeout: 120000 }).toString();

          try {
            const parsed = JSON.parse(result);
            return {
              success: true,
              text: parsed.candidates?.[0]?.content?.parts?.[0]?.text || result,
              language: options.language,
              backend: 'gemini',
            };
          } catch {
            return { success: true, text: result, backend: 'gemini' };
          }
        } finally {
          try { fs.unlinkSync(tmpPayload); } catch { /* ignore */ }
        }
      }

      case 'azure': {
        const apiKey = process.env.AZURE_SPEECH_KEY;
        const region = process.env.AZURE_SPEECH_REGION;
        if (!apiKey || !region) throw new Error('AZURE_SPEECH_KEY e AZURE_SPEECH_REGION nao configuradas.');

        const locale = options.language || 'pt-BR';
        const result = execFileSync('curl', [
          '-s', '-X', 'POST',
          `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}`,
          '-H', `Ocp-Apim-Subscription-Key: ${apiKey}`,
          '-H', 'Content-Type: audio/wav',
          '--data-binary', `@${audioPath}`,
        ], { timeout: 120000 }).toString();

        try {
          const parsed = JSON.parse(result);
          return { success: true, text: parsed.DisplayText || result, language: locale, backend: 'azure' };
        } catch {
          return { success: true, text: result, backend: 'azure' };
        }
      }

      case 'local': {
        const args = [audioPath];
        if (options.language) args.push('--language', options.language.split('-')[0]);
        if (options.model) args.push('--model', options.model);
        args.push('--output_format', 'txt', '--output_dir', this.storageDir);

        const result = execFileSync('whisper', args, { timeout: 300000 }).toString();

        const outputFile = path.join(this.storageDir, path.basename(audioPath, path.extname(audioPath)) + '.txt');
        let text = result;
        if (fs.existsSync(outputFile)) {
          text = fs.readFileSync(outputFile, 'utf-8');
          fs.unlinkSync(outputFile);
        }

        return { success: true, text: text.trim(), language: options.language, backend: 'local' };
      }

      default:
        throw new Error(`Backend STT "${options.backend}" nao suportado.`);
    }
  }

  private formatTranscription(result: TranscriptionResult, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(result, null, 2);

      case 'srt': {
        if (!result.words || result.words.length === 0) return result.text;
        const lines: string[] = [];
        let idx = 1;
        for (let i = 0; i < result.words.length; i += 10) {
          const chunk = result.words.slice(i, i + 10);
          const start = this.formatSrtTime(chunk[0].start);
          const end = this.formatSrtTime(chunk[chunk.length - 1].end);
          lines.push(`${idx}`);
          lines.push(`${start} --> ${end}`);
          lines.push(chunk.map((w) => w.word).join(' '));
          lines.push('');
          idx++;
        }
        return lines.join('\n');
      }

      case 'vtt': {
        if (!result.words || result.words.length === 0) return result.text;
        const vttLines: string[] = ['WEBVTT', ''];
        for (let i = 0; i < result.words.length; i += 10) {
          const chunk = result.words.slice(i, i + 10);
          const start = this.formatVttTime(chunk[0].start);
          const end = this.formatVttTime(chunk[chunk.length - 1].end);
          vttLines.push(`${start} --> ${end}`);
          vttLines.push(chunk.map((w) => w.word).join(' '));
          vttLines.push('');
        }
        return vttLines.join('\n');
      }

      case 'text':
      default:
        return result.text;
    }
  }

  private formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  private formatVttTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
}
