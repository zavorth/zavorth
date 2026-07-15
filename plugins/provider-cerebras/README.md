# provider-cerebras

Soft-fail Cerebras provider plugin for Zavorth Plugin OS.

## Env

- `CEREBRAS_API_KEY`
- `CEREBRAS_BASE_URL` (optional)
- `CEREBRAS_MODEL` (optional)

Default base: `https://api.cerebras.ai/v1`

## Capabilities

- `provider.cerebras.status`
- `provider.cerebras.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
