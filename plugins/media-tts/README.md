# media-tts

Soft-fail OpenAI-compatible **text-to-speech** for Plugin OS.

## Env

| Variable          | Purpose                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `OPENAI_API_KEY`  | Required for synthesize (presence only in status)                   |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible base (OpenRouter, local, Azure gateways) |
| `TTS_MODEL`       | Default model (default `tts-1`)                                     |

## Capabilities

| Capability             | Usage                                        |
| ---------------------- | -------------------------------------------- |
| `media.tts.status`     | Key/base host presence — never secret values |
| `media.tts.synthesize` | `{ text\|input, voice?, model?, format? }`   |

Synthesize POSTs to `{base}/audio/speech`. When filesystem is available, audio is written under `.zavorth/media-tts/` with a random name and a **workspace-relative** path is returned. If write fails, the result still reports binary size.

## Specialized registrar

When `ctx.registerTtsProvider` exists, the plugin registers:

- `id`: `openai-compatible-tts`
- `capabilityId`: `media.tts.synthesize`

## Safety

- Never returns API key values
- Network requires `requestPermission('network.external', ...)`
- Soft-fail when key missing or permission denied
- Pure Node (`node:https` / `node:http`), no extra deps

## Enable

```bash
zavorth plugins enable media-tts --yes
```
