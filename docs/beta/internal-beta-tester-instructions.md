# Zavorth - Internal Beta Tester Instructions

Este guia orienta o tester interno sobre como instalar, configurar e validar o Release Candidate do Zavorth localmente de forma segura.

## Pré-requisitos
* Node.js v22 ou superior instalado.
* Git instalado.
* Windows OS (máquina de desenvolvimento).

## 1. Como Receber e Verificar o Artefato
O artefato é disponibilizado internamente de forma manual via canais privados.
* **Nome do arquivo**: `zavorth-internal-beta-rc-2026-06-14.zip`
* **SHA256 Checksum**: `FF47E2F195B38567AB74D246FB558BBFA4671304F7D14D7A53F5AB4C075B4C34`
* Para verificar o checksum no PowerShell do Windows, execute:
  ```powershell
  Get-FileHash path/to/zavorth-internal-beta-rc-2026-06-14.zip -Algorithm SHA256
  ```

## 2. Como Instalar e Abrir Localmente
1. Extraia o conteúdo do zip em uma pasta local do sistema.
2. Abra um terminal nessa pasta e instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o aplicativo desktop em modo de desenvolvimento:
   ```bash
   npm run dev
   ```

## 3. Configurações Iniciais Seguro (Primeiro Uso)
Ao abrir o app em um estado limpo:
* **Workspace**: Escolha uma pasta local vazia de teste e selecione-a na interface. Confirme o diálogo de workspace trust.
* **Provider**: Acesse a aba **Provider Settings**, selecione o provedor desejado (ex: `ws-openai`) e configure suas credenciais. O campo de credencial exibirá o status `[CONFIGURED]` após salvo e nunca exporá o token real.
* **Test Connection**: Clique em **Test Connection** para validar se o provedor responde corretamente. O teste roda de forma 100% sanitizada.
* **Default Model/Provider**: Em **Agent Workspace Settings**, defina seu provedor e modelo padrão (ex: `gpt-4o`).

## 4. Auditoria de Segurança e Diagnóstico
* Acesse a aba **Beta Checklist** no app para visualizar o status do banco de dados local, políticas ativas e pendências de onboarding.
* Valide que o **Developer Mode**, **Host Power Mode (HPM)** e **PTY** estão desativados (blocked by default) no painel **Policy Preview**.

## 5. Como Executar uma Tarefa Segura
* Utilize uma tarefa de leitura simples e read-only (ex: "verifique se existe um arquivo readme no workspace").
* Confirme que a tarefa executa de forma segura dentro dos limites do workspace confiado.

## 6. Como Reportar Bugs
* Se encontrar uma falha, copie o log sanitizado ou tire um print da tela.
* **IMPORTANTE**: Certifique-se de que nenhum print ou arquivo de log contém chaves reais de API, cabeçalhos de autorização (do tipo Authorization ou Bearer), caminhos confidenciais de banco de dados ou prompts com dados privados. Os erros exibidos na UI já vêm normalizados contra vazamento de chaves.

## 7. Como Resetar as Configurações
* Para revogar o workspace confiado, clique em remover workspace nas configurações.
* Para resetar todas as configurações e chaves locais, apague o banco local deletando o arquivo `data/zavorth.db`.
* Para remover a build, simplesmente feche o app e delete a pasta extraída do zip.

## 8. O que NÃO Testar Ainda
* **Release Público / Downloads**: Nenhuma publicação externa está disponível.
* **Auto-update**: O subsistema de atualização está desativado.
* **Host Power Mode (HPM) / PTY**: Não ative esses modos sem extrema necessidade e supervisão, pois eles liberam execução de comandos locais no host.
* **Comandos de shell arbitrários ou destrutivos**: Não execute tarefas de teste com comandos que possam alterar ou deletar arquivos importantes do seu sistema.
* **Chaves compartilhadas**: Nunca envie ou publique chaves de API nos canais de comunicação ou logs de bugs.
