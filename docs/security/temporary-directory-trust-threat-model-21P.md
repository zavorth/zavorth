# Temporary Directory Trust Threat Model (Phase 21P)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento define o modelo de ameaças e os controles de segurança para o Temporary Directory Trust no ecossistema do Zavorth.

---

## 1. Threat Model

- **Ameaça**: O agente tenta ler/escrever arquivos fora da área temporária autorizada usando path traversal (`../../`), symlinks maliciosos criados dinamicamente para apontar para diretórios do sistema (ex: `/etc` ou `C:\Users\`), ou alterando o destino do symlink após a validação inicial mas antes do uso (ataque TOCTOU - Time-of-Check to Time-of-Use).
- **Superfície Afetada**: `TemporaryDirectoryTrustService` e `WorkspaceMcpServer`.
- **Autoridade Envolvida**: Acesso ao sistema de arquivos do host e permissões de escrita.
- **Controle Existente**: Validação simples de prefixo de string.
- **Controle Adicionado**:
  - Resolução física completa de caminhos via `fs.realpathSync`.
  - Revalidação do caminho resolvido **no momento do uso** (prevenindo ataques TOCTOU).
  - Bloqueio rígido de diretórios raiz (`/`, `C:\`, etc.), diretórios de perfil de usuário (`/home`, `C:\Users\username`) e caminhos UNC/rede.
  - Escopamento estrito de qualquer trust temporário ao respectivo `workspaceId`.
  - Auditoria obrigatória em eventos de concessão (grant), uso, expiração e revogação.
- **Testes Adicionados**:
  - `tests/services/TemporaryDirectoryTrustAdversarial.test.ts`
  - `tests/mcp/workspace/WorkspaceMcpTemporaryDirectoryTrust.test.ts`
- **Classificação**:
  - **P0**: TOCTOU bypass ou symlink escape de pasta confiada -> **Corrigido**.
  - **P1**: Trust de diretório temporário vazando para outros workspaces -> **Corrigido**.
