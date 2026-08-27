
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

const MAX_GEMINI_AUDIO_BASE64_BYTES = 4 * 1024 * 1024;

interface VoiceSession {
  id: string;
  status: 'idle' | 'listening' | 'processing' | 'speaking';
  mode: 'push_to_talk' | 'wake_word' | 'continuous' | 'manual';
  language: string;
  tts_backend: 'local' | 'azure' | 'elevenlabs' | 'mlx' | 'gemini';
  stt_backend: 'whisper' | 'azure' | 'deepgram' | 'gemini' | 'local';
  wake_word: string | null;
  voice_id: string | null;
  started_at: string;
  last_activity: string;
  interaction_count: number;
}

export class ZavorthVoiceModeTool extends BaseTool {
  public readonly name = 'zavorth_voice_mode';

  public readonly description =
    'Manage Zavorth voice sessions: STT (speech-to-text), TTS (text-to-speech), wake-word detection, and real-time voice conversation. Supports multiple backends (Whisper, Azure, ElevenLabs, MLX, Gemini, Deepgram).';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'start_session', 'stop_session', 'speak', 'listen', 'transcribe', 'list_sessions', 'status', 'set_mode', 'set_voice', 'interrupt'.",
      },
      session_id: {
        type: 'string',
        description: 'Voice session ID.',
      },
      text: {
        type: 'string',
        description: 'Text to speak with TTS or transcribe from audio.',
      },
      audio_path: {
        type: 'string',
        description: 'Path to the audio file to transcribe.',
      },
      mode: {
        type: 'string',
        description: "Operation mode: 'push_to_talk', 'wake_word', 'continuous', 'manual'. Default: 'manual'.",
      },
      language: {
        type: 'string',
        description: "Language (ISO 639-1). Default: 'en-US'.",
      },
      tts_backend: {
        type: 'string',
        description: "Backend TTS: 'local', 'azure', 'elevenlabs', 'mlx', 'gemini'. Default: 'local'.",
      },
      stt_backend: {
        type: 'string',
        description: "Backend STT: 'whisper', 'azure', 'deepgram', 'gemini', 'local'. Default: 'whisper'.",
      },
      wake_word: {
        type: 'string',
        description: "Wake word for wake_word mode. Default: 'zavorth'.",
      },
      voice_id: {
        type: 'string',
        description: 'Voice ID for backends that support voice selection.',
      },
      speed: {
        type: 'number',
        description: 'Speech speed (0.5-2.0). Default: 1.0.',
      },
      output_path: {
        type: 'string',
        description: 'Path to save generated TTS audio.',
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'voice');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return "Error: 'action' parameter is required.";

    const validActions = [
      'start_session', 'stop_session', 'speak', 'listen', 'transcribe',
      'list_sessions', 'status', 'set_mode', 'set_voice', 'interrupt', 'list_backends',
    ];
    if (!validActions.includes(action)) {
      return `Error: action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'start_session': return this.startSession(args);
        case 'stop_session': return this.stopSession(args);
        case 'speak': return await this.speak(args);
        case 'listen': return this.listen(args);
        case 'transcribe': return await this.transcribe(args);
        case 'list_sessions': return this.listSessions();
        case 'status': return this.sessionStatus(args);
        case 'set_mode': return this.setMode(args);
        case 'set_voice': return this.setVoice(args);
        case 'interrupt': return this.interrupt(args);
        case 'list_backends': return this.listBackends();
        default: return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Voice Mode] filesystem check failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `VoiceMode error: ${message}`;
  }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private sessionPath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.json`);
  }

  private loadSession(sessionId: string): VoiceSession | null {
    const filePath = this.sessionPath(sessionId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as VoiceSession;
  }

  private saveSession(session: VoiceSession): void {
    fs.writeFileSync(this.sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
  }

  private listAllSessionIds(): string[] {
    if (!fs.existsSync(this.storageDir)) return [];
    return fs.readdirSync(this.storageDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  private startSession(args: Record<string, unknown>): string {
    const mode = String(args.mode || 'manual') as VoiceSession['mode'];
    const language = String(args.language || 'en-US');
    const ttsBackend = String(args.tts_backend || 'local') as VoiceSession['tts_backend'];
    const sttBackend = String(args.stt_backend || 'whisper') as VoiceSession['stt_backend'];
    const wakeWord = typeof args.wake_word === 'string' ? args.wake_word : 'zavorth';

    const sessionId = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const session: VoiceSession = {
      id: sessionId,
      status: 'idle',
      mode,
      language,
      tts_backend: ttsBackend,
      stt_backend: sttBackend,
      wake_word: mode === 'wake_word' ? wakeWord : null,
      voice_id: null,
      started_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      interaction_count: 0,
    };

    this.saveSession(session);

    const lines: string[] = [
      `Voice session created.`,
      `  - ID: ${sessionId}`,
      `  - Modo: ${mode}`,
      `  - Language: ${language}`,
      `  - TTS: ${ttsBackend}`,
      `  - STT: ${sttBackend}`,
    ];
    if (mode === 'wake_word') {
      lines.push(`  - Wake word: "${wakeWord}"`);
    }
    return lines.join('\n');
  }

  private stopSession(args: Record<string, unknown>): string {
    const sessionId = String(args.session_id || '');
    if (!sessionId) return 'Error: "session_id" is required.';

    const session = this.loadSession(sessionId);
    if (!session) return `Error: session "${sessionId}" not found.`;

    session.status = 'idle';
    this.saveSession(session);

    return `Voice session "${sessionId}" ended. ${session.interaction_count} interactions completed.`;
  }

  private async speak(args: Record<string, unknown>): Promise<string> {
    const text = String(args.text || '');
    if (!text) return 'Error: "text" is required. for speak.';

    const sessionId = typeof args.session_id === 'string' ? args.session_id : null;
    const ttsBackend = String(args.tts_backend || 'local');
    const voiceId = typeof args.voice_id === 'string' ? args.voice_id : undefined;
    const speed = typeof args.speed === 'number' ? Math.max(0.5, Math.min(2.0, args.speed)) : 1.0;
    const outputPath = typeof args.output_path === 'string' ? args.output_path : undefined;
    const language = String(args.language || 'en-US');

    if (sessionId) {
      const session = this.loadSession(sessionId);
      if (session) {
        session.status = 'speaking';
        session.last_activity = new Date().toISOString();
        session.interaction_count++;
        this.saveSession(session);
      }
    }

    try {
      const audioPath = await this.executeTts(text, { backend: ttsBackend, voiceId, speed, outputPath, language });

      if (sessionId) {
        const session = this.loadSession(sessionId);
        if (session) {
          session.status = 'idle';
          this.saveSession(session);
        }
      }

      return `Text converted to audio via ${ttsBackend}.${audioPath ? ` Saved to: ${audioPath}` : ''} Text: "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}"`;
    } catch (error: unknown) {if (sessionId) {
        const session = this.loadSession(sessionId);
        if (session) {
          session.status = 'idle';
          this.saveSession(session);
        }
      }
      throw error;
    }
  }

  private listen(args: Record<string, unknown>): string {
    const sessionId = String(args.session_id || '');
    if (!sessionId) return 'Error: "session_id" is required. for listen.';

    const session = this.loadSession(sessionId);
    if (!session) return `Error: session "${sessionId}" not found.`;

    session.status = 'listening';
    session.last_activity = new Date().toISOString();
    this.saveSession(session);

    return `Session "${sessionId}" is now listening (mode: ${session.mode}, STT: ${session.stt_backend}).${session.wake_word ? ` Waiting for wake word: "${session.wake_word}"` : ''}`;
  }

  private async transcribe(args: Record<string, unknown>): Promise<string> {
    const audioPath = String(args.audio_path || '');
    if (!audioPath) return 'Error: "audio_path" is required for transcription.';

    if (!fs.existsSync(audioPath)) return `Error: audio file "${audioPath}" not found.`;

    const sttBackend = String(args.stt_backend || 'whisper');
    const language = String(args.language || 'en-US');

    try {
      const text = await this.executeStt(audioPath, { backend: sttBackend, language });
      return `transcription (${sttBackend}): "${text}"`;
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Voice Mode] filesystem operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Transcription error: ${message}`;
  }
  }

  private listSessions(): string {
    const sessionIds = this.listAllSessionIds();
    if (sessionIds.length === 0) return 'No active voice sessions.';

    const lines: string[] = [`Voice sessions (${sessionIds.length}):`];
    for (const id of sessionIds) {
      const session = this.loadSession(id);
      if (!session) continue;
      const icon = { idle: '⚪', listening: '🎤', processing: '⚙️', speaking: '🔊' }[session.status];
      lines.push(`  ${icon} [${session.id}] ${session.mode} | TTS:${session.tts_backend} STT:${session.stt_backend} | interactions:${session.interaction_count}`);
    }
    return lines.join('\n');
  }

  private sessionStatus(args: Record<string, unknown>): string {
    const sessionId = String(args.session_id || '');
    if (!sessionId) return 'Error: "session_id" is required.';

    const session = this.loadSession(sessionId);
    if (!session) return `Error: session "${sessionId}" not found.`;

    const lines: string[] = [
      `Voice Session: ${session.id}`,
      `  - Status: ${session.status}`,
      `  - Mode: ${session.mode}`,
      `  - Language: ${session.language}`,
      `  - TTS: ${session.tts_backend}`,
      `  - STT: ${session.stt_backend}`,
      `  - Wake word: ${session.wake_word || 'none'}`,
      `  - Interactions: ${session.interaction_count}`,
      `  - Started: ${session.started_at}`,
      `  - Last activity: ${session.last_activity}`,
    ];
    return lines.join('\n');
  }

  private setMode(args: Record<string, unknown>): string {
    const sessionId = String(args.session_id || '');
    const mode = String(args.mode || '');
    if (!sessionId) return 'Error: "session_id" is required.';
    if (!mode) return 'Error: "mode" is required.';

    const validModes = ['push_to_talk', 'wake_word', 'continuous', 'manual'];
    if (!validModes.includes(mode)) {
      return `Error: mode "${mode}" is invalid. Use: ${validModes.join(', ')}.`;
    }

    const session = this.loadSession(sessionId);
    if (!session) return `Error: session "${sessionId}" not found.`;

    session.mode = mode as VoiceSession['mode'];
    if (mode === 'wake_word' && typeof args.wake_word === 'string') {
      session.wake_word = args.wake_word;
    } else if (mode !== 'wake_word') {
      session.wake_word = null;
    }
    session.last_activity = new Date().toISOString();
    this.saveSession(session);

    return `Session "${sessionId}" mode changed to "${mode}".`;
  }

  private setVoice(args: Record<string, unknown>): string {
    const sessionId = String(args.session_id || '');
    const voiceId = String(args.voice_id || '');
    if (!sessionId) return 'Error: "session_id" is required.';
    if (!voiceId) return 'Error: "voice_id" is required.';

    const session = this.loadSession(sessionId);
    if (!session) return `Error: session "${sessionId}" not found.`;

    session.voice_id = voiceId;
    session.last_activity = new Date().toISOString();
    this.saveSession(session);

    return `Voice for session "${sessionId}" changed to "${voiceId}".`;
  }

  private interrupt(args: Record<string, unknown>): string {
    const sessionId = String(args.session_id || '');
    if (!sessionId) return 'Error: "session_id" is required.';

    const session = this.loadSession(sessionId);
    if (!session) return `Error: session "${sessionId}" not found.`;

    if (session.status !== 'speaking' && session.status !== 'processing') {
      return `Session "${sessionId}" is not speaking or processing (status: ${session.status}).`;
    }

    session.status = 'idle';
    session.last_activity = new Date().toISOString();
    this.saveSession(session);

    return `Session "${sessionId}" interrupted.`;
  }

  private listBackends(): string {
    const backends = [
      { id: 'whisper', name: 'Whisper (OpenAI)', type: 'STT', envKey: 'OPENAI_API_KEY' },
      { id: 'deepgram', name: 'Deepgram Nova', type: 'STT', envKey: 'DEEPGRAM_API_KEY' },
      { id: 'gemini', name: 'Gemini', type: 'STT+TTS', envKey: 'GEMINI_API_KEY' },
      { id: 'azure', name: 'Azure Speech', type: 'STT+TTS', envKey: 'AZURE_SPEECH_KEY' },
      { id: 'local', name: 'local (native OS)', type: 'TTS', envKey: '' },
      { id: 'elevenlabs', name: 'ElevenLabs', type: 'TTS', envKey: 'ELEVENLABS_API_KEY' },
      { id: 'mlx', name: 'MLX (Apple Silicon)', type: 'TTS', envKey: '' },
    ];

    const lines: string[] = ['Available voice backends:'];
    for (const b of backends) {
      const available =
        !b.envKey ||
        !!process.env[b.envKey];
      const status = available ? 'Configured' : 'Not configured';
      lines.push(`  ${b.id} — ${b.name} [${b.type}] ${status}`);
    }
    return lines.join('\n');
  }

  private async executeTts(
    text: string,
    options: { backend: string; voiceId?: string; speed: number; outputPath?: string; language: string },
  ): Promise<string | null> {
    const { execFileSync } = await import('child_process');
    const outputPath = options.outputPath || path.join(this.storageDir, `tts_${Date.now()}.mp3`);

    switch (options.backend) {
      case 'local': {
        if (process.platform === 'darwin') {
          execFileSync('say', ['-r', Math.round(200 * options.speed).toString(), '-o', outputPath, text], { timeout: 30000 });
          return outputPath;
        } else if (process.platform === 'linux') {
          execFileSync('espeak', ['-s', Math.round(175 * options.speed).toString(), '-w', outputPath, text], { timeout: 30000 });
          return outputPath;
        } else if (process.platform === 'win32') {
          const script = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SetOutputToWaveFile('${outputPath.replace(/\\/g, '\\\\')}'); $synth.Rate = ${Math.round((options.speed - 1) * 10)}; $synth.Speak('${text.replace(/'/g, "''")}'); $synth.SetOutputToNull()`;
          execFileSync('powershell', ['-Command', script], { timeout: 30000 });
          return outputPath;
        }
        return null;
      }
      case 'elevenlabs': {
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured.');
        const voice = options.voiceId || '21m00Tcm4TlvDq8ikWAM';
        const payload = JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
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
            '-o', outputPath,
          ], { timeout: 60000 });
        } finally {
          try { fs.unlinkSync(tmpPayload); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Voice Mode] file cleanup failed', error); }
        }
        return outputPath;
      }
      case 'azure': {
        const apiKey = process.env.AZURE_SPEECH_KEY;
        const region = process.env.AZURE_SPEECH_REGION;
        if (!apiKey || !region) throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not configured.');
        const voice = options.voiceId || 'en-US-GuyNeural';
        const ssml = `<speak version='1.0' xml:lang='${options.language}'><voice name='${voice}'><prosody rate='${options.speed}'>${text}</prosody></voice></speak>`;
        const tmpSsml = path.join(os.tmpdir(), `azure_tts_${Date.now()}.xml`);
        fs.writeFileSync(tmpSsml, ssml);
        try {
          execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
            '-H', `Ocp-Apim-Subscription-Key: ${apiKey}`,
            '-H', 'Content-Type: application/ssml+xml',
            '-d', `@${tmpSsml}`,
            '-o', outputPath,
          ], { timeout: 60000 });
        } finally {
          try { fs.unlinkSync(tmpSsml); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Voice Mode] file cleanup failed', error); }
        }
        return outputPath;
      }
      default:
        throw new Error(`TTS backend "${options.backend}" not supported.`);
    }
  }

  private async executeStt(
    audioPath: string,
    options: { backend: string; language: string },
  ): Promise<string> {
    const { execFileSync } = await import('child_process');

    switch (options.backend) {
      case 'whisper': {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY is not configured for Whisper.');
        const result = execFileSync('curl', [
          '-s', '-X', 'POST',
          'https://api.openai.com/v1/audio/transcriptions',
          '-H', `Authorization: Bearer ${apiKey}`,
          '-F', `file=@${audioPath}`,
          '-F', 'model=whisper-1',
          '-F', `language=${options.language.split('-')[0]}`,
        ], { timeout: 60000 }).toString();
        try {
          const parsed = JSON.parse(result);
          return parsed.text || result;
        } catch (error: unknown) {logger.warn('[Zavorth Voice Mode] JSON parse failed', error); return result; }
      }
      case 'deepgram': {
        const apiKey = process.env.DEEPGRAM_API_KEY;
        if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured.');
        const result = execFileSync('curl', [
          '-s', '-X', 'POST',
          `https://api.deepgram.com/v1/listen...language=${options.language}`,
          '-H', `Authorization: Token ${apiKey}`,
          '-H', 'Content-Type: audio/wav',
          '--data-binary', `@${audioPath}`,
        ], { timeout: 60000 }).toString();
        try {
          const parsed = JSON.parse(result);
          return parsed.results?.channels?.[0]?.alternatives?.[0]?.transcript || result;
        } catch (error: unknown) {logger.warn('[Zavorth Voice Mode] JSON parse failed', error); return result; }
      }
      case 'gemini': {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
        const audioBase64 = fs.readFileSync(audioPath).toString('base64');
        const maxBase64 = MAX_GEMINI_AUDIO_BASE64_BYTES;
        const truncated = audioBase64.length > maxBase64;
        const audioData = truncated ? audioBase64.slice(0, maxBase64) : audioBase64;
        if (truncated) {
          logger.warn(`[VoiceMode] Audio truncated from ${audioBase64.length} to ${maxBase64} base64 characters.`);
        }
        const payload = JSON.stringify({
          contents: [{ parts: [
            { text: `Transcribe this audio precisely. Language hint: ${options.language}` },
            { inline_data: { mime_type: 'audio/wav', data: audioData } },
          ] }],
        });
        const tmpPayload = path.join(os.tmpdir(), `gemini_stt_${Date.now()}.json`);
        fs.writeFileSync(tmpPayload, payload);
        try {
          const result = execFileSync('curl', [
            '-s', '-X', 'POST',
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent...key=${apiKey}`,
            '-H', 'Content-Type: application/json',
            '-d', `@${tmpPayload}`,
          ], { timeout: 60000 }).toString();
          try {
            const parsed = JSON.parse(result);
            return parsed.candidates?.[0]?.content?.parts?.[0]?.text || result;
          } catch (error: unknown) {logger.warn('[Zavorth Voice Mode] JSON parse failed', error); return result; }
        } finally {
          try { fs.unlinkSync(tmpPayload); } catch (error: unknown) {/* ignore */ logger.warn('[Zavorth Voice Mode] JSON parse failed', error); }
        }
      }
      default:
        throw new Error(`STT backend "${options.backend}" not supported.`);
    }
  }
}
