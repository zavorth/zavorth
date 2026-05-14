# SDK Usage

The official SDKs should consume REST v1 and avoid duplicating internal runtime contracts.

## TypeScript

Local build:

```bash
npm exec tsc -p sdk/typescript/tsconfig.json
```

Example:

```ts
import { ZavorthClient } from '@zavorth/client';

const client = new ZavorthClient({
  baseUrl: 'http://127.0.0.1:33333',
  defaultTimeoutMs: 8000,
});

const status = await client.getGatewayStatus();
const catalog = await client.getPlatformCatalog({ query: 'openrouter' });
```

Generic call:

```ts
const payload = await client.requestJson('GET', '/api/v1/status');
```

## Python

If a Python interpreter is available, `py_compile` can be used as an optional local check.

Example:

```python
from zavorth import ZavorthClient

client = ZavorthClient("http://127.0.0.1:33333")
status = client.get_gateway_status()
```

Generic call:

```python
payload = client.request_json("GET", "/api/v1/status")
```

## Errors

SDK errors should carry:

- HTTP status;
- stable error code;
- user-facing message;
- structured details;
- raw response body when available.

## Examples

- `examples/clients/simple-bot.ts`;
- `examples/clients/simple-bot.py`;
- `examples/clients/public-ecosystem-contracts.ts`.

