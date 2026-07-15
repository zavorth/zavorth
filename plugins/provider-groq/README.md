# provider-groq

Soft-fail Groq provider plugin for Zavorth Plugin OS.

## Env

- `GROQ_API_KEY`
- `GROQ_BASE_URL` (optional)
- `GROQ_MODEL` (optional)

Default base: `https://api.groq.com/openai/v1`

## Capabilities

- `provider.groq.status`
- `provider.groq.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
