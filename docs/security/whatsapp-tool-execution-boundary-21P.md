# WhatsApp and Group Tool Execution Boundary (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento detalha o modelo de ameaças e o boundary de controle estabelecido para as interações vindas de canais assíncronos (como WhatsApp e chats de grupo).

---

## 1. Threat Model e Boundary de Controle

- **Ameaça**: Usuário não autorizado em grupo público ou chat privado tenta invocar ferramentas privilegiadas (ex: leitura de workspace, execução de comandos shell, PTY, HPM) injetando prompts no agente.
- **Superfície Afetada**: `ToolExposurePolicy`, `ToolExecutionBoundary`, e adaptadores de canal (`WhatsAppChannelAdapter`).
- **Autoridade Envolvida**: Contextos de mensagens de chat assíncronas do gateway.
- **Controle Existente**: Exclusão de mensagens sem menção/wake word no adaptador. Exposição mitigada com base nas configurações informativas de `groupToolPolicy`.
- **Controle Adicionado**: Enforcement central na exposição de ferramentas e na execução de comandos:
  - Se `channelUserIdAllowed` for `false`, a lista de ferramentas expostas é forçada a ficar **vazia/negada** (postura estrita de `none`).
  - Qualquer solicitação de execução downstream é **rejeitada com erro de acesso** se originada de contexto não autorizado, independente do payload fornecido.
- **Testes Adicionados**:
  - `tests/channels/WhatsAppCentralToolExecutionBoundary.test.ts`
  - `tests/runtime/agent/ChannelToolExecutionPolicy.test.ts`
- **Classificação**:
  - **P0**: Bypass de autoridade por wake word/mencionamento em grupo restrito -> **Corrigido**.
  - **P1**: Usuário não autorizado executa ferramenta com payload customizado -> **Corrigido**.
