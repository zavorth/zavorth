# Provider Runtime Audit Attribution (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento estabelece as regras de atribuição de auditoria para chamadas realizadas aos provedores de modelos de IA no Zavorth.

---

## 1. Regras de Atribuição de Auditoria

- **Ameaça**: Chamadas de provedores escopadas a workspaces específicos sendo registradas sob a atribuição genérica `"system"`, dificultando a rastreabilidade e a aplicação de políticas por workspace.
- **Superfície Afetada**: `ProviderInvocationService`, `ProviderRuntimeRouter` e barramento de auditoria de segurança.
- **Controle Existente**: Uso discricionário de `"system"` como fallback padrão de workspaceId.
- **Controle Adicionado**:
  - Toda chamada ao provedor de IA com contexto de workspace deve registrar obrigatoriamente o `workspaceId` real.
  - O workspaceId `"system"` é restrito exclusivamente a rotas de diagnóstico global, exigindo uma justificativa explícita no log.
  - Redação completa de prompts brutos, chaves de API, segredos e respostas cruas nos metadados de auditoria.
- **Testes Adicionados**:
  - `tests/services/ProviderRuntimeAuditAttribution.test.ts`
- **Classificação**:
  - **P1**: Atribuição incorreta ou vazamento de prompt em auditoria -> **Corrigido**.
