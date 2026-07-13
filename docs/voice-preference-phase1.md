# Voice preference — Phase 1 (sovereignty)

## Goal

Stop picking STT models for the operator. Unconfigured = **refuse**, not cascade Gemini/Whisper.

## Configure

```bash
# Show status
npx tsx scripts/zavorth-voice-pref.ts get

# Choose STT explicitly (example)
npx tsx scripts/zavorth-voice-pref.ts set --stt-provider openai --stt-model whisper-1 --language auto --mode dictation

# Or via env (ops sovereignty)
# ZAVORTH_AUDIO_STT_PROVIDERS=openai
# ZAVORTH_AUDIO_STT_MODEL=whisper-1

# Legacy emergency cascade (opt-in only)
# ZAVORTH_VOICE_ALLOW_LEGACY_STT_CASCADE=true
```

Stored at: `data/runtime/voice/preference.json`

## Resolve order

1. Preference file (`stt.provider !== none`)
2. Explicit env `ZAVORTH_AUDIO_STT_PROVIDERS`
3. Legacy cascade **only** if `ZAVORTH_VOICE_ALLOW_LEGACY_STT_CASCADE=true`
4. Else **fail closed** with configure hint

## Wired

- `AudioTranscriptionService.transcribe` — uses `VoicePreferenceService.resolveStt()`
- `processVoiceReply` — refuses audio path when STT unconfigured (unless custom `stt` adapter passed)
- CLI `scripts/zavorth-voice-pref.ts`

## Phase 0

See `docs/voice-preference-audit-phase0.md` for full entrypoint inventory.

## Phase 2 (dictation-first) — done

See `docs/voice-dictation-phase2.md`.

## Not in Phase 1

- Desktop settings UI for voice pickers
- TTS conversation mode polish
