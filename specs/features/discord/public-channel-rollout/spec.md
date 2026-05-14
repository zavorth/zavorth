# Spec: Rollout publico por canais no Discord

**Feature ID:** `discord/public-channel-rollout`  
**Status:** active  
**Escopo:** `specs/features/discord/public-channel-rollout`

## 1. Problema

O gateway nativo do Discord ja esta online, mas o tenant compartilhado do servidor publico ainda fica em `pending_onboarding` enquanto `DISCORD_ALLOWED_CHANNEL_IDS` nao estiver fechado e refletido corretamente no runtime.

## 2. Objetivo

Concluir o rollout seguro do Discord publico por canais allowlisted, sem abrir operacao sensivel nem gerar falso pronto em readiness.

## 3. Requisitos Funcionais

- RF-01: o runtime deve aceitar trafego apenas dos canais explicitamente permitidos.
- RF-02: o onboarding do tenant compartilhado deve sair de `pending_onboarding` quando a policy minima estiver satisfeita.
- RF-03: o Discord deve expor apenas o subconjunto de comandos aprovado para servidor publico.

## 4. Requisitos De Seguranca

- RS-01: comandos operacionais permanecem owner-only/operator-only.
- RS-02: canais fora da allowlist devem ser ignorados ou bloqueados de forma explicita.
- RS-03: readiness nao pode reportar o Discord como pronto para producao enquanto faltar policy por canal.

## 5. Impacto Por Superficie

- Telegram: continua rota privilegiada de recuperacao.
- Discord: superficie principal dessa feature.
- Web: readiness e diagnostics devem refletir o estado real do rollout.
- Runtime supervisionado: sem regressao no boot por policy incompleta.

## 6. Tenancy E Governanca

- Tenant impactado: `discord:guild:*`
- Policy profile: `discord-public-guild`
- Owner/operator implications: owner define canais; publico recebe apenas subset seguro de interacao.

## 7. Observabilidade E Operacao

- Logs: bloqueios por canal, slash commands ignorados, onboarding completo.
- Auditoria: comandos aceitos, negados e aprovacoes.
- Health/readiness: deve trocar de pendente para pronto quando os canais estiverem fechados.
- Rollout: gradual por canal.
- Rollback: remover canal da allowlist deve voltar o bloqueio imediatamente.

## 8. Criterios De Aceitacao

- CA-01: apenas canais allowlisted aceitam interacao do Zavorth.
- CA-02: o tenant compartilhado sai de `pending_onboarding`.
- CA-03: `ops:access` deixa de apontar a pendencia de onboarding do Discord.

## 9. Nao Objetivos

- NO-01: abrir o Zavorth em todos os canais do servidor.
- NO-02: paridade total de UX com Telegram.

## 10. Open Questions

- Q-01: quais canais iniciais serao liberados no servidor real?
