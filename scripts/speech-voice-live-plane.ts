import os from 'node:os';
import path from 'node:path';
import {
  HttpSpeechSynthesisLiveAdapter,
  HttpSpeechTranscriptionLiveAdapter,
  LocalCliSpeechSynthesisLiveAdapter,
} from '../src/adapters/speech/SpeechVoiceLiveAdapters.js';
import type { SpeechVoiceLiveEntry } from '../src/contracts/SpeechVoiceLivePlaneContract.js';
import type { SpeechArtifactRef } from '../src/contracts/SpeechContract.js';
import { SpeechRuntimeService } from '../src/services/SpeechRuntimeService.js';
import { SpeechVoiceLivePlaneService } from '../src/services/SpeechVoiceLivePlaneService.js';
import { VoiceSessionService } from '../src/services/VoiceSessionService.js';
import { ZavorthProviderLiveProofStoreService } from '../src/services/ZavorthProviderLiveProofStoreService.js';

type Profile = 'configured' | 'staging-live';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const target = readArg('--target');
const profile = (readArg('--profile') || 'configured') as Profile;
const operation = readArg('--operation');
const confirmLiveIo = args.includes('--confirm-live-io');
const text = readArg('--text') || 'Zavorth speech live smoke.';
const audioArtifactPath = readArg('--audio-artifact') || readEnv('SPEECH_SMOKE_AUDIO_ARTIFACT');
const snapshot = new SpeechVoiceLivePlaneService().buildSnapshot();
const selected = target
  ? snapshot.entries.filter((entry) => entry.targetId === target)
  : snapshot.entries;

if (selected.length === 0) {
  console.error(`[speech-voice-live-plane] unknown target: ${target}`);
  process.exit(1);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main(): Promise<void> {
  const liveReceiptByTarget = new Map<string, unknown>();
  if (profile === 'staging-live' && confirmLiveIo) {
    for (const entry of selected) {
      const receipt = await runLiveSmoke(entry);
      liveReceiptByTarget.set(entry.targetId, receipt);
      writeSpeechProviderLiveProof(entry, receipt);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    profile,
    liveIoPerformed: [...liveReceiptByTarget.values()].some(receiptHasLiveIo),
    confirmLiveIo,
    status: profile === 'staging-live' && !confirmLiveIo ? 'blocked-until-confirmed' : 'ready-for-operator',
    reason: profile === 'staging-live' && !confirmLiveIo ? 'staging-live speech/voice requires --confirm-live-io and real operator credentials/artifacts.'
      : 'Surface controls exposes STT, TTS, local TTS and push-to-talk live paths with redacted receipts.',
    entries: selected.map((entry) => ({
      targetId: entry.targetId,
      status: entry.status,
      capabilities: entry.capabilities,
      modalities: entry.modalities,
      adapterFamilies: entry.adapterFamilies,
      doctorCommand: entry.doctorCommand,
      stagingLiveSmokeCommand: entry.stagingLiveSmokeCommand,
      requiredEnv: entry.configSchema.requiredEnv,
      optionalEnv: entry.configSchema.optionalEnv,
      gaps: entry.gaps,
      receipt: entry.receipt,
      liveReceipt: liveReceiptByTarget.get(entry.targetId) || null,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`[speech-voice-live-plane] profile=${profile} liveIoPerformed=${output.liveIoPerformed}`);
    console.log(`[speech-voice-live-plane] ${output.status}: ${output.reason}`);
    for (const entry of output.entries) {
      console.log(`[speech-voice-live-plane] ${entry.targetId} ${entry.status} capabilities=${entry.capabilities.join(',')}`);
      console.log(`  doctor: ${entry.doctorCommand}`);
      console.log(`  staging: ${entry.stagingLiveSmokeCommand}`);
      console.log(`  required env: ${entry.requiredEnv.join(', ') || 'none'}`);
    }
  }
}

async function runLiveSmoke(entry: SpeechVoiceLiveEntry): Promise<unknown> {
  if (entry.status === 'meeting-bridge-excluded') {
    return {
      targetId: entry.targetId,
      ok: true,
      meetingBridgeDecision: 'excluded',
      reason: 'Meeting bridge is signed as excluded until an operator approves a governed meeting bridge.',
      liveIoPerformed: false,
      secretValuesSerialized: false,
    };
  }

  const speechRuntime = buildSpeechRuntime(entry);
  if (entry.capabilities.includes('voice.session')) {
    const source = requireAudioArtifact(entry);
    const voice = new VoiceSessionService({ speechRuntime });
    const result = await voice.runPushToTalk({
      mode: 'push_to_talk',
      participants: ['operator'],
      goal: `${entry.targetId} staging push-to-talk smoke`,
    }, {
      source,
      replyText: text,
      consentGrantedBy: 'operator',
    });
    return {
      targetId: entry.targetId,
      operation: 'voice.session',
      ok: result.ok,
      status: result.status,
      turns: result.turns.length,
      transcriptArtifactId: result.transcriptArtifactId,
      providerIds: result.providerEvidence.map((evidence) => evidence.providerId),
      error: result.error || null,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }

  if ((operation === 'transcribe' || !operation) && entry.capabilities.includes('speech.transcribe')) {
    const result = await speechRuntime.transcribeLive({
      source: requireAudioArtifact(entry),
      speakerLabels: true,
    });
    return {
      targetId: entry.targetId,
      operation: 'speech.transcribe',
      ok: result.ok,
      transcriptArtifactId: result.transcriptArtifactId,
      textLength: result.text.length,
      providerId: result.providerEvidence?.providerId || null,
      error: result.error || null,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }

  if (entry.capabilities.includes('speech.synthesize')) {
    const result = await speechRuntime.synthesizeLive({
      text,
      format: readFormat(),
    });
    return {
      targetId: entry.targetId,
      operation: 'speech.synthesize',
      ok: result.ok,
      audioArtifact: result.audioArtifact,
      providerId: result.providerEvidence?.providerId || null,
      error: result.error || null,
      liveIoPerformed: true,
      secretValuesSerialized: false,
    };
  }

  throw new Error(`[speech-voice-live-plane] ${entry.targetId} has no executable staging operation.`);
}

function buildSpeechRuntime(entry: SpeechVoiceLiveEntry): SpeechRuntimeService {
  return new SpeechRuntimeService({
    artifactDir: readEnv('SPEECH_ARTIFACT_DIR') || path.join(os.tmpdir(), 'zavorth-speech-live-smoke'),
    transcribeAdapter: entry.capabilities.includes('speech.transcribe') || entry.capabilities.includes('voice.session')
      ? buildTranscribeAdapter(entry)
      : null,
    synthesizeAdapter: entry.capabilities.includes('speech.synthesize') || entry.capabilities.includes('voice.session')
      ? buildSynthesisAdapter(entry)
      : null,
  });
}

function buildTranscribeAdapter(entry: SpeechVoiceLiveEntry): HttpSpeechTranscriptionLiveAdapter {
  if (entry.targetId === 'deepgram') {
    return new HttpSpeechTranscriptionLiveAdapter({
      adapterId: entry.targetId,
      providerId: entry.targetId,
      transcribeUrl: readEnv('DEEPGRAM_TRANSCRIBE_URL') || 'https://api.deepgram.com/v1/listen',
      apiKey: requireEnv(entry.targetId, 'DEEPGRAM_API_KEY'),
      modelId: readEnv('DEEPGRAM_MODEL'),
      authScheme: 'Token',
      requestStyle: 'raw-audio',
    });
  }
  if (entry.targetId === 'azure-speech') {
    return new HttpSpeechTranscriptionLiveAdapter({
      adapterId: entry.targetId,
      providerId: entry.targetId,
      transcribeUrl: requireEnv(entry.targetId, 'AZURE_SPEECH_TRANSCRIBE_URL'),
      apiKey: requireEnv(entry.targetId, 'AZURE_SPEECH_KEY'),
      modelId: readEnv('AZURE_SPEECH_MODEL'),
      authHeaderName: 'Ocp-Apim-Subscription-Key',
      authScheme: null,
      requestStyle: 'raw-audio',
    });
  }
  const prefix = envPrefix(entry.targetId);
  return new HttpSpeechTranscriptionLiveAdapter({
    adapterId: entry.targetId,
    providerId: entry.targetId,
    transcribeUrl: requireEnv(entry.targetId, `${prefix}_TRANSCRIBE_URL`, `${prefix}_SESSION_URL`),
    apiKey: readEnv(`${prefix}_API_KEY`),
    modelId: readEnv(`${prefix}_MODEL`),
    requestStyle: 'json-base64',
  });
}

function buildSynthesisAdapter(entry: SpeechVoiceLiveEntry) {
  if (entry.targetId === 'tts-local-cli') {
    return new LocalCliSpeechSynthesisLiveAdapter({
      adapterId: entry.targetId,
      providerId: entry.targetId,
      command: requireEnv(entry.targetId, 'TTS_LOCAL_CLI_COMMAND'),
      args: readArgList(readEnv('TTS_LOCAL_CLI_ARGS')),
      voiceId: readEnv('TTS_LOCAL_CLI_VOICE_ID'),
    });
  }
  if (entry.targetId === 'elevenlabs') {
    const voiceId = requireEnv(entry.targetId, 'ELEVENLABS_VOICE_ID');
    return new HttpSpeechSynthesisLiveAdapter({
      adapterId: entry.targetId,
      providerId: entry.targetId,
      synthesizeUrl: readEnv('ELEVENLABS_TTS_URL') || `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      apiKey: requireEnv(entry.targetId, 'ELEVENLABS_API_KEY'),
      modelId: readEnv('ELEVENLABS_MODEL') || 'eleven_multilingual_v2',
      voiceId,
      requestStyle: 'elevenlabs',
      authHeaderName: 'xi-api-key',
      authScheme: null,
      responseContentType: 'audio/mpeg',
    });
  }
  if (entry.targetId === 'azure-speech') {
    return new HttpSpeechSynthesisLiveAdapter({
      adapterId: entry.targetId,
      providerId: entry.targetId,
      synthesizeUrl: requireEnv(entry.targetId, 'AZURE_SPEECH_TTS_URL'),
      apiKey: requireEnv(entry.targetId, 'AZURE_SPEECH_KEY'),
      modelId: readEnv('AZURE_SPEECH_MODEL'),
      voiceId: readEnv('AZURE_SPEECH_VOICE_ID'),
      authHeaderName: 'Ocp-Apim-Subscription-Key',
      authScheme: null,
      responseContentType: contentTypeForFormat(readFormat()),
    });
  }
  const prefix = envPrefix(entry.targetId);
  return new HttpSpeechSynthesisLiveAdapter({
    adapterId: entry.targetId,
    providerId: entry.targetId,
    synthesizeUrl: requireEnv(entry.targetId, `${prefix}_TTS_URL`, 'SPEECH_CORE_TTS_URL'),
    apiKey: readEnv(`${prefix}_API_KEY`, 'SPEECH_CORE_API_KEY'),
    modelId: readEnv(`${prefix}_MODEL`, 'SPEECH_CORE_MODEL'),
    voiceId: readEnv(`${prefix}_VOICE_ID`, 'SPEECH_CORE_VOICE_ID'),
    requestStyle: 'json-text',
    responseContentType: contentTypeForFormat(readFormat()),
  });
}

function requireAudioArtifact(entry: SpeechVoiceLiveEntry): SpeechArtifactRef {
  const storageRef = String(audioArtifactPath || '').trim();
  if (!storageRef) {
    throw new Error(`[speech-voice-live-plane] ${entry.targetId} requires --audio-artifact <path> or SPEECH_SMOKE_AUDIO_ARTIFACT for staging-live.`);
  }
  return {
    artifactId: path.basename(storageRef).replace(/[^a-zA-Z0-9_.:-]+/g, '-') || `${entry.targetId}.audio`,
    contentType: readEnv('SPEECH_SMOKE_AUDIO_CONTENT_TYPE') || inferAudioContentType(storageRef),
    storageRef: path.resolve(storageRef),
  };
}

function readFormat(): 'wav' | 'mp3' | 'ogg' {
  const format = String(readArg('--format') || readEnv('SPEECH_SMOKE_AUDIO_FORMAT') || 'wav').trim().toLowerCase();
  return format === 'mp3' || format === 'ogg' ? format : 'wav';
}

function readArg(name: string): string | null {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) {
    return direct.slice(name.length + 1);
  }
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return null;
}

function requireEnv(targetId: string, ...names: string[]): string {
  const value = readEnv(...names);
  if (value) return value;
  throw new Error(`[speech-voice-live-plane] ${targetId} requires one of: ${names.join(', ')}`);
}

function readEnv(...names: Array<string | null | undefined>): string | null {
  for (const name of names) {
    const normalized = String(name || '').trim();
    if (!normalized) continue;
    const value = String(process.env[normalized] || '').trim();
    if (value) return value;
  }
  return null;
}

function readArgList(rawValue: string | null): string[] {
  return String(rawValue || '')
    .split(/\s+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function envPrefix(targetId: string): string {
  return targetId.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function inferAudioContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.ogg') return 'audio/ogg';
  return 'audio/wav';
}

function contentTypeForFormat(format: 'wav' | 'mp3' | 'ogg'): string {
  if (format === 'mp3') return 'audio/mpeg';
  if (format === 'ogg') return 'audio/ogg';
  return 'audio/wav';
}

function receiptHasLiveIo(receipt: unknown): boolean {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && (receipt as { liveIoPerformed?: unknown }).liveIoPerformed === true,
  );
}

function writeSpeechProviderLiveProof(entry: SpeechVoiceLiveEntry, receipt: unknown): void {
  const result = receipt as {
    ok?: unknown;
    operation?: unknown;
    targetId?: unknown;
    liveIoPerformed?: unknown;
    secretValuesSerialized?: unknown;
  } | null;
  if (!result || result.ok !== true || result.liveIoPerformed !== true || result.secretValuesSerialized !== false) {
    return;
  }
  new ZavorthProviderLiveProofStoreService().writeManualProof({
    providerId: entry.targetId,
    keys: [entry.targetId, ...entry.modalities, ...entry.capabilities],
    status: 'healthy',
    message: `Speech live smoke passed for ${String(result.operation || entry.capabilities[0] || 'speech')}.`,
    target: entry.targetId,
    httpStatus: null,
    modelCount: null,
    source: 'speech-voice-live-smoke',
  });
}
