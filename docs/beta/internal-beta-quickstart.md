# Zavorth - Internal Beta Quickstart

Este guia orienta o tester interno sobre como utilizar e validar os recursos de segurança e execução do Zavorth Runtime.

## 1. Como Abrir o App
* Navegue até o diretório do desktop app: `apps/zavorth-desktop`.
* Para executar em modo de desenvolvimento: `npm run dev`.
* Para compilar o build de produção local: `npm run build`.

## 2. Como Escolher e Confiar em um Workspace
* Ao abrir o aplicativo pela primeira vez, nenhuma pasta do sistema é confiável por padrão.
* Selecione um diretório de trabalho (Workspace) local.
* Confirme a ação de confiança explicitando que deseja autorizar o Zavorth a ler esse diretório.

## 3. Como Configurar um Provider e Testar a Conexão
* Acesse a aba **Provider Settings**.
* Configure um provider de LLM (por exemplo, `ws-openai`).
* Insira a credencial correspondente. O campo de API Key exibirá um placeholder seguro (`[CONFIGURED]`) e nunca revelará a chave bruta na interface ou em logs.
* Use o botão **Test Connection** para validar a integração de forma segura e sanitizada.

## 4. Como Escolher o Provider e Model Default
* Em **Agent Workspace Settings**, defina qual provider configurado e qual modelo (por exemplo, `gpt-4o`) serão os padrões para a execução de tarefas.

## 5. Como Ler a Readiness e Usar o Policy Preview
* A barra lateral ou cabeçalho exibe o cartão de **Readiness** (Prontidão), que informa se o provider default, modelo default e workspace trust estão corretos.
* O painel **Policy Preview** mostra quais permissões de segurança estão ativas (ex: se Developer Mode, Host Power Mode ou PTY estão bloqueados).

## 6. Como Usar o Internal Beta Diagnostics
* Acesse a aba **Beta Checklist / Diagnostics**.
* Veja o relatório detalhado do estado do sistema. Ele verifica se o banco de dados está online, se as políticas restritivas estão em vigor e se há issues de segurança ativas.

## 7. Como Executar uma Tarefa Simples Segura
* As tarefas seguras devem ser executadas sem acesso ao shell do host ou comandos destrutivos.
* Utilize consultas de leitura simples dentro do escopo do Workspace confiado.

## 8. Como Validar Approvals
* Se uma tarefa solicitar acesso a um recurso controlado (como escrita de arquivo fora do escopo ou execução de comando host), o Zavorth exibirá um card de **Approval** (Aprovação pendente).
* O agente só prossegue após a aprovação explícita do usuário na UI.

## 9. Como Confirmar Recursos Bloqueados por Padrão
* Por padrão de segurança absoluta (safe defaults):
  * **Developer Mode**: Bloqueado.
  * **Host Power Mode (HPM)**: Bloqueado.
  * **PTY (Interactive Sessions)**: Bloqueado (PTY requer HPM ativo).
  * **Provider Fallback**: Bloqueado.
  * **Temporary Directory Trust**: Bloqueado.

## 10. Como Revogar Workspace Trust ou Resetar Configurações
* Para revogar a confiança de um workspace, remova-o das configurações locais.
* Para resetar por completo as configurações locais, limpe o banco de dados local executando o script de reset ou deletando o arquivo `data/zavorth.db`.

## 11. O que NÃO Testar Ainda
* Não tente utilizar integrações de sincronização na nuvem (cloud sync), auto-update, ou billing, pois essas features estão fora do escopo do beta interno.

## 12. Como Reportar Bugs
* Em caso de falhas ou vazamentos na UI, colete os logs normalizados em `logs/` e envie para o time de desenvolvimento junto com o passo a passo para reprodução.
