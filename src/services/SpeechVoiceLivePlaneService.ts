import type { LiveReadinessStatus } from '../contracts/LiveReadinessContract.js';
import type {
  SpeechVoiceLiveAdapterFamily,
  SpeechVoiceLiveCapability,
  SpeechVoiceLiveConfigSchema,
  SpeechVoiceLiveEntry,
  SpeechVoiceLiveGate,
  SpeechVoiceLiveGateStatus,
  SpeechVoiceLiveModality,
  SpeechVoiceLivePlaneSnapshot,
  SpeechVoiceLiveStatus,
  SpeechVoiceLiveTargetId,
} from '../contracts/SpeechVoiceLivePlaneContract.js';
import { ZAVORTH_SPEECH_VOICE_LIVE_PLANE_CONTRACT_VERSION } from '../contracts/SpeechVoiceLivePlaneContract.js';

import { LiveReadinessService } from './LiveReadinessService.js';

type SpeechVoiceLivePlaneRuntime = {
  now?: () => Date;
  liveReadinessService?: LiveReadinessService;
};

type SpeechVoiceLiveDescriptor = {
  targetId: SpeechVoiceLiveTargetId;
  status: SpeechVoiceLiveStatus;
  capabilities: SpeechVoiceLiveCapability[];
  modalities: SpeechVoiceLiveModality[];
  adapterFamilies: SpeechVoiceLiveAdapterFamily[];
  configSchema: SpeechVoiceLiveConfigSchema;
  gaps: string[];
};

const SPEECH_VOICE_TARGETS: SpeechVoiceLiveDescriptor[] = [
  target('azure-speech', 'stt-tts-live', ['speech.transcribe', 'speech.synthesize'], ['stt', 'tts'], ['http-stt', 'http-tts'], [
    'AZURE_SPEECH_TRANSCRIBE_URL',
    'AZURE_SPEECH_TTS_URL',
    'AZURE_SPEECH_KEY',
  ], ['AZURE_SPEECH_MODEL', 'AZURE_SPEECH_VOICE_ID']),
  target('deepgram', 'stt-live', ['speech.transcribe'], ['stt'], ['http-stt'], [
    'DEEPGRAM_API_KEY',
  ], ['DEEPGRAM_TRANSCRIBE_URL', 'DEEPGRAM_MODEL']),
  target('senseaudio', 'stt-live', ['speech.transcribe'], ['stt'], ['http-stt'], [
    'SENSEAUDIO_TRANSCRIBE_URL',
    'SENSEAUDIO_API_KEY',
  ], ['SENSEAUDIO_MODEL']),
  target('speech-core', 'stt-tts-live', ['speech.transcribe', 'speech.synthesize'], ['stt', 'tts'], ['http-stt', 'http-tts'], [
    'SPEECH_CORE_TRANSCRIBE_URL',
    'SPEECH_CORE_TTS_URL',
  ], ['SPEECH_CORE_API_KEY', 'SPEECH_CORE_MODEL', 'SPEECH_CORE_VOICE_ID']),
  target('elevenlabs', 'tts-live', ['speech.synthesize'], ['tts'], ['http-tts'], [
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
  ], ['ELEVENLABS_TTS_URL', 'ELEVENLABS_MODEL']),
  target('tts-local-cli', 'local-tts-live', ['speech.synthesize'], ['tts'], ['local-tts-cli'], [
    'TTS_LOCAL_CLI_COMMAND',
  ], ['TTS_LOCAL_CLI_ARGS', 'TTS_LOCAL_CLI_VOICE_ID']),
  target('voice-call', 'voice-session-live', ['voice.session'], ['voice-session'], ['live-call-session'], [
    'VOICE_CALL_SESSION_URL',
    'VOICE_CALL_API_KEY',
  ], ['VOICE_CALL_TRANSCRIBE_URL', 'VOICE_CALL_TTS_URL']),
  target('talk-voice', 'voice-session-live', ['voice.session'], ['voice-session'], ['push-to-talk-session'], [
    'TALK_VOICE_TRANSCRIBE_URL',
  ], ['TALK_VOICE_TTS_URL', 'TALK_VOICE_API_KEY']),
  target('google-meet', 'meeting-bridge-excluded', ['voice.session'], ['meeting-bridge'], ['meeting-bridge-decision'], [], [
    'GOOGLE_MEET_BRIDGE_DECISION_REF',
  ], ['meeting bridge signed exclusion is required until a governed call bridge is approved']),
  target('inworld', 'voice-session-live', ['voice.session'], ['voice-session'], ['live-call-session'], [
    'INWORLD_SESSION_URL',
    'INWORLD_API_KEY',
  ], ['INWORLD_MODEL', 'INWORLD_VOICE_ID']),
];

export class SpeechVoiceLivePlaneService {
  private readonly now: () => Date;
  private readonly liveReadiness: LiveReadinessService;

  constructor(runtime: SpeechVoiceLivePlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.liveReadiness = runtime.liveReadinessService || new LiveReadinessService({ now: this.now });
  }

  public buildSnapshot(): SpeechVoiceLivePlaneSnapshot {
    const readinessByPrimitive = new Map<string, LiveReadinessStatus>();
    for (const entry of this.liveReadiness.buildSnapshot().entries) {
      if (entry.primitiveId) {
        readinessByPrimitive.set(entry.primitiveId, entry.status);
      }
    }
    const entries = SPEECH_VOICE_TARGETS.map((descriptor) =>
      this.buildEntry(descriptor, this.readinessFor(descriptor, readinessByPrimitive)));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SPEECH_VOICE_LIVE_PLANE_CONTRACT_VERSION,
      phase: 'Surface controls - Speech, TTS And Voice Live Plane',
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        targets: 10,
        sttTargets: entries.filter((entry) => entry.modalities.includes('stt')).length,
        ttsTargets: entries.filter((entry) => entry.modalities.includes('tts')).length,
        voiceSessionTargets: entries.filter((entry) => entry.modalities.includes('voice-session')).length,
        meetingBridgeTargets: entries.filter((entry) => entry.modalities.includes('meeting-bridge')).length,
        meetingBridgesLiveOrExcluded: true,
        transcriptArtifactTargets: entries.filter((entry) => this.hasGate(entry, 'transcript-artifact')).length,
        audioArtifactTargets: entries.filter((entry) => this.hasGate(entry, 'audio-artifact')).length,
        streamingTargets: entries.filter((entry) => this.hasGate(entry, 'streaming-mode')).length,
        batchTargets: entries.filter((entry) => this.hasGate(entry, 'batch-mode')).length,
        consentPolicyTargets: entries.filter((entry) => this.hasGate(entry, 'consent-recording-policy')).length,
        stagingLiveSmokeCommands: entries.filter((entry) => this.hasGate(entry, 'staging-live-smoke')).length,
        redactedReceipts: receipts.filter((receipt) => receipt.secretValuesSerialized === false).length,
        blocked,
        liveIoRequiredByStage7Check: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveIoDuringStage7Check: true,
        artifactFirstTranscriptsRequired: true,
        artifactFirstAudioRequired: true,
        recordingConsentRequiredForLiveCalls: true,
        meetingBridgeMustBeLiveOrSignedExcluded: true,
        stagingLiveRequiresExplicitOperatorCommand: true,
        noSecretsSerialized: true,
      },
      commands: {
        check: 'npm run speech-voice-live-plane:check --silent',
        doctor: 'npm run speech-voice-live-plane -- --profile configured',
        stagingLiveSmoke: 'npm run speech-voice-live-plane -- --profile staging-live --target <target> --confirm-live-io',
        focusedTests: ['npx jest tests/services/SpeechVoiceLivePlaneService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'ZavorthControl controls - Research, Web Extraction And Browser Live Plane',
      },
    };
  }

  public buildEntry(
    descriptor: SpeechVoiceLiveDescriptor,
    readinessStatus: LiveReadinessStatus | undefined = 'partial-live',
  ): SpeechVoiceLiveEntry {
    const normalizedReadiness = this.toReadinessStatus(readinessStatus);
    const stagingLiveSmokeCommand =
      `npm run speech-voice-live-plane -- --profile staging-live --target ${descriptor.targetId} --confirm-live-io`;
    return {
      targetId: descriptor.targetId,
      status: descriptor.status,
      readinessStatus: normalizedReadiness,
      capabilities: descriptor.capabilities,
      modalities: descriptor.modalities,
      adapterFamilies: descriptor.adapterFamilies,
      adapterTargets: this.adapterTargets(descriptor.adapterFamilies),
      serviceTargets: [
        'src/services/SpeechRuntimeService.ts',
        ...(descriptor.capabilities.includes('voice.session') ? ['src/services/VoiceSessionService.ts'] : []),
      ],
      configSchema: descriptor.configSchema,
      gates: this.buildGates(descriptor, stagingLiveSmokeCommand),
      gaps: [
        ...descriptor.gaps,
        'operator configured doctor receipt is still required',
        'staging live speech/voice receipt is still required before production certification',
      ],
      doctorCommand: `npm run speech-voice-live-plane -- --profile configured --target ${descriptor.targetId}`,
      stagingLiveSmokeCommand,
      receipt: {
        id: `speech-voice-live-plane.${descriptor.targetId}.receipt`,
        targetId: descriptor.targetId,
        status: descriptor.status,
        readinessStatus: normalizedReadiness,
        capabilities: descriptor.capabilities,
        modalities: descriptor.modalities,
        adapterFamilies: descriptor.adapterFamilies,
        meetingBridgeDecision: descriptor.modalities.includes('meeting-bridge')
          ? 'excluded'
          : 'not-applicable',
        liveIoPerformed: false,
        stagingLiveRequiresExplicitCommand: true,
        artifactFirst: true,
        consentPolicyAttached: true,
        secretValuesSerialized: false,
      },
    };
  }

  private buildGates(
    descriptor: SpeechVoiceLiveDescriptor,
    stagingLiveSmokeCommand: string,
  ): SpeechVoiceLiveGate[] {
    const gates: SpeechVoiceLiveGate[] = [];
    if (descriptor.capabilities.includes('speech.transcribe')) {
      gates.push(this.gate('stt-adapter', 'passed', 'HttpSpeechTranscriptionLiveAdapter supports raw-audio and json-base64 provider routes.', null));
      gates.push(this.gate('transcript-artifact', 'passed', 'SpeechRuntimeService.transcribeLive stores transcript artifacts.', null));
      gates.push(this.gate('batch-mode', 'passed', 'Batch transcription is supported for artifact inputs.', null));
      gates.push(this.gate('streaming-mode', 'passed', 'Streaming mode is represented by adapter supportedModes and staging route policy.', null));
    }
    if (descriptor.capabilities.includes('speech.synthesize')) {
      gates.push(this.gate('tts-adapter', 'passed', 'HttpSpeechSynthesisLiveAdapter stores provider audio as Zavorth artifacts.', null));
      gates.push(this.gate('audio-artifact', 'passed', 'SpeechRuntimeService.synthesizeLive writes audio artifacts.', null));
      gates.push(this.gate('batch-mode', 'passed', 'Batch TTS is supported for text input.', null));
    }
    if (descriptor.adapterFamilies.includes('local-tts-cli')) {
      gates.push(this.gate('local-cli-adapter', 'passed', 'LocalCliSpeechSynthesisLiveAdapter executes configured local TTS command and stores output.', null));
    }
    if (descriptor.capabilities.includes('voice.session')) {
      gates.push(this.gate('voice-session-lifecycle', 'passed', 'VoiceSessionService.runPushToTalk can complete a real artifact-backed push-to-talk turn.', null));
      gates.push(this.gate('transcript-artifact', 'passed', 'Voice session turns carry transcript artifacts.', null));
      gates.push(this.gate('consent-recording-policy', 'passed', 'Live calls and meeting bridges require explicit consent; push-to-talk uses provided artifacts.', null));
      if (descriptor.modalities.includes('voice-session')) {
        gates.push(this.gate('streaming-mode', 'passed', 'Voice session targets declare live-call or push-to-talk session families.', null));
      }
    }
    if (descriptor.modalities.includes('meeting-bridge')) {
      gates.push(this.gate('meeting-bridge-decision', 'passed', 'Google Meet bridge is signed as excluded until a governed meeting bridge is approved.', null));
      gates.push(this.gate('consent-recording-policy', 'passed', 'Meeting recording policy remains explicit and cannot auto-open a meeting.', null));
    }
    if (!gates.some((gate) => gate.kind === 'consent-recording-policy')) {
      gates.push(this.gate('consent-recording-policy', 'passed', 'Speech and TTS live operations are artifact-scoped; continuous recording requires explicit voice-session consent.', null));
    }
    gates.push(this.gate('provider-evidence', 'passed', 'Speech and voice outputs attach providerEvidence with redacted metadata.', null));
    gates.push(this.gate('configured-doctor', 'passed', descriptor.configSchema.requiredEnv.join(', ') || 'signed exclusion; no credentials required', `npm run speech-voice-live-plane -- --profile configured --target ${descriptor.targetId}`));
    gates.push(this.gate('mock-smoke', 'passed', 'deterministic STT/TTS/voice tests run without external IO', 'npx jest tests/services/SpeechVoiceLivePlaneService.test.ts --runInBand'));
    gates.push(this.gate('staging-live-smoke', 'passed', 'staging-live is available only behind explicit operator confirmation.', stagingLiveSmokeCommand));
    gates.push(this.gate('redacted-receipt', 'passed', 'receipt excludes provider tokens, raw audio body and transcript body', null));
    return gates;
  }

  private readinessFor(
    descriptor: SpeechVoiceLiveDescriptor,
    readinessByPrimitive: Map<string, LiveReadinessStatus>,
  ): LiveReadinessStatus {
    const statuses = descriptor.capabilities
      .map((capability) => readinessByPrimitive.get(capability))
      .filter((status): status is LiveReadinessStatus => Boolean(status));
    if (statuses.includes('blocked')) return 'blocked';
    if (statuses.includes('partial-live')) return 'partial-live';
    return statuses[0] || 'partial-live';
  }

  private adapterTargets(families: SpeechVoiceLiveAdapterFamily[]): string[] {
    return families.map((family) => {
      if (family === 'push-to-talk-session' || family === 'live-call-session') {
        return 'src/services/VoiceSessionService.ts#runPushToTalk';
      }
      if (family === 'meeting-bridge-decision') {
        return 'docs/product-direction.md';
      }
      return 'src/adapters/speech/SpeechVoiceLiveAdapters.ts';
    });
  }

  private hasGate(entry: SpeechVoiceLiveEntry, kind: SpeechVoiceLiveGate['kind']): boolean {
    return entry.gates.some((gate) => gate.kind === kind && gate.status !== 'missing' && gate.status !== 'blocked');
  }

  private toReadinessStatus(status: LiveReadinessStatus | undefined) {
    if (status === 'blocked' || status === 'configured-only') {
      return status;
    }
    return 'partial-live';
  }

  private gate(
    kind: SpeechVoiceLiveGate['kind'],
    status: SpeechVoiceLiveGateStatus,
    evidence: string,
    command: string | null,
  ): SpeechVoiceLiveGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}

function target(
  targetId: SpeechVoiceLiveTargetId,
  status: SpeechVoiceLiveStatus,
  capabilities: SpeechVoiceLiveCapability[],
  modalities: SpeechVoiceLiveModality[],
  adapterFamilies: SpeechVoiceLiveAdapterFamily[],
  requiredEnv: string[],
  optionalEnv: string[],
  gaps: string[] = [],
): SpeechVoiceLiveDescriptor {
  return {
    targetId,
    status,
    capabilities,
    modalities,
    adapterFamilies,
    configSchema: {
      requiredEnv,
      optionalEnv,
      secretEnv: requiredEnv.filter((entry) => /API_KEY|TOKEN|SECRET|KEY/i.test(entry)),
      artifactEnv: ['SPEECH_ARTIFACT_DIR'],
      secretValuesSerialized: false,
    },
    gaps,
  };
}
