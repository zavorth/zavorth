# provider-deepseek

Soft-fail DeepSeek provider plugin for Zavorth Plugin OS.

## Env

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL` (optional)
- `DEEPSEEK_MODEL` (optional)

Default base: `https://api.deepseek.com`

## Capabilities

- `provider.deepseek.status`
- `provider.deepseek.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
