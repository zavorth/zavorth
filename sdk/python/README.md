# Zavorth Python SDK

SDK oficial para consumir o contrato REST v1 do Zavorth.

## Uso basico

```python
from zavorth import ZavorthApiError, ZavorthClient

client = ZavorthClient(
    "http://127.0.0.1:33333",
    token="...",
    timeout=8.0,
)

try:
    status = client.get_gateway_status()
    print(status["status"])
except ZavorthApiError as error:
    print(error.status, error.code, error)
```

## Garantias do cliente

- envia `Accept: application/json` por padrao
- envia `X-Zavorth-SDK` para facilitar troubleshooting
- suporta `default_headers` e `request_json()` para chamadas genericas
- converte falhas HTTP em `ZavorthApiError`

## Metodos principais

- `get_gateway_status()`
- `get_gateway_domains()`
- `get_ops_health()`
- `get_ops_quality()`
- `list_sessions()`
- `get_platform_status()`
- `get_platform_catalog()`
- `get_learning_status()`
- `get_learning_candidates()`
- `get_learning_metrics()`
- `approve_learning_candidate()`
- `reject_learning_candidate()`
- `promote_learning_candidate()`
- `get_memory_status()`
- `get_memory_metrics()`
- `search_memory()`
- `get_memory_procedures()`
- `list_nodes()`
- `list_transports()`
- `list_artifacts()`
- `request_json()`

## Exemplo rapido

```python
learning = client.get_learning_candidates()
learning_metrics = client.get_learning_metrics()
procedures = client.get_memory_procedures()
quality = client.get_ops_quality()

if learning["summary"]["pending"] > 0:
    client.promote_learning_candidate(learning["data"][0]["id"])

print("procedimentos:", procedures["total"])
print("learning avg score:", learning_metrics["summary"]["averageScore"])
print("ops quality:", quality["score"])
```

## Contratos publicos de ecossistema

This SDK talks to REST v1. It is not a runtime SDK and does not export
controllers internos, Telegram, zavorthControl ou servicos do agent loop.

Para contratos de adapters, tools, skills e surfaces dentro do repo, use o
manifesto publico do runtime:

- `src/runtime/agent/contracts/index.ts`
- `PUBLIC_ECOSYSTEM_CONTRACT_VERSION`
- `PUBLIC_ECOSYSTEM_CONTRACTS`
- `docs/product-direction.md`

O Python SDK deve continuar consumindo endpoints como
`/api/v1/platform/catalog`. O manifesto descreve contratos de ecossistema para
integradores TypeScript/runtime sem duplicar DTOs no pacote Python.

## Requisicao generica

```python
payload = client.request_json(
    "GET",
    "/api/v1/platform/catalog",
    query={"q": "openrouter"},
)
print(payload["summary"])
```

## Validacao

O Zavorth valida este SDK de duas formas:

- `npm run sdk:python:check`, que executa `pyright` via Node.js e validates the public SDK structure without depending on Python installed on the host
- `py_compile`, only as an optional extra check when a Python interpreter is available

## Examples oficiais

- `examples/clients/simple-bot.py`
- `examples/clients/simple-bot.ts`
- `examples/clients/public-ecosystem-contracts.ts`
