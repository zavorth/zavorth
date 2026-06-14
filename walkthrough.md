# Zavorth Autonomy & Permissions Roadmap - Phase 21G Completed

A Fase 21G do roadmap "Zavorth Autonomy & Permissions" introduziu terminais PTY interativos com governança rígida sobre os inputs do agente.

## 🛠️ Mudanças Realizadas (Fase 21G)
- **Painel PTY (`PtyTerminalPanel.tsx`)**: Integrado ao DesktopShell, permite a visualização (somente-leitura) de terminais iniciados pelo agente autonomamente, mas controlados por policy.
- **Fail-Closed `node-pty` Service**: O `PtySessionService` foi implementado para encapsular a sessão `node-pty`. Retorna `PTY_UNAVAILABLE` em vez de um spawn de processo cego invisível se o PTY falhar no SO alvo.
- **PtyInputPolicyService**: Todas as escritas usando a ferramenta `workspace.pty.write` requerem escaneamento dessa policy.
  - Inputs neutros (ex: `ls`, `cat`) são permitidos.
  - Inputs categorizados como `HIGH` / `CRITICAL` dependem de aprovação (`PTY_INPUT_APPROVAL_REQUIRED`).
- **Teardown Mapeado**: Quando o Host Power Mode é desligado via `HostPowerModeService.disable()`, todas as sessões PTY abertas para aquele Workspace são imediatamente terminadas, sem persistência remanescente.
- **Integração de Segurança**: Nenhuma string crua sensível (como stdout cru ou secrets no environment) é persistida em banco de dados; hashes ou outputs anonimizados estão incluídos.

## 🧪 Validação
- `npx jest` cobrindo o HostPowerModeService / Approval Services confirmou que não há logs de banco quebrando e as callbacks de desativação funcionam.
- Os gateways (`surfaces:check` e `runtime:check`) apontam zero erros de TypeScript com as novas rotas em `ZavorthControlCoreRouteService.ts` resolvidas, testando que PTY Tools extendem com sucesso a `BaseTool`.
- O build do frontend (`npm --prefix apps/zavorth-desktop run build`) passou com Vite.

Tudo devidamente comitado no branch local. Prontos para a próxima instrução!
