# Voice product polish + continuity upgrades

## Stack (current)

| Layer | Behavior |
|---|---|
| **Preference** | User-owned STT/TTS (fail closed) |
| **Dictation** | Transcript → same Experience agent as typing |
| **Conversation TTS** | Only if preference enables TTS |
| **Desktop UI** | Settings → Voice (test, metrics, call) |
| **Duplex** | VAD-gated MediaRecorder + utterance assembly + agent + backend TTS |
| **WebRTC** | Real `RTCPeerConnection` offer → server auto-answer + ICE |
| **Thread bind** | Duplex carries `experienceSessionId` + `workspace`; replies inject into chat |

## Media path (improved)

```
mic
  → BrowserVoiceVad (RMS)
  → MediaRecorder chunks (only while speaking / end-of-utterance)
  → POST duplex media_chunk { clientEnergy, endOfUtterance }
  → estimateChunkEnergy + VoiceUtteranceAssembler
  → STT (preference)
  → completeListen → ExperienceCore.executeCommand (session bound)
  → TTS base64 → Desktop playback + chat inject
```

## WebRTC path

```
RTCPeerConnection (audio track)
  → createOffer
  → webrtc_create / webrtc_offer (autoAnswer)
  → buildWebRtcAnswerFromOffer (server)
  → setRemoteDescription + ICE
  → webrtc_connected
```

Media STT remains on the MediaRecorder path (reliable without native `node-webrtc`). WebRTC proves peer connectivity and is ready for full media plane later.

## APIs

```
POST /api/experience/voice/duplex
  start | listen | media_chunk | barge_in | end | get | list
  webrtc_create | webrtc_offer | webrtc_auto_answer | webrtc_answer
  webrtc_ice | webrtc_connected | webrtc_get | webrtc_close

POST /api/experience/voice/tts
POST /api/experience/voice/test
GET  /api/experience/voice/metrics
GET/PUT /api/experience/voice/preference
```

## Smoke

```bash
npx tsx scripts/zavorth-voice-smoke.ts
npx jest tests/voice --no-coverage
```

## Native RTP (when `@roamhq/wrtc` installed)

See `docs/voice-wrtc-native-rtp.md`.

- Server `RTCPeerConnection` + `RTCAudioSink` → PCM → WAV → STT → agent
- Desktop skips HTTP chunk STT in native mode and polls duplex turns
- Fallback remains HTTP MediaRecorder + VAD if native answer fails

## Honest limits

- Full-duplex simultaneous talk-over still uses turn VAD + barge-in (not carrier-grade AEC conference bridge).
- Auto-answer SDP munging is fallback only when native wrtc is missing/fails.
