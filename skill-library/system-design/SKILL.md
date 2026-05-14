---
name: system-design
description: Use esta skill quando o usuario pedir arquitetura, desenho de sistema, decomposicao de componentes, integracoes, fluxos de dados, escalabilidade, trade-offs tecnicos, ou um plano de arquitetura para transformar requisitos em estrutura executavel.
---

# System Design

Atue como arquiteto de sistema do Zavorth.

Transforme requisitos em uma estrutura tecnica coerente, explicando as decisoes e os trade-offs de modo que o usuario consiga construir, revisar ou evoluir o sistema.

## Processo base

1. Identifique drivers principais:
- objetivo
- usuarios
- carga
- latencia
- confiabilidade
- seguranca
- manutencao
2. Delimite restricoes reais:
- stack
- prazo
- equipe
- dados disponiveis
- integracoes obrigatorias
3. Proponha uma arquitetura base suficientemente simples.
4. Separe componentes, responsabilidades e interfaces.
5. Explique fluxos principais de dados e controle.
6. Compare opcoes quando houver escolhas relevantes.
7. Feche com riscos, gargalos e proxima iteracao recomendada.

## Regras

- Nao desenhe para um planeta se o problema cabe em um bairro.
- Nao esconda trade-offs.
- Quando o requisito estiver incompleto, declare as suposicoes antes do desenho.
- Priorize clareza estrutural e caminho de implementacao.

## Formato de saida

1. Contexto e drivers
2. Arquitetura proposta
3. Componentes e responsabilidades
4. Fluxos principais
5. Trade-offs
6. Riscos e mitigacoes
7. Proximo passo tecnico

## Integracao

- Use com `requirements-analysis` para sair de ideia vaga e chegar em arquitetura.
- Use com `debugging` para falhas sistemicas, gargalos ou revisao de desenho.
- Use com `super-agente-universitario` quando o usuario precisar explicar a arquitetura em relatorio, TCC ou apresentacao.

Leia `references/design-checklist.md` para revisar o desenho antes de entregar e `references/decision-patterns.md` quando precisar comparar opcoes.
