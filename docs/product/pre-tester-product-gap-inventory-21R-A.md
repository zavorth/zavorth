# Inventário de Gaps de Produto - Fase 21R-A

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Este documento é parte do gate de completude pré-tester local.

Este inventário registra a auditoria detalhada de cada fluxo de usabilidade do Zavorth, analisando atritos e classificando severidades para certificar que o produto está pronto para homologação controlada.

---

## Relação Completa dos Fluxos Auditados

### 1. First Launch
- **Flow name**: First Launch
- **Expected user understanding**: O usuário deve abrir o aplicativo pela primeira vez e ver o app inicializar sem crash, exibindo uma interface limpa.
- **Current state**: O desktop (Vite/Electron) abre e inicializa o banco SQLite local com sucesso.
- **Friction found**: Nenhuma. O carregamento inicial é rápido e o shell de UI é renderizado imediatamente.
- **Severity**: ACCEPTABLE
- **Evidence**: `ProductDemoFlow.test.tsx` (teste de renderização do cockpit).
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 2. Onboarding
- **Flow name**: Onboarding Inicial
- **Expected user understanding**: O usuário deve entender como configurar sua área de trabalho e chaves básicas de API.
- **Current state**: O fluxo de onboarding guia o usuário na criação do diretório inicial de configurações.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `ZavorthCliDemoFlow.test.ts` (validação de onboarding).
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 3. Workspace Selection/Setup
- **Flow name**: Workspace Selection/Setup
- **Expected user understanding**: O usuário deve conseguir selecionar a pasta raiz (workspace) onde o agente irá atuar e entender quais permissões de leitura/escrita são dadas.
- **Current state**: O painel lateral permite selecionar o diretório do workspace atual.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `AgentWorkspaceSettingsPanel.test.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 4. Workspace Trust/Readiness
- **Flow name**: Workspace Trust/Readiness
- **Expected user understanding**: O usuário precisa entender se o diretório selecionado é confiável (trusted) ou restrito.
- **Current state**: O painel exibe "Trusted" ou "Restricted" com base no mapeamento de confiança do diretório do runtime.
- **Friction found**: Nenhuma. O banner superior alerta claramente se o diretório precisa de autorização de confiança.
- **Severity**: ACCEPTABLE
- **Evidence**: `WorkspaceRuntimeReadinessCard.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 5. Provider Setup
- **Flow name**: Provider Setup
- **Expected user understanding**: O usuário deve conseguir cadastrar segredos (como OpenAI API Key) com mascaramento visual adequado para evitar vazamentos acidentais.
- **Current state**: O modal de setup do provedor mascara a chave de API e apenas expõe o sufixo nas consultas locais.
- **Friction found**: Nenhuma. Os campos de chave de API são mascarados por padrão.
- **Severity**: ACCEPTABLE
- **Evidence**: `ProviderSecretMetadataUiLeak.test.tsx` e `ProviderSetupModal.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 6. Model/Provider Status
- **Flow name**: Model/Provider Status
- **Expected user understanding**: O usuário deve saber se a conexão com o LLM está ativa ou com pendência de configuração.
- **Current state**: O cockpit exibe "Pronto" ou "Pendente" com status de conectividade do provedor.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `ProviderRuntimeStatus.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 7. Cockpit/Dashboard
- **Flow name**: Cockpit/Dashboard
- **Expected user understanding**: O usuário deve ter um resumo visual completo do estado do agente (saúde do runtime, provedor configurado, permissões de segurança).
- **Current state**: O `CockpitDashboard` consolida essas informações de forma centralizada e limpa.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `CockpitDashboard.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 8. Diagnostics
- **Flow name**: Diagnostics
- **Expected user understanding**: O usuário deve visualizar se há alertas de segurança ou configurações recomendadas falhando.
- **Current state**: O painel de diagnósticos lista os checks de integridade (PTY, HPM, chaves do provedor).
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `InternalBetaDiagnosticsPanel.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 9. Approvals
- **Flow name**: Approvals
- **Expected user understanding**: O usuário deve ver claramente a contagem de comandos que aguardam aprovação manual antes da execução pelo agente.
- **Current state**: O painel do cockpit exibe um indicador com a contagem de aprovações pendentes em destaque.
- **Friction found**: Nenhuma. A interface alerta o usuário com cores adequadas (vermelho/verde) sobre pendências.
- **Severity**: ACCEPTABLE
- **Evidence**: `CockpitDashboard.tsx` (linhas 191-196)
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 10. Safe Execution Path
- **Flow name**: Safe Execution Path
- **Expected user understanding**: O usuário deve ser guiado para rodar tarefas apenas dentro dos limites do diretório de desenvolvimento confiado.
- **Current state**: O runtime bloqueia tentativas de escrita/leitura fora da pasta confiada com mensagens claras.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `TemporaryDirectoryTrustService.ts`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 11. Blocked/Denied Tool State
- **Flow name**: Blocked/Denied Tool State
- **Expected user understanding**: Quando uma ferramenta for bloqueada por política (ex: PTY ou HPM desativados), o usuário deve entender o motivo sem achar que é um travamento ou bug do app.
- **Current state**: O app exibe o motivo específico do bloqueio (ex: "workspace-config-denied-pty") e loga o evento de forma auditável.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `ToolExposurePolicy.ts`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 12. CLI Help/Status/Demo Flow
- **Flow name**: CLI Help/Status/Demo Flow
- **Expected user understanding**: O usuário executando via terminal deve descobrir comandos básicos e conferir a integridade do runtime.
- **Current state**: Comandos `zavorth status`, `zavorth doctor` e `zavorth --help` estão totalmente disponíveis e documentados.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `tests/cli/ZavorthCliDemoFlow.test.ts`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 13. Error Messages
- **Flow name**: Error Messages
- **Expected user understanding**: Mensagens de erro devem conter explicações legíveis e ações de correção claras.
- **Current state**: As mensagens técnicas do SQLite e de autenticação são normalizadas para exibição limpa.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `tests/services/ErrorNormalizationService.test.ts`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 14. Empty States
- **Flow name**: Empty States
- **Expected user understanding**: Se não houver provedores, aprovações pendentes ou workspaces cadastrados, o app deve indicar o que fazer a seguir, em vez de exibir uma tela em branco.
- **Current state**: O cockpit renderiza avisos claros com links e botões como "Start Runtime" ou "Configure um Provedor".
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `ProductEmptyStates.test.tsx`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 15. Loading States
- **Flow name**: Loading States
- **Expected user understanding**: Durante buscas de dados assíncronas do banco de dados, o usuário deve saber que o app está carregando informações.
- **Current state**: O dashboard e modais exibem mensagens legíveis (ex: "Carregando cockpit do agente...").
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `CockpitDashboard.tsx` (linhas 56-62)
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 16. Danger/Warning States
- **Flow name**: Danger/Warning States
- **Expected user understanding**: O usuário deve entender imediatamente as opções que oferecem alto risco à integridade do host.
- **Current state**: O cockpit usa crachás (StatusBadge) com a cor de aviso (warning) amarela para HPM e PTY habilitados.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `CockpitDashboard.tsx` (linhas 146-184)
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 17. Reset/Removal Guidance
- **Flow name**: Reset/Removal Guidance
- **Expected user understanding**: O usuário deve conseguir limpar ou desinstalar o app sem deixar rastros ou dados órfãos.
- **Current state**: O processo está detalhadamente descrito no manual de remoção e rollback.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `internal-tester-rollback-reset-guide-21Q.md`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.

---

### 18. Tester Kit Comprehension
- **Flow name**: Tester Kit Comprehension
- **Expected user understanding**: As instruções do kit de teste devem corresponder perfeitamente ao comportamento e telas do app real.
- **Current state**: O manual da Fase 21Q está alinhado com as telas, caminhos e limites de segurança auditados.
- **Friction found**: Nenhuma.
- **Severity**: ACCEPTABLE
- **Evidence**: `tests/docs/InternalTesterDeliveryDocsIntegrity.test.ts`
- **Fix implemented**: no
- **Remaining gap**: Nenhum.
- **Decision**: Liberado.
