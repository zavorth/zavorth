# Specification-Driven Development no Zavorth

Esta pasta passou a ser a base do fluxo de SDD do Zavorth.

O objetivo aqui nao e substituir a documentacao ja existente, e sim separar claramente:

- `docs/` para visao, roadmap, operacao e material publicado
- `specs/` para especificacao viva que antecede e orienta implementacao

## Como ler a pasta

Arquivos ja existentes na raiz de `specs/` continuam valendo como base historica e arquitetural:

- [PRD.md](./PRD.md)
- [architecture.md](./architecture.md)
- [agent-loop.md](./agent-loop.md)
- [memory.md](./memory.md)
- [telegram-input.md](./telegram-input.md)
- [telegram-output.md](./telegram-output.md)

Novas features e mudancas devem seguir o fluxo SDD em:

- [constitution.md](./constitution.md)
- [_templates/](./_templates)
- [features/](./features)

## Regras do fluxo

1. toda feature nova nasce em `specs/features/<dominio>/<feature>/`
2. nenhuma implementacao relevante deve comecar sem `spec.md`
3. mudancas estruturais devem atualizar `plan.md` antes do codigo
4. a execucao vai para `tasks.md`
5. requisitos de seguranca, tenant, surfaces e rollout nao podem ficar implicitos

## Estrutura padrao por feature

Cada feature deve ter:

- `spec.md`
- `plan.md`
- `tasks.md`

E, quando entrar no loop multiagente orientado por SDD:

- `run-state.json`
- `handoff.md`

## Dominios recomendados

Para manter o SDD transversal ao Zavorth inteiro, use dominios espelhando o runtime real:

- `features/runtime/`
- `features/security/`
- `features/orchestrator/`
- `features/telegram/`
- `features/discord/`
- `features/web/`
- `features/multisurface/`
- `features/services/memory/`

## Scaffold rapido

Voce pode gerar uma estrutura minima com:

```bash
npm run specs:scaffold -- --id runtime/nova-feature --title "Nova feature"
```

E pode inspecionar o loop SDD de uma feature com:

```bash
npm run sdd:loop -- --feature runtime/nova-feature
```

## Relacao com plataformas

O SDD aqui vale para qualquer superficie do Zavorth:

- Telegram
- Discord
- Web `/app`
- Dashboard `/classic`
- runtime supervisionado
- sidecars e bridges

Ou seja: a especificacao nao e por plataforma isolada; ela e por feature e deve explicitar o impacto em cada superficie relevante.

## Piloto inicial recomendado

O primeiro ciclo SDD ativo no repo esta ancorado em:

- [features/multisurface/surface-parity-and-tenant-isolation](./features/multisurface/surface-parity-and-tenant-isolation/spec.md)

E a primeira feature executavel derivada desse guarda-chuva e:

- [features/discord/public-channel-rollout](./features/discord/public-channel-rollout/spec.md)
