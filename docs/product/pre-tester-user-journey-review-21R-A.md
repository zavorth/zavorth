# Revisão da Jornada do Usuário - Fase 21R-A

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Esta revisão mapeia a jornada passo a passo de um testador fictício interagindo com o Zavorth sem instrução prévia externa, validando a descobrabilidade das interfaces e comandos.

---

## 1. Etapa 1: Inicialização e Onboarding
- **Ação do Usuário**: Executa `npm start` ou abre o binário local do app.
- **Feedback Visual**: O shell inicial é renderizado sem demoras. Uma mensagem de carregamento do cockpit é exibida temporariamente e depois o dashboard principal é carregado.
- **Descobrabilidade**: Alta. O app inicia automaticamente no cockpit do workspace padrão.
- **Veredito**: Aprovado. O fluxo de onboarding inicial prepara a pasta `.zavorth` e banco SQLite locais sem necessidade de intervenção complexa.

---

## 2. Etapa 2: Seleção e Configuração do Workspace
- **Ação do Usuário**: Seleciona uma pasta local para atuar como workspace do agente.
- **Feedback Visual**: A interface mostra o caminho relativo selecionado. Se a pasta for nova, o status do workspace exibe "Restricted" até que o usuário execute a ação de confiança (Trust).
- **Descobrabilidade**: Alta. O banner vermelho "Workspace Não Confiável" alerta o usuário sobre a necessidade de autorizar a pasta para habilitar a execução de ferramentas.
- **Veredito**: Aprovado. As opções "Start Runtime" e "Repair Access" estão visíveis no cartão de saúde.

---

## 3. Etapa 3: Configuração do Provedor de IA
- **Ação do Usuário**: Abre o modal de configuração de provedor e insere a chave de API (OpenAI/Anthropic).
- **Feedback Visual**: O campo de chave de API é mascarado visualmente. O status do provedor muda de "Pendente" para "Pronto".
- **Descobrabilidade**: Alta. O botão de configuração do provedor se destaca na barra lateral e no cartão central.
- **Veredito**: Aprovado. Não há risco de vazamento visual do segredo, pois as telas internas expõem apenas metadados (como os últimos caracteres ou sufixos da chave).

---

## 4. Etapa 4: Diagnóstico e Verificação do Cockpit
- **Ação do Usuário**: Revisa os controles e diagnósticos de segurança antes de autorizar tarefas do agente.
- **Feedback Visual**: O usuário vê de forma legível quais recursos perigosos (Developer Mode, PTY, HPM) estão habilitados ou bloqueados no workspace ativo.
- **Descobrabilidade**: Alta. O cockpit exibe os StatusBadges verdes ("Bloqueado" / seguro) e amarelos ("Habilitado" / atenção) correspondentes a cada permissão.
- **Veredito**: Aprovado. Os padrões de segurança ("Safe Defaults") são exibidos com clareza na interface.

---

## 5. Etapa 5: Interação via CLI e Terminal
- **Ação do Usuário**: Executa o comando de diagnóstico no terminal (`zavorth doctor` ou `zavorth status`).
- **Feedback Visual**: A CLI imprime um sumário formatado com a integridade do runtime, banco de dados e provedor.
- **Descobrabilidade**: Alta. Rodar o executável sem argumentos ou com `--help` expõe a lista de comandos acionáveis.
- **Veredito**: Aprovado. O output é limpo de terminologias de baixo nível e não contém placeholders ou tokens expostos.
