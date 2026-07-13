# media-image-gen (Wave 4)

Soft-fail image generation for Zavorth Plugin OS.

## Env

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Preferred backend (Images API) |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible base |
| `IMAGE_GEN_MODEL` | Default model (e.g. `dall-e-3`) |
| `XAI_API_KEY` / `GROK_API_KEY` | Fallback xAI image endpoint |

Status reports **presence only** — never secret values.

## Capabilities

- `media.image.status` — which backends have keys configured
- `media.image.generate` — `{ prompt, size?, n?, model?, provider? }`

When `ctx.registerImageGenProvider` is available, registers:

| Field | Value |
|-------|-------|
| id | `media-image-gen` |
| capabilityId | `media.image.generate` |

## Provider preference

1. Explicit `provider` input (`openai` / `xai`) when that key is present
2. Else OpenAI if `OPENAI_API_KEY`
3. Else soft-try xAI `https://api.x.ai/v1/images/generations`

## Safety

- Requests `network.external` before any HTTP call
- Soft-fail when key missing, permission denied, or HTTP errors
- Never returns or logs API key values
- Response may include `url` and/or `b64_json`

## Enable

```bash
zavorth plugins enable media-image-gen --yes
```
