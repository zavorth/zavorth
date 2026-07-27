# Zavorth TypeScript SDK

SDK oficial para consumir o contrato REST v1 do Zavorth.

## Instanciacao

```ts
import { ZavorthClient } from '@zavorth/client';

const client = new ZavorthClient({
  baseUrl: 'http://127.0.0.1:33333',
  token: process.env.ZAVORTH_WEB_TOKEN,
  defaultTimeoutMs: 8000,
});
```

## Garantias do cliente

- envia `Accept: application/json` por padrao
- envia `X-Zavorth-SDK` para facilitar troubleshooting do integrador
- suporta `defaultHeaders`, `defaultTimeoutMs` e `requestJson()` para fluxos fora dos atalhos prontos
- converte falhas HTTP em `ZavorthApiError`

## Metodos principais

- `getGatewayStatus()`
- `getGatewayDomains()`
- `getOpsHealth()`
- `getOpsQuality()`
- `listSessions()`
- `getPlatformStatus()`
- `getLearningStatus()`
- `getLearningCandidates()`
- `getLearningMetrics()`
- `approveLearningCandidate()`
- `rejectLearningCandidate()`
- `promoteLearningCandidate()`
- `getMemoryStatus()`
- `getMemoryMetrics()`
- `searchMemory()`
- `getMemoryProcedures()`
- `listNodes()`
- `listTransports()`
- `listArtifacts()`
- `requestJson()`

## Contratos publicos de ecossistema

This SDK talks to REST v1. It does not export internal runtime classes,
Telegram ou zavorthControl como API publica.

Para adapters, tools, skills e surfaces dentro do repo, use o manifesto em
`src/runtime/agent/contracts/index.ts`:

- `PUBLIC_ECOSYSTEM_CONTRACT_VERSION`
- `PUBLIC_ECOSYSTEM_CONTRACTS`
- aliases como `NormalizedInboundMessage`, `AgentRunResult`,
  `ToolExposureProfile`, `PublicSkillSnapshot`,
  `PublicMcpCapabilitySnapshot` e `PublicToolSurfaceSnapshot`

O exemplo oficial que combina SDK REST e manifesto publico e:

- `examples/clients/public-ecosystem-contracts.ts`

## Exemplo rapido

```ts
const learning = await client.getLearningCandidates();
const learningMetrics = await client.getLearningMetrics();
const procedures = await client.getMemoryProcedures();
const quality = await client.getOpsQuality();

if (learning.summary.pending > 0) {
  await client.promoteLearningCandidate(learning.data[0].id);
}

console.log('procedimentos:', procedures.total);
console.log('learning avg score:', learningMetrics.summary.averageScore);
console.log('ops quality:', quality.score);
```

## Requisicao generica

```ts
import { ZavorthApiError } from '@zavorth/client';

try {
  const payload = await client.requestJson('GET', '/api/v1/platform/catalog', {
    query: { q: 'openrouter' },
  });
  console.log(payload.summary);
} catch (error) {
  if (error instanceof ZavorthApiError) {
    console.error(error.status, error.code, error.message);
  }
}
```

## Build local

```bash
npm exec tsc -p sdk/typescript/tsconfig.json
```

## Examples oficiais

- `examples/clients/simple-bot.ts`
- `examples/clients/public-ecosystem-contracts.ts`
- `examples/clients/simple-bot.py`
