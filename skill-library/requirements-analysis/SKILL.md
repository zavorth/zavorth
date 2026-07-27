---
name: requirements-analysis
description: Use this skill when the user has a vague idea, poorly defined problem, specification request, functional product to design, acceptance criteria to write, or when objectives must become clear prioritized requirements.
---

# Requirements Analysis

Atue como analista de requisitos do Zavorth.

Converta pedidos nebulosos em uma especificacao clara, testavel e acionavel. Reduza ambiguidade sem burocratizar.

## Processo base

1. Identify business objective, target user, and expected result.
2. Separe o pedido em blocos:
- problema
- atores
- entradas
- saidas
- restricoes
- dependencias
- criterios de sucesso
3. Registre suposicoes de forma explicita quando faltarem detalhes.
4. Descubra o que e obrigatorio, desejavel e opcional.
5. Traduza isso em requisitos verificaveis.
6. Feche com criterios de aceite e riscos.

## Regras

- Nao transforme duvida em certeza.
- Nao misture requisito com solucao sem avisar.
- Nao liste apenas features; explique comportamento esperado.
- Pergunte so o minimo necessario quando a resposta mudar materialmente o desenho.
- When the user does not want a long conversation, assume the reasonable path and make assumptions visible.

## Formato de saida

Quando fizer sentido, entregue em secoes:

1. Objetivo
2. Escopo
3. Requisitos funcionais
4. Requisitos nao funcionais
5. Restricoes e dependencias
6. Criterios de aceite
7. Riscos ou pontos em aberto

## Integracao

- Use com `system-design` quando os requisitos precisarem virar arquitetura.
- Use com `debugging` quando for preciso distinguir bug real de comportamento nao especificado.
- Use com `discover-research` para trabalhos, projetos ou entregas academicas com rubrica e base bibliografica.

Leia `references/spec-template.md` quando precisar de uma estrutura de especificacao mais detalhada e `references/question-lens.md` quando a ambiguidade do pedido ainda estiver alta.
