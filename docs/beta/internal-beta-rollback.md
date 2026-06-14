# Zavorth - Internal Beta Rollback and Reset Playbook

Este guia detalha o procedimento para fechar o aplicativo, remover os artefatos locais do beta, revogar o workspace trust e realizar o rollback seguro se necessário.

## 1. Como Fechar o Aplicativo
1. Se estiver executando no terminal via `npm run dev`, pressione `Ctrl + C` no terminal.
2. Certifique-se de que todos os processos do Node.js/Electron foram encerrados no Gerenciador de Tarefas do Windows.

## 2. Como Remover a Build Local de Teste
Para limpar os artefatos locais e realizar a limpeza da instalação:
* **Limpeza da pasta extraída**:
  > [!CAUTION]
  > Remova apenas a pasta local criada para o dry run de teste.
  > Não delete arquivos ou pastas do seu Workspace real de trabalho ou qualquer diretório fora do escopo do aplicativo extraído.
  Delete a pasta onde o arquivo `zavorth-internal-beta-rc-2026-06-14.zip` foi extraído.
* **Remoção de Arquivos Temporários**:
  Delete a pasta temporária de artefatos localizados em `tmp/internal-beta/` e `tmp/` (caso não deseje mantê-los).

## 3. Como Resetar as Configurações Locais e Revogar Trust
Para limpar os estados internos de configuração e remover todas as credenciais do banco de dados:
1. **Revogar Workspace Trust**: Acesse a aba de configurações e remova o diretório confiado para revogar as permissões.
2. **Remover Credenciais de Provedores via UI**: Na aba **Provider Settings**, selecione o provedor e use o botão **Delete**/Remover para apagar a chave encriptada.
3. **Reset Completo do Banco de Dados**:
   Delete o arquivo local de banco de dados SQLite localizado no diretório:
   `data/zavorth.db`
   Isso restabelecerá o aplicativo para o estado original de "first-run" (sem workspace confiado e sem credenciais salvas).

## 4. Como Reverter para a Tag/Commit Anterior
Se for necessário voltar para a versão estável prévia via Git:
1. No terminal do repositório original, certifique-se de que seu trabalho local foi salvo ou descartado.
2. Execute:
   ```bash
   git checkout zavorth-post-21kb-internal-beta-hardening-checkpoint-2026-06-14
   ```
