# Zavorth - Internal Beta Known Issues

Este documento lista os problemas conhecidos e limitações aceitas para o Release Candidate do Beta Interno do Zavorth.

## Lista de Known Issues

### 1. Ambiente de Teste JSDOM Separado
* **Descrição**: Os testes unitários e de integração que validam componentes do React (`.tsx`) requerem o ambiente de testes do JSDOM (`--env=jsdom`) para simular o DOM do navegador de forma isolada, enquanto os testes do runtime principal (`.ts`) rodam no ambiente padrão do Node.js.
* **Severidade**: P2 (Known Issue de desenvolvimento).
* **Solução**: Executar os testes React especificando o arquivo e a flag `--env=jsdom` ou utilizando scripts configurados.

### 2. Mensagens "DB not ready" em Mocks
* **Descrição**: Durante a execução de alguns testes isolados do runtime ou do ToolExposurePolicy que utilizam mocks completos de repositório, mensagens de aviso de console `[SECURITY] [security_audit] ... (DB not ready)` podem ser exibidas se a conexão com o SQLite não for inicializada explicitamente para aquele teste.
* **Severidade**: P2 (Apenas aviso de log em console).
* **Solução**: Isso é esperado em testes de unidade puros que simulam decisões sem persistência ativa em banco de dados.

### 3. Requisito de C++ Build Tools para PTY no Windows
* **Descrição**: O subsistema governado de PTY (sessões interativas) utiliza a biblioteca opcional `node-pty`. No Windows, se o pacote for compilado a partir dos fontes, são necessárias as ferramentas de compilação C++ (Visual Studio Build Tools).
* **Severidade**: P2 (Fator de instalação de dependência local).
* **Solução**: Instruções de instalação fornecidas na documentação técnica do subsistema PTY.
