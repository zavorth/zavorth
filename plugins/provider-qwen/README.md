# provider-qwen

Soft-fail Qwen (DashScope) provider plugin for Zavorth Plugin OS.

## Env

- `DASHSCOPE_API_KEY`
- `QWEN_API_KEY`
- `QWEN_BASE_URL` (optional)
- `DASHSCOPE_BASE_URL` (optional)
- `QWEN_MODEL` (optional)

Default base: `https://dashscope.aliyuncs.com/compatible-mode/v1`

## Capabilities

- `provider.qwen.status`
- `provider.qwen.complete` (via `bindProvider`)

## Safety

- Never returns API key values (presence booleans only)
- Network requires permission (`network.external`)
- Soft-fail when key/base missing
