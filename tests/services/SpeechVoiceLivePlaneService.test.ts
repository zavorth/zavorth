import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SpeechRuntimeService } from '../../src/services/SpeechRuntimeService.js';

import {
  HttpSpeechSynthesisLiveAdapter,
  HttpSpeechTranscriptionLiveAdapter,
  LocalCliSpeechSynthesisLiveAdapter,
} from '../../src/adapters/speech/SpeechVoiceLiveAdapters.js';

import { SpeechVoiceLivePlaneService } from '../../src/services/SpeechVoiceLivePlaneService.js';
import { VoiceSessionService } from '../../src/services/VoiceSessionService.js';

const jsonResponse = (payload: Record<string, unknown>, init: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const audioResponse = (payload: Buffer, contentType = 'audio/wav') =>
  new Response(new Uint8Array(payload), {
    status: 200,
    headers: {
      'Content-Type': contentType,
    },
  });

function createFakeChild() {
  const child = new EventEmitter() as any;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdout.setEncoding = jest.fn();
  child.stderr.setEncoding = jest.fn();
  child.kill = jest.fn(() => {
    child.emit('close', 0);
  });
  return child;
}

describe('SpeechVoiceLivePlaneService Surface controls', () => {
  let artifactDir: string;
  let inputAudio: string;

  beforeEach(async () => {
    artifactDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-speech-live-plane-'));
    inputAudio = path.join(artifactDir, 'input.wav');
    await fs.promises.writeFile(inputAudio, Buffer.from('RIFF....TRACK phase 7'));
  });

  afterEach(async () => {
    await fs.promises.rm(artifactDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('closes Surface controls speech, TTS and voice gates without live IO', () => {
    const snapshot = new SpeechVoiceLivePlaneService({
      now: () => new Date('2026-05-04T23:30:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.live-checkpoint-7');
    expect(snapshot.phase).toBe('Surface controls - Speech, TTS And Voice Live Plane');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        targets: 10,
        sttTargets: 4,
        ttsTargets: 4,
        voiceSessionTargets: 3,
        meetingBridgeTargets: 1,
        meetingBridgesLiveOrExcluded: true,
        transcriptArtifactTargets: 8,
        audioArtifactTargets: 4,
        stagingLiveSmokeCommands: 10,
        redactedReceipts: 10,
        blocked: 0,
        liveIoRequiredByStage7Check: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveIoDuringStage7Check: true,
        artifactFirstTranscriptsRequired: true,
        artifactFirstAudioRequired: true,
        recordingConsentRequiredForLiveCalls: true,
        meetingBridgeMustBeLiveOrSignedExcluded: true,
      }),
    );
  });

  it('gives every speech and voice target config, doctor, staging smoke and receipt', () => {
    const snapshot = new SpeechVoiceLivePlaneService().buildSnapshot();
    expect(snapshot.entries.map((entry) => entry.targetId).sort()).toEqual([
      'azure-speech',
      'deepgram',
      'elevenlabs',
      'google-meet',
      'inworld',
      'senseaudio',
      'speech-core',
      'talk-voice',
      'tts-local-cli',
      'voice-call',
    ]);
    for (const entry of snapshot.entries) {
      expect(entry.doctorCommand).toContain('--profile configured');
      expect(entry.stagingLiveSmokeCommand).toContain('--confirm-live-io');
      expect(entry.gates.map((gate) => gate.kind)).toContain('consent-recording-policy');
      expect(entry.receipt).toEqual(
        expect.objectContaining({
          artifactFirst: true,
          liveIoPerformed: false,
          stagingLiveRequiresExplicitCommand: true,
          consentPolicyAttached: true,
          secretValuesSerialized: false,
        }),
      );
    }
    expect(snapshot.entries.find((entry) => entry.targetId === 'google-meet')?.receipt).toEqual(
      expect.objectContaining({
        meetingBridgeDecision: 'excluded',
      }),
    );
  });

  it('stores a live transcript artifact from an audio artifact', async () => {
    const fetchImpl = (async () => jsonResponse({
      results: {
        channels: [{
          alternatives: [{
            transcript: 'ola zavorth etapa sete',
            confidence: 0.98,
          }],
        }],
      },
    })) as typeof fetch;
    const service = new SpeechRuntimeService({
      artifactDir,
      transcribeAdapter: new HttpSpeechTranscriptionLiveAdapter({
        adapterId: 'deepgram',
        providerId: 'deepgram',
        transcribeUrl: 'https://deepgram.example.test/v1/listen',
        apiKey: 'dg-secret',
        authScheme: 'Token',
        modelId: 'nova-2',
      }, { fetchImpl }),
    });

    const result = await service.transcribeLive({
      source: {
        artifactId: 'audio-input',
        contentType: 'audio/wav',
        storageRef: inputAudio,
      },
      speakerLabels: true,
    });

    expect(result.ok).toBe(true);
    expect(result.text).toBe('ola zavorth etapa sete');
    expect(result.transcriptArtifact).toEqual(
      expect.objectContaining({
        contentType: 'application/json',
      }),
    );
    expect(JSON.parse(await fs.promises.readFile(result.transcriptArtifact!.storageRef, 'utf8'))).toEqual(
      expect.objectContaining({
        text: 'ola zavorth etapa sete',
        secretValuesSerialized: false,
      }),
    );
  });

  it('stores synthesized audio as a real artifact', async () => {
    const audioBytes = Buffer.from('checkpoint-7-audio');
    const fetchImpl = (async () => audioResponse(audioBytes, 'audio/mpeg')) as typeof fetch;
    const service = new SpeechRuntimeService({
      artifactDir,
      synthesizeAdapter: new HttpSpeechSynthesisLiveAdapter({
        adapterId: 'elevenlabs',
        providerId: 'elevenlabs',
        synthesizeUrl: 'https://elevenlabs.example.test/v1/text-to-speech/voice',
        apiKey: 'eleven-secret',
        authHeaderName: 'xi-api-key',
        authScheme: null,
        modelId: 'eleven_multilingual_v2',
        voiceId: 'voice-1',
        requestStyle: 'elevenlabs',
      }, { fetchImpl }),
    });

    const result = await service.synthesizeLive({
      text: 'Zavorth pronto para falar',
      format: 'mp3',
    });

    expect(result.ok).toBe(true);
    expect(result.audioArtifact).toEqual(
      expect.objectContaining({
        contentType: 'audio/mpeg',
      }),
    );
    expect(await fs.promises.readFile(result.audioArtifact!.storageRef, 'utf8')).toBe('checkpoint-7-audio');
  });

  it('runs a local CLI TTS adapter', async () => {
    const spawn = jest.fn((command: string, args: string[]) => {
      const child = createFakeChild();
      process.nextTick(() => {
        const outputPath = String(args[args.indexOf('--output') + 1] || '').trim();
        fs.writeFileSync(outputPath, 'local-tts-audio', 'utf8');
        child.emit('close', 0);
      });
      return child;
    }) as any;
    const adapter = new LocalCliSpeechSynthesisLiveAdapter({
      adapterId: 'tts-local-cli',
      providerId: 'tts-local-cli',
      command: 'local-tts',
      args: ['--text', '{text}', '--output', '{output}', '--format', '{format}'],
      tempDir: artifactDir,
    }, { spawn });

    const output = await adapter.synthesize({
      text: 'fala local',
      format: 'wav',
      voiceId: null,
    });

    expect(spawn).toHaveBeenCalledWith('local-tts', expect.arrayContaining(['--text', 'fala local']), expect.any(Object));
    expect(output.data?.toString('utf8')).toBe('local-tts-audio');
    expect(output.providerEvidence.metadata).toEqual(
      expect.objectContaining({
        localCli: true,
        secretValuesSerialized: false,
      }),
    );
  });

  it('runs an artifact-backed push-to-talk voice session', async () => {
    const sttFetch = (async () => jsonResponse({
      text: 'abrir painel zavorth',
    })) as typeof fetch;
    const ttsFetch = (async () => audioResponse(Buffer.from('voice-session-reply'), 'audio/wav')) as typeof fetch;
    const speechRuntime = new SpeechRuntimeService({
      artifactDir,
      transcribeAdapter: new HttpSpeechTranscriptionLiveAdapter({
        adapterId: 'talk-voice-stt',
        providerId: 'talk-voice',
        transcribeUrl: 'https://talk.example.test/transcribe',
        requestStyle: 'json-base64',
      }, { fetchImpl: sttFetch }),
      synthesizeAdapter: new HttpSpeechSynthesisLiveAdapter({
        adapterId: 'talk-voice-tts',
        providerId: 'talk-voice',
        synthesizeUrl: 'https://talk.example.test/tts',
        responseContentType: 'audio/wav',
      }, { fetchImpl: ttsFetch }),
    });
    const voice = new VoiceSessionService({ speechRuntime });

    const result = await voice.runPushToTalk({
      mode: 'push_to_talk',
      participants: ['operator'],
      goal: 'test push to talk',
    }, {
      source: {
        artifactId: 'ptt-audio',
        contentType: 'audio/wav',
        storageRef: inputAudio,
      },
      replyText: 'painel aberto',
      consentGrantedBy: 'operator',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.turns[0]).toEqual(
      expect.objectContaining({
        transcript: 'abrir painel zavorth',
        audioArtifact: expect.objectContaining({
          contentType: 'audio/wav',
        }),
      }),
    );
    expect(result.providerEvidence.map((evidence) => evidence.providerId)).toEqual(['talk-voice', 'talk-voice']);
  });
});
