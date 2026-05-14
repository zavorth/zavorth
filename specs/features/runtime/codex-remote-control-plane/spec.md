# Codex Remote Control Plane

## Problem

O Zavorth ja executa tarefas via Codex CLI, mas ainda nao expoe um plano de controle remoto especifico para acompanhar sessoes, perfis e handoffs do Codex a partir do `/app` ou do mobile.

## Goal

Criar uma arquitetura inicial de `Codex Remote` em cima do Codex CLI, sem depender de automacao fragil do app desktop, com:

- snapshot canonico de readiness e transporte remoto
- nocao de perfis do Codex para futuros cenarios multi-conta e multi-home
- acoes guiadas minimas para selecao de perfil e abertura de sessao web
- visibilidade total ao operador, no mesmo estilo do ZavorthBridge Remote, sem aprovacoes ocultas

## Functional Requirements

- O runtime deve expor um snapshot `codexRemote` com perfil ativo, disponibilidade do Codex CLI e caminhos remotos recomendados.
- O snapshot deve ser legivel na superficie web protegida.
- O operador deve conseguir selecionar o perfil ativo do Codex Remote.
- O operador deve conseguir abrir uma sessao web para handoff e monitoramento remoto do Codex.
- O snapshot deve declarar explicitamente a postura de visibilidade e o numero de aprovacoes pendentes.
- Qualquer pedido sensivel futuro do Codex Remote precisa aparecer ao operador na mesma surface em que ele acompanha a sessao.

## Non-Goals

- Controlar a UI do app desktop do Codex.
- Implementar troca de conta por automacao de navegador.
- Implementar broker completo de multiplos workers Codex.

## Acceptance Criteria

- Existe servico canonico de profile registry para Codex Remote.
- Existe servico canonico de control plane para Codex Remote.
- Existe action service para `select-profile` e `spawn-web-session`.
- O dashboard expoe `/api/web/codex-remote` e `/api/web/codex-remote/actions`.
- O snapshot textual e web comunica que o Codex Remote opera em modo `full-user-visible`.
- Build e testes focados passam.
