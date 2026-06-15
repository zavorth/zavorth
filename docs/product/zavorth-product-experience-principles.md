# Princípios de Experiência de Produto do Zavorth

Este documento estabelece as diretrizes de design e usabilidade para as interfaces do Zavorth, garantindo consistência entre a UI Desktop, a CLI e as saídas do agente.

## Princípios Centrais

### 1. Seguro por Padrão (Safe by Default)
* Todos os privilégios perigosos (Developer Mode, Host Power Mode, PTY, Temporary Directory Trust e Fallbacks) devem vir **desativados** de fábrica.
* A interface nunca deve sugerir ou induzir a ativação de um recurso inseguro de forma automatizada ou sem atrito.

### 2. Clareza e Transparência antes de Poder de Execução
* O usuário deve saber exatamente o que está acontecendo. Preferimos explicar de forma legível e amigável o limite operacional atual do agente em vez de exibir logs complexos de decisão.
* A postura de segurança (readiness e risk assessment) deve estar visível e atualizada em tempo real no dashboard.

### 3. Risco Sempre Visível e Ações Perigosas Explícitas
* Qualquer fluxo que envolva HPM, PTY ou escrita fora do workspace confiado exige diálogos de aprovação (**Approval Cards**) bem destacados, detalhando qual comando/ação será executado, o escopo territorial e as restrições temporais aplicadas.

### 4. Zero Secrets ou Credenciais Expostas
* Tokens de API (padrão `sk-*`), cabeçalhos de autenticação HTTP, senhas de bancos locais e dados brutos de cabeçalhos de requisição de provedores nunca devem aparecer na interface gráfica, na CLI ou nos arquivos de logs de erros.
* Credenciais salvas devem ser representadas unicamente pelo status `[CONFIGURED]`.

### 5. Erros Normalizados e Altamente Humanizados
* Nenhuma exceção não tratada ou erro bruto de rede/banco deve ser exibido ao usuário final.
* Todo erro capturado passa pela normalização unificada do Zavorth para fornecer:
  * **Identificador**: código amigável legível (ex: `missing_key`).
  * **Explicação**: descrição humana em português do que deu errado.
  * **Ação Recomendada**: orientação clara sobre como o usuário pode resolver o problema.

### 6. Cockpit de Onboarding e Próximos Passos
* A interface inicial do Zavorth deve acolher o novo usuário, guiando-o ativamente pelos passos de onboarding sem forçar comandos automáticos perigosos:
  1. Selecionar e Confiar em um Workspace.
  2. Adicionar uma API Key de Provedor.
  3. Escolher o Modelo/Provedor Padrão.
  4. Verificar a Prontidão do Agente no Checklist.
