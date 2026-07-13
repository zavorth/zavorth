# provider-openai-compatible (Wave 1)

Soft-fail OpenAI-compatible chat completions for Plugin OS.

## Env

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required for complete |
| `OPENAI_BASE_URL` | Optional (OpenRouter, local, Azure gateways) |
| `OPENAI_MODEL` | Default model |

## Capabilities

- `provider.openai_compatible.status`
- `provider.openai_compatible.complete` (via `bindProvider`)

## Safety

- Never returns API key values
- Network requires permission
- Soft-fail when key missing
