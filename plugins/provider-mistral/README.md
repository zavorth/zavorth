# provider-mistral

Soft-fail Mistral provider plugin for Zavorth Plugin OS.

## Env

- `MISTRAL_API_KEY`
- `MISTRAL_BASE_URL` (optional)
- `MISTRAL_MODEL` (optional)

Default base: `https://api.mistral.ai/v1`

## Capabilities

- `provider.mistral.status`
- `provider.mistral.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
