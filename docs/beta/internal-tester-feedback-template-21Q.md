# Template de Feedback do Tester Interno - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Utilize o formulário abaixo para registrar suas observações e relatar incidentes ou bugs encontrados durante o teste.

---

## Formulário de Avaliação

### 1. Metadados do Teste
- **Nome ou Codinome do Tester**:
- **Data do Teste**:
- **Sistema Operacional & Versão**:
- **Nome do Artefato do Zavorth**: `zavorth-internal-tester-candidate-21q-2026-06-15.zip`
- **SHA256 do arquivo verificado localmente? (sim/não)**:
- **Primeira Inicialização Funcionou? (pass/fail)**:

### 2. Avaliação de Usabilidade (UX/UI)
- **Clareza na Seleção de Workspace (Nota 1-5 ou Comentário)**:
- **Clareza na Configuração de Provedor (Nota 1-5 ou Comentário)**:
- **Clareza no Cockpit/Diagnóstico de Readiness (Nota 1-5 ou Comentário)**:
- **Clareza nos Comandos CLI (Nota 1-5 ou Comentário)**:

### 3. Execução do Primeiro Fluxo Seguro
- **Resultado do primeiro comando executado pelo agente (sucesso/erro/bloqueio)**:
- **Comentários sobre a resposta do agente**:

### 4. Relato de Incidentes e Erros (Bugs)
- **Erros ou travamentos encontrados**:
- **Severidade do Bug (P0 / P1 / P2 / P3)**:
- **Passos para Reproduzir**:
- **Comportamento Esperado**:
- **Comportamento Obtido**:
- **Captura de tela anexada? (sim/não)**:
- **Logs de erro anexados? (sim/não)**:
- **Segredos reais foram devidamente apagados/redigidos dos logs e prints? (sim/não)**:

### 5. Melhorias Sugeridas
- **Pontos de atrito ou melhorias de fluxo**:
- **Permissão para contato de acompanhamento da equipe técnica? (sim/não)**:

---

## Classificação de Severidade de Bugs

Use as seguintes regras para categorizar qualquer problema encontrado:

- **P0 - Bloqueador de Segurança / Gravíssimo**:
  - Vazamento ou exposição de chaves de API/segredos reais.
  - Perda ou corrupção de dados do host/workspace.
  - Execução de ações destrutivas ou não autorizadas no host.
  - Execução de qualquer ferramenta proibida ou bypass de permissão de canal.
- **P1 - Bloqueador Funcional / Crítico**:
  - Falha na primeira inicialização (Crash ao abrir).
  - Impossibilidade de configurar ou autenticar com o provedor LLM local/remoto.
  - Bypass visual de permissão (ex: botão de aprovação que executa sem clique).
  - Bloqueio completo da usabilidade principal da CLI ou UI.
- **P2 - Erro Moderado / Degradado**:
  - Comportamento instável de interface sem travar o app.
  - Resposta ou fluxo do agente muito lento ou com loops.
  - Mensagens de erro confusas ou sem diagnóstico preciso.
- **P3 - Cosmético / Leve**:
  - Erros gramaticais, espaçamento incorreto, polimento visual ou pequenas incoerências de vocabulário.
