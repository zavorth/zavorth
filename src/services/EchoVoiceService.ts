import { LocalVoiceDictation } from '../voice/LocalVoiceDictation.js';
import {
  EchoHandsService,
  type EchoHandsRequest,
  type EchoHandsResult,
} from './EchoHandsService.js';

export type EchoVoiceResult = {
  transcript: string;
  request: EchoHandsRequest | null;
  result: EchoHandsResult | null;
  responseText: string;
};

type EchoVoiceServiceOptions = {
  dictation?: Pick<LocalVoiceDictation, 'transcribeBuffer'>;
  handsService?: Pick<EchoHandsService, 'execute'>;
};

export class EchoVoiceService {
  private readonly dictation: Pick<LocalVoiceDictation, 'transcribeBuffer'>;
  private readonly handsService: Pick<EchoHandsService, 'execute'>;

  constructor(options: EchoVoiceServiceOptions = {}) {
    this.dictation = options.dictation || new LocalVoiceDictation();
    this.handsService = options.handsService || new EchoHandsService();
  }

  public async handleAudioBuffer(audio: Buffer): Promise<EchoVoiceResult> {
    const transcript = await this.dictation.transcribeBuffer(audio);
    return this.handleTranscript(transcript);
  }

  public async handleTranscript(transcript: string): Promise<EchoVoiceResult> {
    const request = this.parseTranscript(transcript);
    if (!request) {
      return {
        transcript,
        request: null,
        result: null,
        responseText: 'Não encontrei uma ação Echo segura para esse comando de voz.',
      };
    }

    const result = await this.handsService.execute(request);
    return {
      transcript,
      request,
      result,
      responseText: result.message,
    };
  }

  private parseTranscript(transcript: string): EchoHandsRequest | null {
    const text = String(transcript || '').trim();
    const normalized = text.toLowerCase();

    if (/(bloco de notas|notepad)/i.test(normalized)) {
      return { action: 'open_app', args: { app: 'notepad' }, risk: 'low' };
    }

    if (/(calculadora|calculator)/i.test(normalized)) {
      return { action: 'open_app', args: { app: 'calculator' }, risk: 'low' };
    }

    if (normalized.includes('youtube')) {
      return {
        action: 'browser_search',
        args: { engine: 'youtube', query: this.extractQuery(text, 'youtube') },
        risk: 'low',
      };
    }

    if (normalized.includes('github')) {
      return {
        action: 'browser_search',
        args: { engine: 'github', query: this.extractQuery(text, 'github') },
        risk: 'low',
      };
    }

    if (/(pesquise|procure|google)/i.test(normalized)) {
      return {
        action: 'browser_search',
        args: { engine: 'google', query: this.extractQuery(text, 'google') },
        risk: 'low',
      };
    }

    return null;
  }

  private extractQuery(text: string, marker: string): string {
    const normalized = text.trim();
    const index = normalized.toLowerCase().indexOf(marker);
    const tail = index >= 0 ? normalized.slice(index + marker.length) : normalized;
    const query = tail
      .replace(/^(sobre|por|para|pesquise|procure|buscar|busque)\s+/i, '')
      .trim();
    return query || normalized;
  }
}
