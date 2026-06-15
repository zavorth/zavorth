# Kit do Tester Interno - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

## 1. O que é o Zavorth
Zavorth é um runtime de agente de inteligência artificial local, governado, projetado para executar tarefas de desenvolvimento, automação e análise com políticas de segurança estritas. Ele impõe um modelo de segurança baseado em limites de workspace, autorizações de comandos (PTY/HPM) e controle de exposição de ferramentas (Tool Exposure).

## 2. O que deve ser Testado
- **Onboarding e Setup Inicial**: Executar o fluxo guiado inicial e verificar se o banco de dados local SQLite é inicializado corretamente.
- **Painel de Controle (Cockpit/Readiness)**: Navegar pelas seções de diagnóstico na interface web do ZavorthControl e verificar a clareza das mensagens de erro ou pendências.
- **Configuração Segura de Provedor**: Cadastrar e testar a conexão com provedores de LLM utilizando placeholders ou chaves mockadas/restritas.
- **CLI Básica**: Testar comandos principais como `zavorth status`, `zavorth doctor` e `zavorth help`.
- **Fluxos Simples e Seguros**: Executar comandos locais básicos em workspaces controlados de teste, garantindo que o agente respeite os limites do diretório.

## 3. O que NÃO deve ser Testado (Proibições Estritas)
- **Comandos Destrutivos**: Não execute nem instrua o agente a rodar comandos como `rm -rf /` ou deletar diretórios cruciais do sistema.
- **HPM (Host Power Mode)**: Não teste o Host Power Mode com controle total do host sem autorização explícita do operador.
- **PTY (Governed interactive session)**: Não utilize sessões interativas de shell para tarefas confidenciais.
- **Conexão de Contas Pessoais**: Não configure chaves que deem acesso a contas de email, repositórios de produção ou ambientes de nuvem pessoais/corporativos.

## 4. O que o Tester NÃO deve fazer (Regras de Segurança)
- **Não compartilhar o build**: Este build candidato é confidencial e não deve ser repassado a terceiros.
- **Não publicar screenshots com segredos**: Caso envie prints da tela para relatar comportamento do app, oculte ou apague todas as chaves de API, senhas ou tokens que possam estar visíveis.
- **Não usar workspace de produção**: Crie um workspace vazio ou mockado temporário em `/tmp/` ou no repositório de testes. Não teste o app em projetos ativos de clientes ou de código fechado.
- **Não enviar logs brutos sem redigir**: Caso o app gere logs de erro, filtre ou remova todas as chaves de API reais antes de enviá-los para suporte.
- **Não abrir issues públicas**: Não crie relatórios em fóruns públicos ou repositórios abertos com dados privados.

## 5. Como Abrir o App
1. Descompacte o zip em um diretório local.
2. No diretório descompactado, execute o comando:
   ```bash
   npm start
   ```
3. A interface do painel web estará disponível localmente.

## 6. Como Configurar o Provedor de Forma Segura
- Vá em "Configurar Provedor" na interface.
- Selecione o provedor desejado.
- Utilize sempre um placeholder como `sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A` ou chaves de desenvolvimento com limites rígidos de cota diária.

## 7. Como Coletar Logs com Segurança
- Os logs operacionais são salvos no diretório `.zavorth/logs/` ou `logs/` do projeto.
- Abra o arquivo de log correspondente.
- Procure por chaves e substitua-as por `[REDACTED]`.
- Siga as regras do [Guia de Relato Seguro](internal-tester-safe-reporting-guide-21Q.md).

## 8. Como Remover ou Resetar o App
- Pare a execução no terminal (`Ctrl + C`).
- Caso queira limpar todas as configurações, siga as instruções em [Guia de Rollback](internal-tester-rollback-reset-guide-21Q.md).
