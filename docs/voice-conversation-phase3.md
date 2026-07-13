# Voice conversation — Phase 3

## Principle

1. **STT** (hear) — only providers you configured (Phase 1).
2. **Dictation** — transcript → same agent/tools (Phase 2).
3. **TTS** (speak) — only if **you** enabled TTS + chose provider/voice (Phase 3).

No silent product default (no automatic Kore / Jenny unless **you** set it).

## Enable conversation

```bash
npx tsx scripts/zavorth-voice-pref.ts set \
  --stt-provider openai \
  --stt-model whisper-1 \
  --mode conversation \
  --tts-enabled true \
  --tts-provider edge-tts \
  --tts-voice en-US-JennyNeural
```

Or Gemini TTS:

```bash
npx tsx scripts/zavorth-voice-pref.ts set \
  --mode conversation \
  --tts-enabled true \
  --tts-provider gemini \
  --tts-voice Kore
```

## Flow

```
voice note
  → STT (preference)
  → 📝 transcript preview
  → processTextMessage / agent (tools)
  → EchoOutputStage.deliver
       → if ttsReplyDesired / conversation + tts.enabled
            → synthesize(voiceId, forceProvider from preference)
            → sendVoice
       → else text
```

## Policy

`VoiceTtsPolicy.resolveVoiceTts`:

| Condition | TTS? |
|-----------|------|
| `tts.enabled=false` or provider `none` | No |
| mode `conversation` + tts enabled | Yes (after agent) |
| `voiceFlow.ttsReplyDesired` from dictation | Yes if TTS configured |
| explicit “reply in voice” | Yes if TTS configured |
| Legacy Echo mode only | Only with `ZAVORTH_VOICE_ALLOW_LEGACY_ECHO_TTS=true` or explicit voice request + echo active |

## Files

- `src/services/voice/VoiceTtsPolicy.ts`
- `src/services/EchoOutputStageService.ts` (preference-aware TTS)
- Dictation sets `voiceFlow.ttsReplyDesired` (Phase 2)

## Not included

- Desktop settings UI picker
- Streaming realtime duplex voice
