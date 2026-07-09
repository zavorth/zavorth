import { t } from './i18n.js';
import type {
  EchoAgentResult,
  EchoAgentSurfaceState,
} from './EchoClientService.js';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

export type AgentVoiceFlowStatus =
  | 'completed'
  | 'busy'
  | 'empty-transcript'
  | 'failed';

export type AgentVoiceFlowResult = {
  status: AgentVoiceFlowStatus;
  transcript: string | null;
  echoResult: EchoAgentResult | null;
  surfaceState: EchoAgentSurfaceState | null;
  error: string | null;
};

export type AgentVoiceFlowModePatch = {
  mode: 'listening' | 'processing' | 'idle' | 'offline';
};

export interface AgentVoiceRecorderLike {
  record(): Promise<string>;
  cleanup(filePath: string): void;
}

export interface AgentWhisperLike {
  transcribe(audioPath: string): Promise<string>;
}

export interface AgentEchoClientLike {
  processIntent(prompt: string, category?: string): Promise<EchoAgentResult>;
  readSurfaceState(limit?: number): Promise<EchoAgentSurfaceState>;
}

export interface AgentOverlayLike {
  showListening(activationMode: string): Promise<void>;
  showProcessing(transcript: string): Promise<void>;
  showResult(response: string, success: boolean, durationMs?: number): Promise<void>;
  showEchoSurfaceState(state: EchoAgentSurfaceState): Promise<void>;
}

export interface AgentTtsLike {
  speak(text: string): Promise<string>;
  cleanup(filePath: string): void;
}

export interface AgentChimeLike {
  playStart(): void;
  playStop(): void;
  playError(): void;
}

export type AgentVoiceFlowOptions = {
  recorder: AgentVoiceRecorderLike;
  whisper: AgentWhisperLike;
  echoClient: AgentEchoClientLike;
  overlay: AgentOverlayLike;
  tts: AgentTtsLike;
  chime?: AgentChimeLike;
  isTtsAvailable: () => boolean;
  onModeChange?: (patch: AgentVoiceFlowModePatch) => void | Promise<void>;
  onProcessingChange?: (processing: boolean) => void | Promise<void>;
  onEchoResult?: (result: EchoAgentResult) => void | Promise<void>;
  onSurfaceState?: (state: EchoAgentSurfaceState) => void | Promise<void>;
  onSettled?: () => void | Promise<void>;
};

/**
 * Runs the local voice adapter flow without owning Echo routing, policy,
 * approvals, or lifecycle state. This gives the agent a deterministic smoke
 * target while keeping the real decisions behind /api/v2/echo/*.
 */
export class AgentVoiceFlowService {
  private processing = false;

  constructor(private readonly options: AgentVoiceFlowOptions) {}

  public get isProcessing(): boolean {
    return this.processing;
  }

  public async runActivation(mode: string): Promise<AgentVoiceFlowResult> {
    if (this.processing) {
      return {
        status: 'busy',
        transcript: null,
        echoResult: null,
        surfaceState: null,
        error: null,
      };
    }

    this.processing = true;
    await this.options.onProcessingChange?.(true);
    await this.options.onModeChange?.({ mode: 'listening' });
    this.options.chime?.playStart();

    let audioPath = '';
    try {
      await this.options.overlay.showListening(mode);
      audioPath = await this.options.recorder.record();
      this.options.chime?.playStop();

      await this.options.onModeChange?.({ mode: 'processing' });
      const transcript = normalizeTranscript(await this.options.whisper.transcribe(audioPath));
      if (transcript.length < 2) {
        return {
          status: 'empty-transcript',
          transcript,
          echoResult: null,
          surfaceState: null,
          error: null,
        };
      }

      await this.options.overlay.showProcessing(transcript);
      const echoResult = await this.options.echoClient.processIntent(transcript);
      await this.options.onEchoResult?.(echoResult);
      await this.options.overlay.showResult(
        echoResult.response,
        echoResult.success,
        echoResult.durationMs,
      );

      const surfaceState = await this.readSurfaceStateSafely();
      if (surfaceState) {
        await this.options.onSurfaceState?.(surfaceState);
        await this.options.overlay.showEchoSurfaceState(surfaceState);
      }

      if (this.options.isTtsAvailable() && echoResult.response) {
        await this.playTtsSafely(echoResult.response);
      }

      return {
        status: 'completed',
        transcript,
        echoResult,
        surfaceState,
        error: null,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      this.options.chime?.playError();
      const message = String(err.message || 'Unexpected error');
      await this.options.overlay.showResult(t('error_prefix', { message }), false);
      return {
        status: 'failed',
        transcript: null,
        echoResult: null,
        surfaceState: null,
        error: message,
      };
    } finally {
      if (audioPath) {
        this.options.recorder.cleanup(audioPath);
      }
      this.processing = false;
      await this.options.onProcessingChange?.(false);
      await this.options.onSettled?.();
    }
  }

  private async readSurfaceStateSafely(): Promise<EchoAgentSurfaceState | null> {
    try {
      return await this.options.echoClient.readSurfaceState(3);
    } catch {
      return null;
    }
  }

  private async playTtsSafely(text: string): Promise<void> {
    let ttsAudioPath = '';
    try {
      ttsAudioPath = await this.options.tts.speak(text);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.warn(`[AgentVoiceFlow] TTS unavailable: ${err.message || 'Unexpected error'}`);
      return;
    }

    this.options.tts.cleanup(ttsAudioPath);
  }
}

function normalizeTranscript(value: unknown): string {
  return String(value || '').trim();
}
