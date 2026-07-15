# provider-openai

Soft-fail OpenAI provider plugin for Zavorth Plugin OS.

## Env

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (optional)
- `OPENAI_API_BASE` (optional)
- `OPENAI_MODEL` (optional)

Default base: `https://api.openai.com/v1`

## Capabilities

- `provider.openai.status`
- `provider.openai.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
