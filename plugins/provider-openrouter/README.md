# provider-openrouter

Soft-fail OpenRouter provider plugin for Zavorth Plugin OS.

## Env

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` (optional)
- `OPENROUTER_MODEL` (optional)

Default base: `https://openrouter.ai/api/v1`

## Capabilities

- `provider.openrouter.status`
- `provider.openrouter.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
