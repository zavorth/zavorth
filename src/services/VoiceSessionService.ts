import type {
  VoiceSessionRequest,
  VoiceSessionResult,
} from '../contracts/VoiceSessionContract.js';
import { VOICE_SESSION_CONTRACT_VERSION } from '../contracts/VoiceSessionContract.js';
import type { SpeechArtifactRef, SpeechProviderEvidence } from '../contracts/SpeechContract.js';
import { SpeechRuntimeService } from './SpeechRuntimeService.js';

type VoiceSessionServiceOptions = {
  now?: () => Date;
  speechRuntime?: SpeechRuntimeService;
};

export class VoiceSessionService {
  private readonly now: () => Date;
  private readonly speechRuntime: SpeechRuntimeService;

  constructor(options: VoiceSessionServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.speechRuntime = options.speechRuntime || new SpeechRuntimeService({ now: this.now });
  }

  public planSession(request: VoiceSessionRequest): VoiceSessionResult {
    const processedAt = this.now().toISOString();
    const voiceSessionId = `voice.session.${this.normalizeId(request.sessionId || request.goal || request.mode)}`;
    const consentRequired = request.mode !== 'push_to_talk';

    return {
      ok: true,
      contractVersion: VOICE_SESSION_CONTRACT_VERSION,
      voiceSessionId,
      status: consentRequired ? 'waiting_consent' : 'planned',
      consent: {
        required: consentRequired,
        granted: false,
        grantedBy: null,
        grantedAt: null,
        reason: consentRequired
          ? 'Live call and meeting bridge sessions require explicit operator consent.'
          : 'Push-to-talk can be planned without opening a live call.',
      },
      turns: [],
      transcriptArtifactId: `voice.transcript.${this.normalizeId(voiceSessionId)}`,
      providerEvidence: [
        {
          providerId: 'voice-session-dry-run',
          modelId: null,
          metadata: {
            dryRun: true,
            mode: request.mode,
            participants: request.participants.length,
            secretValuesSerialized: false,
          },
        },
      ],
      receiptId: `${voiceSessionId}.receipt`,
      processedAt,
      error: null,
    };
  }

  public async runPushToTalk(request: VoiceSessionRequest, input: {
    source: SpeechArtifactRef;
    replyText?: string | null;
    consentGrantedBy?: string | null;
  }): Promise<VoiceSessionResult> {
    const processedAt = this.now().toISOString();
    const voiceSessionId = `voice.session.${this.normalizeId(request.sessionId || request.goal || 'push-to-talk')}`;
    if (request.mode !== 'push_to_talk') {
      return this.failed(
        voiceSessionId,
        'Only push_to_talk can run without opening a live call bridge.',
        processedAt,
      );
    }

    const transcript = await this.speechRuntime.transcribeLive({
      source: input.source,
      speakerLabels: true,
      sessionId: voiceSessionId,
      correlationId: request.correlationId || null,
    });
    if (!transcript.ok) {
      return this.failed(voiceSessionId, transcript.error || 'Push-to-talk transcription failed.', processedAt);
    }

    const providerEvidence: SpeechProviderEvidence[] = [];
    if (transcript.providerEvidence) {
      providerEvidence.push(transcript.providerEvidence);
    }
    const audioArtifact = input.replyText
      ? await this.synthesizeReply(input.replyText, voiceSessionId, providerEvidence)
      : null;

    return {
      ok: true,
      contractVersion: VOICE_SESSION_CONTRACT_VERSION,
      voiceSessionId,
      status: 'completed',
      consent: {
        required: false,
        granted: true,
        grantedBy: input.consentGrantedBy || 'operator',
        grantedAt: processedAt,
        reason: 'Push-to-talk uses an operator-provided audio artifact and does not open a continuous live call.',
      },
      turns: [
        {
          turnId: `${voiceSessionId}.turn.1`,
          speakerId: 'speaker-1',
          transcript: transcript.text,
          audioArtifact,
          startedAt: processedAt,
          endedAt: this.now().toISOString(),
        },
      ],
      transcriptArtifactId: transcript.transcriptArtifactId,
      providerEvidence,
      receiptId: `${voiceSessionId}.receipt`,
      processedAt,
      error: null,
    };
  }

  private async synthesizeReply(
    replyText: string,
    voiceSessionId: string,
    providerEvidence: SpeechProviderEvidence[],
  ): Promise<SpeechArtifactRef | null> {
    const synthesized = await this.speechRuntime.synthesizeLive({
      text: replyText,
      format: 'wav',
      sessionId: voiceSessionId,
    });
    if (!synthesized.ok || !synthesized.audioArtifact) {
      return null;
    }
    if (synthesized.providerEvidence) {
      providerEvidence.push(synthesized.providerEvidence);
    }
    return synthesized.audioArtifact;
  }

  private failed(voiceSessionId: string, message: string, processedAt: string): VoiceSessionResult {
    return {
      ok: false,
      contractVersion: VOICE_SESSION_CONTRACT_VERSION,
      voiceSessionId,
      status: 'failed',
      consent: {
        required: true,
        granted: false,
        grantedBy: null,
        grantedAt: null,
        reason: message,
      },
      turns: [],
      transcriptArtifactId: null,
      providerEvidence: [],
      receiptId: `${voiceSessionId}.failed.receipt`,
      processedAt,
      error: message,
    };
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'planned';
  }
}
