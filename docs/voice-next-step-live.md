# Voice next step — live dogfood + in-thread call

## What this step adds

1. **Composer voice call** — Phone button next to Mic in Desktop chat
   - Mic = dictation into the input
   - Phone = full duplex call (VAD → STT → Experience agent → TTS)
   - Active call banner with phase / RMS / End

2. **Media plane probe**
   - `GET /api/experience/voice/media-plane`
   - Reports `http_chunk_vad` (default product) or `native_wrtc` if `wrtc` is installed

3. **Live smoke**
   ```bash
   npx tsx scripts/zavorth-voice-live-smoke.ts
   npx tsx scripts/zavorth-voice-live-smoke.ts --live
   npx tsx scripts/zavorth-voice-live-smoke.ts --live --base http://127.0.0.1:8787
   ```
   Offline always runs. `--live` hits preference / metrics / duplex / media-plane when the experience API is up.

## How to dogfood

### Automated (preferred)

```bash
# Offline + checklist (no paid APIs)
npx tsx scripts/zavorth-voice-dogfood.ts

# Live HTTP when experience API is up
npx tsx scripts/zavorth-voice-dogfood.ts --live
npx tsx scripts/zavorth-voice-dogfood.ts --live --base http://127.0.0.1:8787

# Optional paid STT on a generated sine WAV (keys required)
npx tsx scripts/zavorth-voice-dogfood.ts --live --confirm-live-stt
```

Auth soft-fails (exit 0) if `ZAVORTH_MANAGEMENT_TOKEN` is missing on protected routes.
Hard connection failures under `--live` exit `2`. Full notes: [voice-dogfood.md](./voice-dogfood.md).

### Human Desktop

1. Configure voice: Settings → Voice → STT provider + Save → Test
2. Open chat thread
3. Click **Phone** (voice call)
4. Speak; after pause, agent replies (spoken + in thread)
5. Click Phone again or banner **End**

## Optional native media plane

```bash
npm i wrtc
# or
npm i @roamhq/wrtc
```

Then re-run the media-plane probe — mode becomes `native_wrtc` when the package loads.
Product call path does **not** require this; HTTP+VAD remains first-class.
