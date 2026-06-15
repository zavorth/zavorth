# Guia de Relato Seguro de Bugs - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.

Este documento estabelece as diretrizes obrigatórias de segurança para o envio de logs, relatórios e capturas de tela durante os testes do Zavorth. A regra de ouro é **nunca transmitir dados reais de credenciais ou segredos**.

---

## 1. Diretrizes Obrigatórias de Redação

1. **NÃO envie chaves de API reais**: Nunca inclua chaves como `sk-proj-...` ou `AIzaSy...` nos relatórios.
2. **NÃO envie cabeçalhos de autorização**: Remova cabeçalhos como `Authorization: Bearer <token>` ou chaves de sessão.
3. **NÃO envie caminhos (paths) absolutos sensíveis**: Substitua caminhos contendo seu nome de usuário (ex: `C:\Users\nome_do_tester\...`) por caminhos genéricos ou relativos (ex: `workspace/docs/...`).
4. **NÃO inclua referências a segredos estruturais**: Remova referências a strings como `secretRef`, `ciphertext`, `authTag` ou `rawKey` reais contendo dados privados.
5. **Redija as Capturas de Tela (Screenshots)**: Caso anexe uma imagem que exiba campos de formulários preenchidos com chaves de API, coloque uma tarja preta ou censure a área correspondente antes de enviar.
6. **Redija os Arquivos de Log**: Filtre os logs operacionais copiados e substitua qualquer ocorrência de valores confidenciais por `[REDACTED]` ou `<placeholder-seguro>`.
7. **Não envie prompts privados completos**: Se a tarefa executada continha dados comerciais sensíveis no prompt de instrução, substitua o texto por uma instrução de teste equivalente e pública (ex: "Calcular soma dos números").

---

## 2. Exemplos Comparativos

### Exemplo de Logs

#### ❌ INSEGURO (NÃO ENVIAR)
```text
[2026-06-15 03:00:00] [ERROR] [ProviderInvocationService] Call failed for key: sk-proj-EXEMPLO-CHAVE-DE-API-NAO-VAZAR
[2026-06-15 03:00:01] [DEBUG] headers: { "Authorization": "Bearer <token-secreto-real>" }
[2026-06-15 03:00:02] [DEBUG] rawKey: "secret-vault-api-key-value"
```

####   SEGURO (FORMATO CORRETO)
```text
[2026-06-15 03:00:00] [ERROR] [ProviderInvocationService] Call failed for key: [REDACTED_API_KEY]
[2026-06-15 03:00:01] [DEBUG] headers: { "Authorization": "Bearer [REDACTED_BEARER_TOKEN]" }
[2026-06-15 03:00:02] [DEBUG] rawKey: "[REDACTED_MOCK_VAULT_KEY]"
```

---

### Exemplo de Capturas de Tela

- **Inseguro**: Imagem do painel do ZavorthControl exibindo no campo "API Key" a chave real em texto limpo ou parcialmente oculto que permita leitura.
- **Seguro**: Imagem com o campo de texto da chave preenchido apenas por asteriscos (`********`) ou com tarja preta completa por cima do campo.

---

## 3. Minimização de Dados
Sempre envie apenas a linha do erro e o stack trace que mostram o problema de execução. Evite enviar o arquivo de log completo se a falha pôde ser identificada em apenas 5 linhas.
