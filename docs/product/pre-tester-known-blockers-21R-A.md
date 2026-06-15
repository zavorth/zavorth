# Inventário de Blockers Pré-Tester - Fase 21R-A

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Este documento consolida o inventário de problemas graves ou bloqueios encontrados na jornada do usuário do Zavorth.

---

## 1. Inventário de Blockers Pendentes

```text
No known blockers preventing controlled tester delivery at the time of this review.
```

Durante a auditoria completa de usabilidade e completude conduzida nesta fase (21R-A), nenhum bug ou atrito de fluxo foi classificado na severidade **BLOCKER** (impede que o tester execute as instruções de forma autônoma).

---

## 2. Relação de Itens por Severidade

- **BLOCKER (Zero itens)**:
  - Nenhum vazamento de chave real, bypass de segurança ou travamento catastrófico na abertura foi identificado.
- **SHOULD_FIX (Zero itens)**:
  - As mensagens de diagnóstico e interface web são autoexplicativas e não possuem terminologias vagas de depuração de código interno.
- **ACCEPTABLE (Três itens)**:
  - *Dependência de Node local*: O build do app desktop exige que o testador possua Node instalado. Essa limitação está devidamente documentada nos pré-requisitos do [Plano de Entrega](../beta/internal-tester-delivery-plan-21Q.md).
  - *Chaves LLM locais*: O app exige chaves reais para realizar chamadas no provedor, porém instrui o tester a utilizar limites baixos no manual.
  - *Falso-positivo de PTY*: Ativar o PTY pode gerar logs de aviso frequentes no terminal do desenvolvedor. Classificado como comportamento esperado da auditoria.
- **BACKLOG (Duas melhorias)**:
  - *Onboarding por interface nativa*: Migrar a configuração inicial de terminal para telas gráficas do app Electron.
  - *Instalador automático empacotado*: Gerar instalador auto-executável (`.msi` / `.dmg`) de um clique.
