# Guia de Onboarding & Checklist do Beta Interno - Zavorth

Este documento orienta os desenvolvedores e testadores internos sobre o fluxo de primeiro uso, validação de segurança e endurecimento operacional do Zavorth.

## Passo a Passo para Configuração Local (First-Run)

### 1. Confiar no Workspace
Ao abrir a interface de cockpit do Zavorth:
- Acesse a aba **Workspace**.
- Insira o caminho local do workspace atual.
- Clique em **Confiar neste Workspace**. Isso registra a entrada na base de dados de confiança SQLite e cria os hashes necessários.

### 2. Configurar Provedor de IA (Provider Setup)
- Navegue para a aba **Providers**.
- Clique em **Add Provider** ou edite os provedores padrão de mercado (OpenAI, Anthropic, Google).
- Adicione a sua chave de API Key. A chave será criptografada usando AES-256-GCM antes de ser persistida no banco SQLite. Ela nunca é exposta ou lida pelo frontend.
- Clique em **Test Connection** para realizar um teste de ping sanitizado e certificar-se de que os tokens funcionam sem vazar cabeçalhos confidenciais.

### 3. Ajustar Configurações de Workspace Settings
- Vá para a aba **Workspace Settings**.
- Revise a configuração padrão. Por padrão, a política aplica o perfil **Safe Defaults**:
  - `allowDeveloperMode = false`
  - `allowHostPowerMode = false`
  - `allowPty = false`
  - `allowTemporaryDirectoryTrust = false`
  - `allowProviderFallback = false`
- Selecione o seu **Default IA Provider** e o **Default Model ID**.
- Para habilitar PTY, lembre-se de que o **Host Power Mode** deve obrigatoriamente estar habilitado nas políticas.

### 4. Consultar Readiness e Policy Previews
- Na própria aba de Workspace Settings, consulte o status de **Readiness** do ambiente e os avisos do **Policy Preview**.
- Certifique-se de que todos os avisos em vermelho foram resolvidos (ex: falta de API key ou falta de modelo padrão).

### 5. Executar Tarefa Simples e Segura de Diagnóstico
- Inicie uma tarefa do agente contendo apenas operações seguras de leitura do workspace.
- Acompanhe o fluxo e valide se o agente executa a leitura com sucesso.

### 6. Testar Revogação de Confiança
- Para assegurar a higiene de segurança, acesse a aba **Workspace** e clique em **Revogar Confiança**.
- Valide se os logs de auditoria registram a revogação e se o agente passa a recusar imediatamente qualquer requisição de ferramenta ou comando pendente.
