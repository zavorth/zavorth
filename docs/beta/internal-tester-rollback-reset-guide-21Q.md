# Guia de Remoção, Reset e Rollback - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Este guia fornece instruções para parar, limpar (reset) ou remover completamente o Zavorth e suas pastas do sistema do testador.

---

## 1. Interrupção da Execução
Para parar imediatamente o runtime do agente e a interface do painel web:
1. Vá até o terminal de comando onde o processo está rodando.
2. Pressione a combinação de teclas **`Ctrl + C`** (ou envie o sinal de interrupção SIGINT).
3. Verifique se a porta local onde o painel estava sendo executado foi liberada.

---

## 2. Reset Completo (Limpeza de Dados)
Caso precise redefinir o app para o estado inicial de fábrica (Onboarding pendente, sem provedor ou workspaces cadastrados):
- Remova o arquivo de banco de dados SQLite local localizado em:
  - `data/zavorth.db` (ou no caminho configurado na variável de ambiente `DB_PATH`).
- Exclua o diretório oculto de estado temporário `.zavorth` no workspace:
  ```bash
  # Windows
  Remove-Item -Recurse -Force .\.zavorth
  
  # Linux/macOS
  rm -rf .zavorth
  ```
- Exclua os arquivos temporários gerados em `tmp/` ou `.tmp/` no diretório raiz do projeto.

---

## 3. Remoção Completa (Desinstalação)
Para remover todos os vestígios do Zavorth do sistema host:
1. Exclua a pasta inteira onde o pacote ZIP candidato foi descompactado.
2. Certifique-se de excluir a pasta de logs `.zavorth/logs` e o arquivo de banco de dados conforme seção 2.
3. Se adicionado ao PATH do sistema operacional, remova o caminho correspondente do executável da CLI (`zavorth`).
4. Remova quaisquer variáveis de ambiente criadas temporariamente (ex: `ZAVORTH_HOME`, `OPENAI_API_KEY` usadas em sessões globais).
