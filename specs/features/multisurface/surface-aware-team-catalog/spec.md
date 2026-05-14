# Surface-Aware Team Catalog

## Problem

O catalogo de teams/workflows compostos mostra comando, runs e retomadas, mas ainda nao explica em quais superficies cada fluxo pode rodar com seguranca. Isso deixa a UX do `/app` atras da policy real do runtime.

## Goal

Tornar o team catalog surface-aware, refletindo Telegram, web e Discord de acordo com a policy atual do Zavorth.

## Acceptance

- Cada team exposto pelo catalogo declara disponibilidade por superficie.
- O estado do Discord respeita public server mode, owner scope, allowlists e command exposure.
- O `/app` mostra essas superficies dentro dos cards de teams.
- A mudanca nasce com testes focados e build limpo.
