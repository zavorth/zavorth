#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const rules = [
  ruleFilesExist({
    id: 'speech-voice-live-plane-files',
    label: 'Speech voice live plane files exist',
    target: 'Contract, service, adapters, tests, docs, script, SDK barrels and package scripts are present',
    files: [
      'src/contracts/SpeechVoiceLivePlaneContract.ts',
      'src/services/SpeechVoiceLivePlaneService.ts',
      'src/adapters/speech/SpeechVoiceLiveAdapters.ts',
      'tests/services/SpeechVoiceLivePlaneService.test.ts',
      'scripts/speech-voice-live-plane.ts',
      'scripts/speech-voice-live-plane-check.mjs',
      'docs/README.md',
      'src/sdk/contracts.ts',
      'src/sdk/index.ts',
      'package.json',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-contract',
    label: 'Contract defines Surface controls vocabulary',
    target: 'Contract captures targets, capabilities, gates, receipts and next phase handoff',
    files: ['src/contracts/SpeechVoiceLivePlaneContract.ts'],
    needles: [
      'ZAVORTH_SPEECH_VOICE_LIVE_PLANE_CONTRACT_VERSION',
      '2026-05-04.live-gate-7',
      'azure-speech',
      'deepgram',
      'elevenlabs',
      'voice.session',
      'meetingBridgesLiveOrExcluded: true',
      'ZavorthControl controls - Research, Web Extraction And Browser Live Plane',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-adapters',
    label: 'Adapters implement STT, TTS and local TTS',
    target: 'HTTP STT, HTTP TTS and local CLI adapters support artifact-first outputs and provider evidence',
    files: ['src/adapters/speech/SpeechVoiceLiveAdapters.ts'],
    needles: [
      'HttpSpeechTranscriptionLiveAdapter',
      'HttpSpeechSynthesisLiveAdapter',
      'LocalCliSpeechSynthesisLiveAdapter',
      'providerEvidence',
      'json-base64',
      'raw-audio',
    ],
  }),
  ruleContainsAll({
    id: 'speech-runtime-service-live-path',
    label: 'Speech runtime executes artifact-backed speech',
    target: 'SpeechRuntimeService exposes live transcript and audio artifact paths',
    files: ['src/services/SpeechRuntimeService.ts'],
    needles: [
      'transcribeLive',
      'synthesizeLive',
      'storeTranscriptArtifact',
      'storeAudioArtifact',
    ],
  }),
  ruleContainsAll({
    id: 'voice-session-service-live-path',
    label: 'Voice session runtime executes push-to-talk',
    target: 'VoiceSessionService exposes artifact-backed push-to-talk lifecycle',
    files: ['src/services/VoiceSessionService.ts'],
    needles: [
      'runPushToTalk',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-service',
    label: 'Service closes Surface controls gates',
    target: 'Service maps ten speech/voice targets with STT, TTS, session and meeting decisions',
    files: ['src/services/SpeechVoiceLivePlaneService.ts'],
    needles: [
      'SpeechVoiceLivePlaneService',
      'SPEECH_VOICE_TARGETS',
      'azure-speech',
      'deepgram',
      'senseaudio',
      'elevenlabs',
      'tts-local-cli',
      'google-meet',
      '--confirm-live-io',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-tests',
    label: 'Tests prove Surface controls behavior',
    target: 'Tests cover snapshot, transcript artifact, audio artifact, local TTS and push-to-talk session',
    files: ['tests/services/SpeechVoiceLivePlaneService.test.ts'],
    needles: [
      'closes Surface controls speech, TTS and voice gates',
      'stores a live transcript artifact from an audio artifact',
      'stores synthesized audio as a real artifact',
      'runs a local CLI TTS adapter',
      'runs an artifact-backed push-to-talk voice session',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-package',
    label: 'Package exposes Surface controls scripts',
    target: 'Surface controls can be run through package scripts',
    files: ['package.json'],
    needles: [
      'speech-voice-live-plane',
      'speech-voice-live-plane:check',
      'qa:speech-voice-live-plane',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-sdk',
    label: 'SDK exposes Surface controls contract and service',
    target: 'Surface controls can be imported from SDK barrels',
    files: ['src/sdk/contracts.ts', 'src/sdk/index.ts'],
    needles: [
      'SpeechVoiceLivePlane',
    ],
  }),
  ruleContainsAll({
    id: 'speech-voice-live-doc',
    label: 'Docs record Surface controls closure',
    target: 'Surface controls documentation explains speech, TTS, voice and staging-live flow',
    files: ['docs/README.md'],
    needles: [
      'Surface controls',
      'Speech, TTS And Voice Live Plane',
      'staging-live',
      'google-meet',
    ],
  }),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[speech-voice-live-plane] checking Surface controls');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[speech-voice-live-plane] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 8)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
