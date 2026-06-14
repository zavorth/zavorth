# Verification Report: Phase 21G (Governed Interactive PTY)

## Overview
A Fase 21G (Interactive PTY terminal governed by autonomy policy) foi totalmente implementada e testada. 

As seguintes regras e mandatos foram rigorosamente aplicados:
1. **Sessão PTY aprovada não libera autopilot**: A entrada no terminal é governada pelo `PtyInputPolicyService`. O fluxo de gravação via ferramenta `workspace.pty.write` passa obrigatoriamente pela policy engine e requer aprovações (`PTY_INPUT_APPROVAL_REQUIRED`) caso o risco seja HIGH ou CRITICAL.
2. **Host Power Mode é mandatório para manter a sessão viva**: A inicialização requer Host Power Mode ligado. O `HostPowerModeService.disable()` agora notifica ouvintes. O `PtySessionService` foi acoplado via `onDisableCallback`, efetuando teardown imediato (`terminateAllForWorkspace`) de qualquer PTY vivo quando o Power Mode expira ou é desativado.
3. **Auditoria e Proteção contra Vazamento (Não persistência de CWD e RAW)**: O `PtySessionService` foi implementado fail-closed (bloqueia fallback se `node-pty` faltar). O SQLite NÃO persiste dados de RAW output (`data`) nem de `cwd`. Estes são guardados estritamente em memória volátil, apenas com `sessionId`, hashes, e `risk_level` sendo guardados no banco de dados. Eventos `pty_session_proposed`, `pty_session_approved`, e `pty_session_terminated` são registados auditavelmente no `SecurityAuditLogger`.

## Git Status Verification

### 1. `git show --stat --name-status --oneline HEAD`
```text
d5d84ad fix(pty): Resolve TS compiler errors for PTY tools integration
M       src/bootstrap/bootstrapToolRuntime.ts
M       src/services/ZavorthControlCoreRouteService.ts
M       src/tools/workspace/PtySessionProposeTool.ts
M       src/tools/workspace/PtyTerminateTool.ts
M       src/tools/workspace/PtyWriteTool.ts
 5 files changed, 18 insertions(+), 13 deletions(-)

0a749ea feat(pty): Implement governed interactive PTY sessions (Phase 21G)
M       apps/zavorth-desktop/src/apiClient.ts
M       apps/zavorth-desktop/src/shell/DesktopShell.tsx
A       apps/zavorth-desktop/src/shell/PtyTerminalPanel.tsx
A       scratch/append_pty_routes.js
M       src/bootstrap/bootstrapToolRuntime.ts
M       src/security/AgentToolSecurityCatalog.ts
M       src/services/HostPowerModeService.ts
A       src/services/PtyInputApprovalService.ts
A       src/services/PtyInputPolicyService.ts
A       src/services/PtySessionApprovalService.ts
A       src/services/PtySessionService.ts
M       src/services/SecurityAuditLogger.ts
M       src/services/ZavorthControlCoreRouteService.ts
M       src/storage/Database.ts
A       src/tools/workspace/PtySessionProposeTool.ts
A       src/tools/workspace/PtyTerminateTool.ts
A       src/tools/workspace/PtyWriteTool.ts
M       src/tools/workspace/index.ts
 18 files changed, 1475 insertions(+), 13 deletions(-)
```

### 2. `git status --short`
```text
(Vazio - nenhum arquivo pendente)
```

### 3. `git diff --check`
```text
(Vazio - sem erros de whitespace)
```

## Desktop UI e Tools
- Foi adicionado o painel `PtyTerminalPanel` visível e fixado como overlay na interface do Desktop, garantindo visibilidade nativa do stdout/stderr.
- Os handlers no `ZavorthControlCoreRouteService` utilizam endpoints em `/api/v2/workspace/pty/*` para `output`, `propose`, `resolve-session`, `resolve-input`, e `terminate`.
- Foram introduzidas três novas native tools expostas estritamente no runtime governado:
  - `workspace.pty.propose`
  - `workspace.pty.write`
  - `workspace.pty.terminate`

## Conclusão
O roadmap obrigatório (Fase 21A até 21G) foi concluído sem falhas de sintaxe e sem burlar os mecanismos de governança estrita de permissões de input. O terminal agora suporta output visível no frontend e garante encerramento hard-closed assim que a janela de "Host Power Mode" do Workspace se fecha.
