# provider-ollama

Soft-fail Ollama (local) provider plugin for Zavorth Plugin OS.

## Env

- No API key required
- `OLLAMA_BASE_URL` (optional)
- `OLLAMA_HOST` (optional)
- `OLLAMA_MODEL` (optional)

Default base: `http://127.0.0.1:11434/v1`

## Capabilities

- `provider.ollama.status`
- `provider.ollama.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.local`)
- Soft-fail when key/base missing
