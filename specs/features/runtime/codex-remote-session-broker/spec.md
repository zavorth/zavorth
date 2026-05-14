# Codex Remote Session Broker

## Problem

O `Codex Remote Control Plane` ja consegue expor readiness, perfis e handoff web, mas o Zavorth ainda nao tinha um broker proprio para sessoes long-running do Codex CLI com `attach`, `resume` e tail estruturado de output.

## Goal

Definir a camada de broker do Codex Remote para sair de monitoramento e handoff e evoluir para:

- sessoes persistidas do Codex CLI
- attach e resume seguro por superficie
- streaming de progresso e tail recente
- preparo de sidecar remoto dedicado sem acoplar o runtime ao app desktop
- visibilidade completa de eventos, handoffs e eventuais aprovacoes para o operador

## Functional Requirements

- Deve existir um registry de sessoes do Codex Remote separado do run-state generico.
- Deve existir um broker que consiga iniciar, retomar, interromper e inspecionar sessoes do Codex CLI.
- O broker precisa expor estado seguro para `/app`, Telegram owner-only e surfaces futuras.
- A arquitetura precisa suportar `profile routing` por sessao.
- O detalhe da sessao precisa declarar explicitamente a postura de visibilidade e quantas aprovacoes estao pendentes.
- Se um pedido de permissao existir no futuro, ele nao pode ficar oculto do operador.

## Non-Goals

- Controlar a UI do app desktop do Codex.
- Multiplexar varias sessoes em uma automacao de interface.
- Prometer streaming full em todas as superficies antes do sidecar existir.

## Acceptance Criteria

- Existe spec, plan e tasks da camada de broker.
- A arquitetura do control plane aponta explicitamente para o broker como fase canonica do runtime remoto.
- Os componentes futuros ficam nomeados de forma canonica.
- `inspect` e snapshots equivalentes deixam claro o modo `full-user-visible`.
