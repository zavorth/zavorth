# Provider Secret Metadata Policy (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento define a política de metadados para segredos e chaves de provedores no ecossistema do Zavorth.

---

## 1. Classificação e Regras de Exposição de Metadados

- **Ameaça**: Vazamento acidental de chaves de API parciais ou completas, hashes decodificáveis, ou textos cifrados em logs operacionais, respostas de rede ou visualizações de CLI.
- **Superfície Afetada**: `ProviderSecretStore` e painéis de configuração.
- **Autoridade Envolvida**: Gerenciador de segredos local (criptografia AES-256-GCM).

### Matriz de Postura de Metadados

| Elemento | Categoria | Regra de Exposição |
| :--- | :--- | :--- |
| **`rawKey`** | Crítico | **Nunca aparece** em qualquer interface, API ou log. |
| **`authTag`** / **`ciphertext`** | Crítico | **Nunca aparecem** em respostas de serviços públicos. |
| **`secretRef`** | Alto | **Nunca aparece** para o usuário final. Exibido apenas internamente em mapeamentos. |
| **`Authorization`** / **`Bearer`** | Alto | **Nunca aparecem** em formato bruto. Substituídos por redações seguras. |
| **`suffix`** | Sensível Leve | **Só aparece em UI local** explicitamente confiada. Oculto em APIs públicas, logs, CLI não confiável e auditoria. |
| **`fingerprint`** | Baixo | Pode aparecer em superfícies controladas de auditoria local. |

- **Controle Adicionado**: Filtros e sanitizações estritas em todas as saídas de CLI/UI. O sufixo da chave é tratado como sensível leve.
- **Testes Adicionados**:
  - `tests/services/ProviderSecretMetadataLeak.test.ts`
  - `tests/apps/zavorth-desktop/ProviderSecretMetadataUiLeak.test.tsx`
  - `tests/cli/ProviderSecretMetadataCliLeak.test.ts`
- **Classificação**:
  - **P1**: Sufixo ou `secretRef` vazando em logs de auditoria ou saída da CLI -> **Corrigido**.
