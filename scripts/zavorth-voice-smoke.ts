#!/usr/bin/env npx tsx
/**
 * Offline smoke for voice polish stack (no live network STT required).
 *
 * Usage:
 *   npx tsx scripts/zavorth-voice-smoke.ts
 *
 * Exit 0 = all checks passed; non-zero = failure.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoicePreferenceService,
  resetVoicePreferenceServiceForTests,
} from '../src/services/voice/VoicePreferenceService.js';
import { VoiceProbeService } from '../src/services/voice/VoiceProbeService.js';
import {
  VoiceRealtimeDuplexSessionService,
  resetVoiceRealtimeDuplexForTests,
} from '../src/services/voice/VoiceRealtimeDuplexSession.js';
import { VoiceDictationIngress } from '../src/services/voice/VoiceDictationIngress.js';
import { createExperienceDuplexAgentHandler } from '../src/services/voice/createExperienceDuplexAgentHandler.js';
import {
  getVoiceWebRtcSignalingService,
  resetVoiceWebRtcSignalingForTests,
} from '../src/services/voice/VoiceWebRtcSignaling.js';
import {
  getVoiceMetricsSnapshot,
  resetVoiceMetricsForTests,
} from '../src/services/voice/VoiceMetricsService.js';
import { normalizeVoiceLanguage, whisperLanguageParam } from '../src/services/voice/VoiceLanguage.js';
import {
  isDiscordAudioAttachment,
  mergeDiscordVoiceText,
} from '../src/gateways/channels/discord/DiscordVoiceAttachmentIngest.js';
import { estimateChunkEnergy, VoiceUtteranceAssembler } from '../src/services/voice/VoiceVad.js';
import { buildWebRtcAnswerFromOffer } from '../src/services/voice/VoiceWebRtcSdp.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<number> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-voice-smoke-'));
  const failures: string[] = [];
  const pass = (name: string) => console.log(`  ✓ ${name}`);
  const fail = (name: string, err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${message}`);
    console.error(`  ✗ ${name}: ${message}`);
  };

  console.log('Zavorth voice smoke (offline)\n');

  try {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();

    // 1) Language hardening
    try {
      const pt = normalizeVoiceLanguage('pt-BR');
      assert(pt.whisper === 'pt', 'pt-BR → whisper pt');
      assert(whisperLanguageParam('auto') === null, 'auto → no whisper param');
      assert(whisperLanguageParam('en-US') === 'en', 'en-US → en');
      pass('language normalization');
    } catch (e) {
      fail('language normalization', e);
    }

    // 2) Preference + probe
    const prefs = new VoicePreferenceService({
      preferencePath: path.join(tmpDir, 'preference.json'),
      env: {},
    });
    try {
      prefs.set({
        mode: 'conversation',
        stt: { provider: 'openai', model: 'whisper-1', language: 'pt' },
        tts: { enabled: true, provider: 'edge-tts', voiceId: 'pt-BR-FranciscaNeural' },
      });
      const probe = new VoiceProbeService({ voicePreferences: prefs });
      const all = probe.probeAll();
      assert(all.stt.ok, 'STT probe ok');
      assert(all.tts.ok, 'TTS probe ok');
      pass('preference + probe');
    } catch (e) {
      fail('preference + probe', e);
    }

    // 3) Duplex → experience agent handler (mocked execute)
    try {
      const handler = createExperienceDuplexAgentHandler({
        ensureReady: async () => undefined,
        execute: async ({ text }) => ({
          ok: true,
          replies: [{ role: 'assistant', text: `Agent says: ${text}` }],
        }),
        userId: 'smoke-user',
      });
      const duplex = new VoiceRealtimeDuplexSessionService({
        voicePreferences: prefs,
        dictation: new VoiceDictationIngress({ voicePreferences: prefs }),
      });
      const session = duplex.start({
        surface: 'desktop',
        agentHandler: handler,
        speakHandler: async () => ({
          mimeType: 'audio/mpeg',
          audioBase64: Buffer.from('fake-mp3').toString('base64'),
          provider: 'edge-tts',
        }),
      });
      const after = await duplex.completeListen(session.sessionId, {
        transcript: 'list files please',
        provider: 'openai',
      });
      assert(after.lastAgentText === 'Agent says: list files please', 'agent path wired');
      assert(after.lastTtsAudio?.audioBase64, 'tts audio attached');
      assert(after.turnCount === 1, 'turn counted');
      duplex.end(session.sessionId);
      pass('duplex → experience agent + backend TTS payload');
    } catch (e) {
      fail('duplex → experience agent + backend TTS payload', e);
    }

    // 4) WebRTC signaling foundation
    try {
      const rtc = getVoiceWebRtcSignalingService();
      const created = rtc.create({ duplexSessionId: 'dup-1', surface: 'desktop' });
      const offerSdp = [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'a=sendrecv',
        'a=rtpmap:111 opus/48000/2',
      ].join('\r\n');
      rtc.setOffer(created.signalId, offerSdp);
      rtc.autoAnswer(created.signalId);
      rtc.addIce(created.signalId, { candidate: 'candidate:1 1 UDP 1 127.0.0.1 9 typ host' });
      const got = rtc.get(created.signalId);
      assert(got?.state === 'answer', 'webrtc answer state');
      assert((got?.ice.length || 0) >= 1, 'ice stored');
      assert(Boolean(got?.answerSdp?.includes('recvonly')), 'auto answer has recvonly');
      rtc.close(created.signalId);
      pass('WebRTC signaling foundation');
    } catch (e) {
      fail('WebRTC signaling foundation', e);
    }

    // 5) Discord audio attachment helpers
    try {
      assert(
        isDiscordAudioAttachment({
          id: '1',
          name: 'voice.ogg',
          url: 'https://cdn.example/voice.ogg',
          contentType: 'audio/ogg',
          size: 1000,
        }),
        'detect ogg',
      );
      assert(
        !isDiscordAudioAttachment({
          id: '2',
          name: 'photo.png',
          url: 'https://cdn.example/photo.png',
          contentType: 'image/png',
          size: 100,
        }),
        'skip png',
      );
      const merged = mergeDiscordVoiceText('hi', {
        ok: true,
        transcript: 'hello world',
        agentText: 'hello world',
        provider: 'openai',
        message: null,
      });
      assert(merged.includes('hello world'), 'merge voice text');
      pass('Discord voice attachment helpers');
    } catch (e) {
      fail('Discord voice attachment helpers', e);
    }

    // 6) Metrics recorded
    try {
      const snap = getVoiceMetricsSnapshot();
      assert(snap.total >= 1, 'metrics non-empty');
      pass('metrics snapshot');
    } catch (e) {
      fail('metrics snapshot', e);
    }

    // 7) VAD + SDP auto-answer
    try {
      const energy = estimateChunkEnergy(Buffer.alloc(3000, 40));
      assert(typeof energy.energy === 'number', 'energy number');
      const asm = new VoiceUtteranceAssembler({ silenceMs: 50, minChars: 1 });
      asm.push('hi', 1000);
      const flush = asm.poll(1200);
      assert(flush.ready && flush.utterance === 'hi', 'utterance flush');
      const offer = [
        'v=0',
        'o=- 0 0 IN IP4 127.0.0.1',
        's=-',
        't=0 0',
        'm=audio 9 UDP/TLS/RTP/SAVPF 111',
        'a=sendrecv',
        'a=rtpmap:111 opus/48000/2',
      ].join('\r\n');
      const answer = buildWebRtcAnswerFromOffer(offer);
      assert(answer.includes('recvonly'), 'sdp answer recvonly');
      pass('VAD + WebRTC SDP auto-answer');
    } catch (e) {
      fail('VAD + WebRTC SDP auto-answer', e);
    }

    console.log('\nMetrics snapshot:', JSON.stringify(getVoiceMetricsSnapshot(5), null, 2));
  } finally {
    resetVoiceMetricsForTests();
    resetVoicePreferenceServiceForTests();
    resetVoiceRealtimeDuplexForTests();
    resetVoiceWebRtcSignalingForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  if (failures.length) {
    console.error(`\nSMOKE FAILED (${failures.length})`);
    for (const f of failures) console.error(` - ${f}`);
    return 1;
  }
  console.log('\nSMOKE OK — all offline voice polish checks passed.');
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
