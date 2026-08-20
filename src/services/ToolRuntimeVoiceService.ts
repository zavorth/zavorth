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

export type ToolRuntimeVoiceResult = EchoVoiceResult;
export type ToolRuntimeVoiceServiceOptions = EchoVoiceServiceOptions;

export class ToolRuntimeVoiceService {
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
        responseText: 'No structured Echo action was provided for this voice turn.',
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
    if (!text.startsWith('{')) {
      return null;
    }

    try {
      const parsed = JSON.parse(text) as Partial<EchoHandsRequest>;
      if (parsed && typeof parsed.action === 'string') {
        return {
          action: parsed.action as EchoHandsRequest['action'],
          args: parsed.args && typeof parsed.args === 'object' ? parsed.args as Record<string, unknown> : {},
          risk: parsed.risk || 'low',
        };
      }
    } catch {
      return null;
    }

    return null;
  }
}

export const EchoVoiceService = ToolRuntimeVoiceService;

