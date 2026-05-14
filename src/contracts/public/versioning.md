# Zavorth Public Contracts Versioning

Este documento define a politica de versionamento e evolucao dos contratos publicos do Zavorth, garantindo que clientes externos (Frontends, Nodes, Plugins e Integracoes) possam depender da API de forma confiavel e previsivel.

## Principios

1. **Retrocompatibilidade Rigorosa**: Nenhuma mudanca que quebre a compatibilidade (breaking change) deve ser introduzida em uma versao menor (minor) ou de patch.
2. **Versionamento Explicito**: Todas as APIs REST, esquemas de Eventos (SSE/WebSocket) e schemas JSON sao versionados no proprio path ou payload (ex: `/api/v1/sessions` ou `{ "version": "1.0", "type": "..." }`).
3. **Erros Canonicos**: O formato de retorno de erro e padronizado para todas as respostas. Nenhuma variacao ad-hoc e permitida na camada publica.
4. **DTOs Puros**: Os objetos de transferencia de dados publicos (`DTOs`) nao vazam detalhes de implementacao do runtime interno nem modelos diretos de banco de dados.

## Schemas e Tipos

Todos os schemas de interacao com a superficie do Zavorth estao definidos em TypeScript e exportados neste modulo.
Quando distribuirmos os SDKs, estes serao os tipos gerados e consumidos publicamente.

## Dominios de Superficie

A API publica e dividida nos seguintes dominios canonicos:
- `sessions`: Gestao de sessoes, conversa, historico e replay.
- `gateway`: Informacoes globais de runtime e entrada.
- `platform`: Catalogo de plugins, skills, MCPs e instalacoes.
- `nodes`: Gestao do Node Mesh, companions, devices e pareamento.
- `transports`: Transportes remotos, observabilidade remota e rotas.
- `ops`: Operacoes estruturais, health, doctor e maintenance.
- `artifacts`: Acesso estruturado aos artefatos extraidos ou gerados.

## Lifecycle de Versoes

- **Alpha/Beta**: Path `/api/beta/*` ou `/api/alpha/*`. Sem garantias de compatibilidade. Usado para testar novas superficies.
- **v1 (Atual)**: Path `/api/v1/*`. Estavel. Apenas adicoes permissivas (novos campos opcionais, novos endpoints).
- **Deprecacao**: Campos obsoletos serao marcados no TS doc com `@deprecated` por pelo menos uma versao maior ou longa janela minor antes de remocao, se necessario.
