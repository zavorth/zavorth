# Voice: Desktop UI + duplex + Phase 4 metrics

## Desktop Settings → Voice

Path: **Settings → Voice** (`VoiceSettingsPanel`)

- Mode: off / dictation / conversation
- STT provider + optional model + language
- TTS enable + provider + voice id
- **Test STT / Test TTS / Test all** (dry-run probe + browser sample for TTS)
- Live metrics (STT/TTS/dictation/duplex)
- Call-like duplex: continuous mic → agent → spoken reply + barge-in

API:

- `GET/PUT /api/experience/voice/preference`
- `GET /api/experience/voice/metrics`
- `POST /api/experience/voice/duplex` (`action`: start|listen|barge_in|end|list|get)
- `POST /api/experience/voice/test` (`action`: stt|tts|all)

## Realtime duplex (call-like foundation)

Server: `VoiceRealtimeDuplexSessionService` — turn-coordinated full-duplex style:

```
listening → (transcript) → processing (dictation + agent) → speaking? → listening
barge-in → listening
```

Desktop client: `useDuplexCall`

- Continuous **browser SpeechRecognition** while session is active
- Final transcripts auto-POST as `listen` turns
- Reply spoken via **speechSynthesis**
- Speech during TTS → cancel + `barge_in`

Not WebRTC media streaming. This is simultaneous listen + coordinated turns — the foundation for a true voice call UX without a separate product path.

## Phase 4 quality

- **Global STT timeout** budget (`ZAVORTH_AUDIO_STT_GLOBAL_TIMEOUT_MS` or per-try timeout)
- **Language**: preference/env override honored hard in `AudioTranscriptionService`
- **Honest failures**: errors end with “Type your message instead.”
- **Metrics**: `recordVoiceMetric` on STT/TTS/dictation/duplex (+ probe)

## Enable conversation + TTS (example)

```bash
npx tsx scripts/zavorth-voice-pref.ts set \
  --stt-provider openai \
  --stt-model whisper-1 \
  --mode conversation \
  --tts-enabled true \
  --tts-provider edge-tts \
  --tts-voice en-US-JennyNeural
```

Or use Desktop **Settings → Voice** → Save → Test all → Start call session.
