# media-transcription

Soft-fail OpenAI-compatible **Whisper** speech-to-text for Plugin OS.

## Env

| Variable              | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `OPENAI_API_KEY`      | Required for transcribe (presence only in status) |
| `OPENAI_BASE_URL`     | Optional OpenAI-compatible base                   |
| `TRANSCRIPTION_MODEL` | Default model (default `whisper-1`)               |

## Capabilities

| Capability                       | Usage                                         |
| -------------------------------- | --------------------------------------------- |
| `media.transcription.status`     | Key/base host presence — never secret values  |
| `media.transcription.transcribe` | `{ path\|file\|filePath, model?, language? }` |

Prefer a **workspace-relative** audio file. The plugin reads the file and POSTs multipart form data to `{base}/audio/transcriptions`.

Passing only `{ url }` soft-fails with a tip: download into the workspace first (no arbitrary remote fetch / SSRF).

## Specialized registrar

When `ctx.registerTranscriptionProvider` exists, the plugin registers:

- `id`: `openai-compatible-whisper`
- `capabilityId`: `media.transcription.transcribe`

## Safety

- Path traversal blocked (must stay inside workspace)
- Never returns API key values
- Network requires `requestPermission('network.external', ...)`
- Soft-fail when key or file is missing
- Pure Node (`node:https` / `node:http`), no extra deps

## Enable

```bash
zavorth plugins enable media-transcription --yes
```
