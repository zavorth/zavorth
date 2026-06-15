# Zavorth - Demo Flow Script (Phase 21O)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento serve como roteiro narrado passo a passo para demonstrar as capacidades, postura de segurança e interface do Zavorth.

---

## Roteiro Narrado da Demo

### 1. Abertura do App
*(Apresentador abre a janela principal do Zavorth)*
> "Olá! Esta é a tela de início do Zavorth. Ao carregar o app, somos recebidos pelo Cockpit Central, que consolida a postura de segurança e prontidão operacional do nosso agente."

### 2. Leitura do Dashboard/Cockpit
> "Como podem ver, o design do Cockpit Dashboard foi planejado para dar clareza instantânea. No topo, temos o painel de status de prontidão e a visualização rápida do estado de confiança do Workspace ativo."

### 3. Entendimento do Status Geral do Agente
> "Aqui, o indicador de prontidão nos diz se o agente tem tudo o que precisa para operar com segurança, como modelos de IA válidos e políticas de segurança configuradas."

### 4. Escolha/Conferência do Workspace
> "Zavorth trabalha com base em contextos chamados workspaces, que correspondem a diretórios no seu sistema. Vamos selecionar e verificar o nosso workspace atual."

### 5. Workspace Trusted vs Not Trusted
> "Se o diretório for novo ou desconhecido, o Zavorth entra no modo 'Não Confiado'. Isso desativa a execução automática de comandos. Ao confirmarmos que o diretório é seguro, o status muda para 'Workspace Confiável', liberando o fluxo feliz."

### 6. Provider Setup
> "Se precisarmos adicionar ou alterar credenciais de IA, acessamos a aba de configuração de provedores. As chaves de API ficam salvas de forma segura na máquina e nunca são reveladas na interface do usuário."

### 7. Provider/Model Status
> "Vemos aqui que o provedor ativo está com status verde, e o modelo padrão de IA está selecionado e pronto para responder às requisições do agente."

### 8. Readiness
> "O card de prontidão ('Workspace Readiness') nos confirma em tempo real se o provedor, o modelo, o nível de autonomia e a política do workspace estão prontos e compatíveis."

### 9. Diagnostics
> "Qualquer inconsistência — como chaves de API ausentes, erros de rede ou pastas não confiáveis — ativa o painel de Diagnósticos Internos, que avisa o usuário sem expor dados confidenciais."

### 10. Policy Preview
> "Abaixo, o card 'Policy Preview' resume nossa política de postura de segurança ativa. Ele mostra de forma visual o risco geral da nossa sessão (baixo, médio ou alto) e o que o agente pode ou não fazer."

### 11. Approvals e Risk States
> "Por padrão, regras rígidas estão ativas. Recursos como Modo de Energia do Host (HPM), PTY (Terminal Interativo) e Modo Desenvolvedor estão bloqueados por padrão para proteger o sistema."

### 12. Execução de uma Tarefa Simples Segura
> "Com o workspace confiável e o provedor pronto, podemos pedir ao agente uma tarefa simples e segura, como analisar a estrutura de um arquivo. O agente executa e exibe o resultado diretamente na tela principal."

### 13. CLI Initial Status
> "Agora, vamos dar uma olhada na CLI do Zavorth. Ao iniciar o terminal, somos recebidos por um cabeçalho organizado que informa o workspace ativo, o provedor de IA ativo e a postura de segurança padrão."

### 14. CLI Help
> "Ao digitar `zavorth --help` ou apenas pedir ajuda, a CLI lista todos os comandos disponíveis de maneira clara, separando funções seguras e indicando os limites de execução."

### 15. CLI Approval Prompt
> "Se o agente tentar executar um comando que afete o sistema, a CLI intercepta e exibe um prompt de aprovação humana estruturado, mostrando detalhadamente o comando proposto e o risco associado."

### 16. Erro Normalizado
> "Se houver uma falha de conexão ou erro no provedor de IA, o erro é capturado e normalizado. O usuário vê uma mensagem amigável que explica o problema, ocultando stack traces cruas ou tokens confidenciais."

### 17. Reset/Rollback Awareness
> "Se algo der errado, a arquitetura do Zavorth nos permite voltar ao estado anterior com facilidade através de comandos de reset operacionais integrados."

### 18. Conclusão da Demo
> "Com isso, concluímos a nossa simulação. Mostramos como o Zavorth se apresenta como um produto robusto, transparente e focado em segurança desde o primeiro uso. Obrigado!"
