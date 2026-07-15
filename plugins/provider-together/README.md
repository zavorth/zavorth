# provider-together

Soft-fail Together AI provider plugin for Zavorth Plugin OS.

## Env

- `TOGETHER_API_KEY`
- `TOGETHER_BASE_URL` (optional)
- `TOGETHER_MODEL` (optional)

Default base: `https://api.together.xyz/v1`

## Capabilities

- `provider.together.status`
- `provider.together.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
