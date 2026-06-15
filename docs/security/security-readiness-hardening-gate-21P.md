# Security Readiness Hardening Gate (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento formaliza o Security Readiness Hardening Gate para a Fase 21P, consolidando a análise de conformidade de segurança e o veredito final antes de qualquer distribuição interna para testes.

---

## 1. Visão Geral do Gate e Veredito

- **Ameaça**: Acesso não autorizado a APIs locais do agente, vazamento de credenciais AES criptografadas em logs/CLI, e elevação de privilégios de diretórios/ferramentas via prompts não autorizados (WhatsApp/grupos).
- **Veredito**: **`GO_FOR_INTERNAL_TESTER_DELIVERY_PREP`** (sujeito à passagem de todas as suítes de teste de bypass).
- **Critério de GO/NO-GO**: Nenhum problema de severidade P0 ou P1 pendente.

---

## 2. Sumário de Controles e Cobertura

- **WhatsApp/Group Tool Boundary**: Enforcement rígido do parâmetro `channelUserIdAllowed` na exposição e execução central de ferramentas.
- **TemporaryDirectoryTrust**: Threat model detalhado e restrições robustas baseadas em caminhos físicos reais (`fs.realpathSync`) vinculados a `workspaceId`.
- **Provider Audit WorkspaceId Attribution**: Eliminação de atribuições genéricas ("system") em chamadas escopadas a workspaces reais.
- **Provider Secret Metadata Policy**: Tratamento do `suffix` como metadado sensível de baixa intensidade (exposto apenas em superfícies locais explicitamente confiáveis).
- **ControlCore Route Inventory**: Mapeamento completo e testes adversariais de bypass contra requisições malformadas ou sem workspaceId.
