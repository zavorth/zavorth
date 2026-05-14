# Spec

## Feature

`multisurface/tenant-guided-textual-actions`

## Objective

Fechar a paridade textual da governanca por tenant para que Telegram, Discord owner-only e CLI possam executar acoes guiadas de tenant sem depender exclusivamente do `/app`.

## Requirements

- `/tenants` deve continuar suportando listagem e filtro por tenant/surface.
- A surface textual deve aceitar um modo explicito para executar acoes guiadas por tenant.
- A surface textual deve suportar execucao implicita quando `tenantId` e `actionId` forem fornecidos de forma inequívoca.
- A execucao deve reutilizar o control plane canonico de tenant actions.
- A ajuda e o catalogo de comandos devem documentar a sintaxe textual nova.
- O CLI deve normalizar `teams` e `tenants` como comandos compartilhados.

## Acceptance

- `SharedSurfaceCommandService` executa `inspect/review` e reviews iniciados por workflow via `/tenants`.
- `Telegram` e `Discord owner-only` recebem a mesma sintaxe textual.
- O `CLI` aceita `tenants ...` sem exigir barra manual.
- Testes focados e build passam.
