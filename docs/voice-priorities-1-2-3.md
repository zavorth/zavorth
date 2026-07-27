# Voice priorities 1-3

## 1. Turn push without blind polling

| Channel | Use |
| --- | --- |
| **SSE** | `GET /api/experience/voice/duplex/events?sessionId=...` |
| **Long-poll** | `POST /api/experience/voice/duplex` with `action=wait_event` through the desktop bridge |

Bus: `VoiceDuplexEventBus` publishes `session`, `phase`, `turn`, `error`, and `ended` events from `VoiceRealtimeDuplexSession`.

Native desktop RTP uses a push-held `wait_event` loop instead of polling GET every 900ms.

## 2. Live dogfood

```bash
npx tsx scripts/zavorth-voice-dogfood.ts
npx tsx scripts/zavorth-voice-dogfood.ts --live
npx tsx scripts/zavorth-voice-dogfood.ts --live --confirm-live-stt
```

Doc: `docs/voice-dogfood.md`

## 3. Audio quality

`VoiceAudioQuality`:

- downmix mono
- AGC with RMS target
- resample to 16 kHz
- VAD with about 120ms of continuous speech

Integrated into `VoiceNativeRtpBridge` before WAV/STT.
