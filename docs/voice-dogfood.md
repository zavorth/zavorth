# Voice dogfood — practical live session

Operator checklist + automated script for validating Zavorth voice when the
experience API (and optional STT keys) are available.

## Script

```bash
# Offline only (always safe; no network, no paid APIs)
npx tsx scripts/zavorth-voice-dogfood.ts

# Live HTTP against experience API (default base http://127.0.0.1:8787)
npx tsx scripts/zavorth-voice-dogfood.ts --live

# Explicit base (also enables live HTTP without --live)
npx tsx scripts/zavorth-voice-dogfood.ts --base http://127.0.0.1:8787

# Or via env
# PowerShell:
#   $env:ZAVORTH_EXPERIENCE_BASE_URL = "http://127.0.0.1:8787"
#   npx tsx scripts/zavorth-voice-dogfood.ts
#
# bash:
#   export ZAVORTH_EXPERIENCE_BASE_URL=http://127.0.0.1:8787
#   npx tsx scripts/zavorth-voice-dogfood.ts

# Optional: call paid/local STT on a generated sine WAV (requires keys)
npx tsx scripts/zavorth-voice-dogfood.ts --live --confirm-live-stt
```

Windows PowerShell is supported (`shell: true` when spawning `npx`).

### Related smokes

| Script                                | Role                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `scripts/zavorth-voice-smoke.ts`      | Offline unit-style polish checks                                            |
| `scripts/zavorth-voice-live-smoke.ts` | Offline + optional live HTTP + WebRTC signaling                             |
| `scripts/zavorth-voice-dogfood.ts`    | Dogfood: offline + media plane + live HTTP + STT key gate + human checklist |

## What the dogfood script does

1. **Offline smoke** — spawns `zavorth-voice-smoke.ts` (must pass).
2. **Media plane probe** — local `probeVoiceMediaPlane` (`http_chunk_vad` vs `native_wrtc`).
3. **STT keys** — detects `OPENAI_API_KEY`, `GROQ_API_KEY`, `DEEPGRAM_API_KEY`,
   `GEMINI_API_KEY` / `GOOGLE_API_KEY`, `ZAVORTH_AUDIO_STT_*`, `ZAVORTH_WHISPER_MODEL_PATH`.
   Prints `STT keys detected` when present. **Does not** call paid APIs unless
   `--confirm-live-stt` is set.
4. **Live HTTP** (when `--live` or `ZAVORTH_EXPERIENCE_BASE_URL` / `--base`):
   - `GET /api/experience/voice/preference`
   - `GET /api/experience/voice/metrics`
   - `GET /api/experience/voice/media-plane`
   - `POST /api/experience/voice/duplex` start (`agentReplyOverride`) → listen → end
   - `POST /api/experience/voice/test` stt + tts (dry-run probes)
5. **DOGFOOD CHECKLIST** — human Desktop path printed every run.

### Auth

Some routes use management auth. Soft 401/403 **do not fail** the script (exit 0).

```bash
# PowerShell
$env:ZAVORTH_MANAGEMENT_TOKEN = "your-token"
# also accepted: ZAVORTH_API_TOKEN, ZAVORTH_CONTROL_TOKEN
```

### Exit codes

| Code | Meaning                                                                   |
| ---- | ------------------------------------------------------------------------- |
| 0    | Offline OK; soft auth / probe gaps OK                                     |
| 1    | Offline smoke failed, or unexpected hard error (e.g. confirmed STT crash) |
| 2    | Live requested and hard connection failure (`ECONNREFUSED`, etc.)         |

## Without keys

You can still dogfood:

- Offline stack (preference, duplex override path, VAD, metrics, WebRTC SDP).
- Live HTTP duplex with `agentReplyOverride` (no real LLM, no real STT).
- Desktop UI: Settings → Voice → Test (dry-run probes).
- Full speech path needs STT configured in Settings **or** env keys + preference.

## With keys

1. Set provider keys (e.g. `OPENAI_API_KEY`) and/or Desktop preference.
2. Run dogfood with `--live` to hit experience routes.
3. Only add `--confirm-live-stt` when you intentionally want a tiny generated WAV
   sent through `AudioTranscriptionService` (may incur cost).

```bash
npx tsx scripts/zavorth-voice-pref.ts set --stt-provider openai --stt-model whisper-1 --mode conversation --tts-enabled true --tts-provider edge-tts
npx tsx scripts/zavorth-voice-dogfood.ts --live --confirm-live-stt
```

## Human Desktop session

1. Configure voice: **Settings → Voice** → STT provider + Save → Test
2. Open a chat thread
3. **Mic** = dictation into the input
4. **Phone** = full duplex call (VAD → STT → Experience agent → TTS)
5. Speak; after pause, agent replies (spoken + in thread)
6. End via Phone again or banner **End**

## Optional native media plane

```bash
npm i wrtc
# or
npm i @roamhq/wrtc
```

Re-run media-plane probe — mode becomes `native_wrtc` when the package loads.
Product call path does **not** require this; HTTP+VAD remains first-class.

## See also

- [voice-next-step-live.md](./voice-next-step-live.md) — composer Phone button + media plane
- [voice-pipeline.md](./voice-pipeline.md) — pipeline overview
