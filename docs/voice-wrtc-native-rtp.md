# Native WebRTC media plane (`wrtc`)

## What it is

Optional Node package (`@roamhq/wrtc` or `wrtc`) that gives the **server** a real `RTCPeerConnection`.

When available, Zavorth:

1. Accepts the Desktop SDP offer with a **native peer**
2. Attaches `RTCAudioSink` to the inbound audio track
3. Buffers **PCM** with silence VAD
4. Converts utterance → **WAV**
5. Runs **preference STT**
6. Completes duplex listen → **Experience agent** → backend TTS

Without the package, the product path remains **HTTP MediaRecorder + browser VAD** (fully supported).

## Install

```bash
npm i @roamhq/wrtc
# or
npm i wrtc
```

Declared as `optionalDependencies` so install failures do not break the monorepo.

## Flow

```
Desktop mic
  → RTCPeerConnection (browser)
  → SDP offer/answer + ICE (duplex API)
  → server wrtc peer
  → RTCAudioSink (PCM)
  → VAD silence flush
  → WAV → AudioTranscriptionService
  → VoiceRealtimeDuplexSession.completeListen
  → Experience agent + TTS
  → Desktop polls session / plays audio
```

If native answer fails, server falls back to SDP-munged answer + HTTP chunk STT.

## Probe

```bash
npx tsx scripts/zavorth-voice-live-smoke.ts
# GET /api/experience/voice/media-plane
```

`mode=native_wrtc` means RTP→STT is active.
`mode=http_chunk_vad` means HTTP path only.

## Desktop

On native mode, the client:

- Still opens mic + RTCPeerConnection
- **Skips** HTTP `media_chunk` STT (server already has PCM)
- Polls duplex session for new turns
