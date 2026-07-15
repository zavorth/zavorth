# provider-local-llama

Soft-fail Local Llama (OpenAI-compat) provider plugin for Zavorth Plugin OS.

## Env

- `LOCAL_LLM_API_KEY` (optional)
- `LOCAL_LLM_BASE_URL`
- `LOCAL_LLM_URL` (optional)
- `LOCAL_LLM_MODEL` (optional)

Default base: `http://127.0.0.1:8080/v1`

## Capabilities

- `provider.local_llama.status`
- `provider.local_llama.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.local`)
- Soft-fail when key/base missing
