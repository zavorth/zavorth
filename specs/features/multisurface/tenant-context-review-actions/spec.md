# Tenant Context Review Actions

## Objective
Promover `review-memoryplane` e `review-sessions` para acoes guiadas reais por tenant, com snapshots operacionais devolvidos pelo backend e navegacao coerente no web app.

## Requirements
- `review-memoryplane` deve executar como acao `guided` e devolver `memoryPlane` atualizado para o tenant selecionado.
- `review-sessions` deve executar como acao `guided` e devolver `sessionPlane` atualizado para o tenant selecionado.
- O snapshot de tenant governance deve expor o contexto minimo necessario para montar essas consultas: `sessionId`, `sourceUserId` e `runtimeUserId`.
- `/api/web/tenants/actions` deve aceitar essas duas acoes e devolver `targetPanel` e `targetWorkspaceView` coerentes.
- O `/app` deve aplicar os snapshots retornados e navegar para a area de historico/contexto sem depender do composer.

## Acceptance
- O operador consegue revisar memoria e sessoes de um tenant pelo `/app` com um clique.
- O demo do `/app` continua funcional e simula essas duas acoes guiadas.
- Testes focados cobrem service, endpoint web e snapshot de governanca.
