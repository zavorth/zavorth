# media-vision

Soft-fail image describe (vision) for Zavorth Plugin OS.

## Env

| Variable                        | Purpose                                   |
| ------------------------------- | ----------------------------------------- |
| `OPENAI_API_KEY`                | Required for `media.vision.describe`      |
| `OPENAI_BASE_URL`               | Optional OpenAI-compatible base           |
| `VISION_MODEL` / `OPENAI_MODEL` | Default vision model (e.g. `gpt-4o-mini`) |
| `XAI_API_KEY`                   | Presence only in status                   |
| `ANTHROPIC_API_KEY`             | Presence only in status                   |

Status reports **presence only** — never secret values.

## Capabilities

- `media.vision.status` — key presence for OpenAI / xAI / Anthropic
- `media.vision.describe` — `{ imageUrl|url|image, prompt?, model? }`

Describe uses OpenAI-compatible `POST {base}/chat/completions` with multimodal `image_url` content when `OPENAI_API_KEY` is set.

## Input image forms

- HTTPS URL
- `data:image/...;base64,...`
- Raw base64 (wrapped as PNG data URL)

## Safety

- Requests `network.external` before any HTTP call
- Soft-fail when key missing, permission denied, or HTTP errors
- Never returns API key values
- Truncates large base64 payloads in logs

## Enable

```bash
zavorth plugins enable media-vision --yes
```
