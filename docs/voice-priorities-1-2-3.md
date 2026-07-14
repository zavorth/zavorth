# Voice priorities 1–3

## 1. Push de turnos (sem poll cego)

| Canal         | Uso                                                                      |
| ------------- | ------------------------------------------------------------------------ |
| **SSE**       | `GET /api/experience/voice/duplex/events?sessionId=…`                    |
| **Long-poll** | `POST /api/experience/voice/duplex` `action=wait_event` (Desktop bridge) |

Bus: `VoiceDuplexEventBus` — eventos `session` / `phase` / `turn` / `error` / `ended` publicados por `VoiceRealtimeDuplexSession`.

Desktop nativo RTP usa **wait_event** em loop (push-held), não mais GET a cada 900ms.

## 2. Dogfood live

```bash
npx tsx scripts/zavorth-voice-dogfood.ts
npx tsx scripts/zavorth-voice-dogfood.ts --live
npx tsx scripts/zavorth-voice-dogfood.ts --live --confirm-live-stt
```

Doc: `docs/voice-dogfood.md`

## 3. Qualidade de áudio (PCM server)

`VoiceAudioQuality`:

- downmix mono
- AGC (RMS target)
- resample **16 kHz**
- VAD com ~120ms de fala contínua

Integrado em `VoiceNativeRtpBridge` antes do WAV/STT.
