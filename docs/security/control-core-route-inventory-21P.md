# ControlCore Route Policy Inventory (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento cataloga o inventário de rotas críticas e de alta prioridade do `ZavorthControlCoreRouteService`, definindo donos de domínio, classes de risco, políticas obrigatórias e referências a testes.

---

## 1. Inventário de Grupos de Rotas

### Grupo 1: Workspace Approvals and Configuration
- **Rotas**: `/api/v2/workspace/approvals/*`, `/api/v2/workspace/agent-config/*`
- **Dono do Domínio**: Workspace Policy / Agent Policy Engine
- **Classe de Risco**: **Critical**
- **Enforcement Obrigatório**:
  - Autenticação local obrigatória (`deps.authService.resolveAuthenticatedIdentity`).
  - Atribuição estrita do `workspaceId` correspondente ao workspace ativo.
  - Rejeição absoluta de caminhos contendo traversals (`..`) ou caminhos absolutos arbitrários.
- **Testes / Gaps Cobertos**:
  - `tests/services/ZavorthControlCoreRouteService.test.ts` (Phase 21J)
  - `tests/services/ZavorthControlCoreRouteBypass.test.ts` (Phase 21P)

### Grupo 2: Temporary Directory Trusts
- **Rotas**: `/api/v2/workspace/temporary-directory-trusts/*`
- **Dono do Domínio**: File System Authority / Temporary Directory Trust
- **Classe de Risco**: **Critical**
- **Enforcement Obrigatório**:
  - Resolução de caminhos físicos reais (`fs.realpathSync`).
  - Revalidação TOCTOU imediata no ponto de uso.
  - Bloqueio de diretórios raiz, pastas de perfil do usuário e caminhos UNC de rede.
- **Testes / Gaps Cobertos**:
  - `tests/services/TemporaryDirectoryTrustAdversarial.test.ts`
  - `tests/mcp/workspace/WorkspaceMcpTemporaryDirectoryTrust.test.ts`

### Grupo 3: Host Commands & PTY Sessions
- **Rotas**: `/api/v2/workspace/pty/*`, `/api/v2/workspace/host-commands/*`
- **Dono do Domínio**: Command Execution boundary
- **Classe de Risco**: **Critical**
- **Enforcement Obrigatório**:
  - Autenticação e autorização explícita do workspace ativo.
  - Aprovação manual (ou via mandato de tarefa) para cada execução e input de PTY.
  - Validação estrita de workspaceId.
- **Testes / Gaps Cobertos**:
  - `tests/services/ZavorthControlCoreRouteBypass.test.ts`

### Grupo 4: Provider & Secret Configuration
- **Rotas**: `/api/v2/providers/*`
- **Dono do Domínio**: Cryptographic Secret Store
- **Classe de Risco**: **High**
- **Enforcement Obrigatório**:
  - Redação total de `rawKey`, `authTag` e `ciphertext` em qualquer resposta da API.
  - Ocultação sistemática do metadado `secretRef` e tratamento de `suffix` como sensível leve (só exibido em UI local confiável).
- **Testes / Gaps Cobertos**:
  - `tests/services/ProviderSecretMetadataLeak.test.ts`
  - `tests/apps/zavorth-desktop/ProviderSecretMetadataUiLeak.test.tsx`
  - `tests/cli/ProviderSecretMetadataCliLeak.test.ts`

### Grupo 5: Gateway Webhooks
- **Rotas**: `/api/webhooks/*`
- **Dono do Domínio**: Channel Interface / Webhook Gateway
- **Classe de Risco**: **Medium**
- **Enforcement Obrigatório**:
  - Validação de tokens de verificação e payloads de canais (Slack, WhatsApp, Instagram).
  - Bloqueio downstream de execuções de ferramentas para usuários sem permissão (`channelUserIdAllowed === false`).
- **Testes / Gaps Cobertos**:
  - `tests/channels/WhatsAppCentralToolExecutionBoundary.test.ts`
  - `tests/runtime/agent/ChannelToolExecutionPolicy.test.ts`
