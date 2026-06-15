# Zavorth - Product QA Report (Phase 21O)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este relatório resume os resultados do controle de qualidade (QA) do fluxo principal do cockpit, interface de usuário e terminal (CLI) do Zavorth.

---

## 1. QA do Fluxo Feliz (Happy Path)

Validamos a experiência ideal de primeiro uso e fluxo contínuo.

- **Dashboard/Cockpit Carrega**: **PASS**. Elementos renderizam instantaneamente com transições suaves e sem flashes ou atrasos visuais perceptíveis.
- **Workspace Confiável**: **PASS**. O card de Workspace exibe claramente o caminho local e o status confiável com um indicador visual verde.
- **Provider Configurado**: **PASS**. Mostra o nome do provedor ativo com máscara segura para chaves e credenciais.
- **Model Default Selecionado**: **PASS**. Identifica corretamente o modelo em uso para as requisições principais de chat e ferramentas.
- **Runtime Ready**: **PASS**. O status geral de prontidão fica verde quando o provedor e o workspace estão 100% corretos.
- **Diagnostics sem Alerta Crítico**: **PASS**. O painel de diagnósticos exibe checkmarks verdes para todas as checagens ativas.
- **Policy Preview Claro**: **PASS**. Mostra as permissões vigentes (HPM, PTY, Developer Mode) de forma compacta e direta.
- **Safe Defaults Visíveis**: **PASS**. Fica explícito que a execução automática está bloqueada e que comandos perigosos exigem intervenção humana.
- **Tarefa Simples Segura Compreensível**: **PASS**. Solicitações básicas de leitura e análise ocorrem sem interrupção de segurança.
- **Approvals Claras**: **PASS**. O prompt de autorização de comandos exibe o comando completo, diretório de execução e riscos associados.
- **CLI Status Organizado**: **PASS**. A inicialização da CLI exibe um bloco estruturado de informações gerais do agente.
- **CLI Help Compreensível**: **PASS**. A saída de ajuda está padronizada e legível.

---

## 2. QA dos Estados Degradados (Degraded States)

Análise de usabilidade e tratamento humano de falhas do produto.

### Estado A: Sem Workspace
- **O que aconteceu**: O app iniciou sem um diretório de trabalho ativo.
- **Por que aconteceu**: O usuário abriu o Zavorth pela primeira vez e não selecionou uma pasta de projeto.
- **O que fazer agora**: Escolher uma pasta local usando o botão "Selecionar Pasta" no Cockpit.
- **Risco**: Nenhum. O agente fica em modo de leitura apenas e não pode interagir com arquivos.

### Estado B: Workspace Não Confiável
- **O que aconteceu**: O card do workspace ficou amarelo e exibiu a mensagem de "Não Confiável".
- **Por que aconteceu**: O diretório aberto não está marcado na lista de caminhos confiados pelo usuário.
- **O que fazer agora**: Clicar em "Confiar no Workspace" para habilitar execução de ferramentas ou mudar para um workspace confiável.
- **Risco**: Risco controlado. O agente está impedido de executar qualquer comando ou ler arquivos confidenciais até aprovação.

### Estado C: Sem Provider
- **O que aconteceu**: O indicador de IA exibe "Nenhum Provedor Ativo".
- **Por que aconteceu**: Nenhuma credencial de provedor de modelo de linguagem foi inserida.
- **O que fazer agora**: Acessar o Setup de Provedores e configurar um serviço (como Anthropic, OpenAI ou Gemini).
- **Risco**: Nenhum. O agente apenas avisa que não consegue processar mensagens de texto.

### Estado D: Provedor Configurado mas Sem Modelo Default
- **O que aconteceu**: O provedor está ativo, mas o modelo selecionado está vazio.
- **Por que aconteceu**: Falha na seleção do perfil de LLM padrão.
- **O que fazer agora**: Selecionar um modelo da lista recomendada na aba de Configurações.
- **Risco**: Nenhum. O agente aguarda seleção antes de enviar prompts.

### Estado E: Provedor Inválido / Erro de Rede / Timeout
- **O que aconteceu**: A chamada ao provedor de IA falhou.
- **Por que aconteceu**: Instabilidade na internet do usuário ou serviço da API de IA temporariamente indisponível.
- **O que fazer agora**: Verificar a conexão local de rede ou tentar novamente mais tarde.
- **Risco**: Nenhum. O erro é normalizado de forma amigável, ocultando detalhes de rede brutos.

### Estado F: API Key Ausente
- **O que aconteceu**: O provedor de IA selecionado não possui chave de API configurada.
- **Por que aconteceu**: O provedor foi adicionado mas a chave secreta foi deixada em branco ou excluída.
- **O que fazer agora**: Cadastrar a chave de API correta através do painel de Configurações.
- **Risco**: Nenhum. O agente impede chamadas e exibe aviso amigável.

### Estado G: Runtime Not Ready / Diagnostics Warning
- **O que aconteceu**: O indicador geral mostra status amarelo/vermelho.
- **Por que aconteceu**: Algum requisito de segurança ou configuração do workspace está pendente (ex: pasta não confiável).
- **O que fazer agora**: Clicar no painel de Diagnósticos e corrigir os itens marcados com aviso.
- **Risco**: O agente recua para postura passiva.

### Estado H: Approval Pendente
- **O que aconteceu**: O painel de aprovações exibe uma solicitação esperando resposta do usuário.
- **Por que aconteceu**: O agente propôs um comando do host ou alteração de arquivo que exige confirmação.
- **O que fazer agora**: Revisar o comando proposto e clicar em "Aprovar" ou "Negar".
- **Risco**: O agente fica suspenso e não executa o comando até a aprovação.

### Estado I: Approval Negada
- **O que aconteceu**: A tarefa falhou com aviso de comando recusado.
- **Por que aconteceu**: O usuário clicou em "Negar" no prompt de aprovação.
- **O que fazer agora**: Ajustar a solicitação ou fornecer orientações alternativas ao agente no chat.
- **Risco**: Nenhum. O comando bloqueado não causou efeitos colaterais.

### Estado J: HPM / PTY / Developer Mode Bloqueado
- **O que aconteceu**: A funcionalidade solicitada pelo agente foi imediatamente recusada pelo sistema de políticas.
- **Por que aconteceu**: Estes modos trazem riscos altos de integridade e estão desativados por padrão nas políticas de segurança globais do workspace.
- **O que fazer agora**: Para habilitá-los, modifique as permissões de segurança na aba de Configurações do Workspace.
- **Risco**: Proteção máxima do host ativa.
