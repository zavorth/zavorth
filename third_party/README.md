# Third-Party Layout

As copias reais dos projetos externos ficam fora do git principal, em:

- `data/vendor-mirrors/`
- `data/vendor-worktrees/`

O Zavorth usa esse arranjo para:

- não depender do upstream ao vivo
- manter um mirror git local
- congelar commits especificos em `data/vendor-lock.json`

Projetos atuais e historicos:

- sidecar legado de roteamento OpenAI-compatible local -> mantido apenas como proveniencia historica
- sidecar de UI remota para ZavorthBridge -> mantido somente como vendor isolado, sem acoplamento ao core

Para recriar ou atualizar as copias locais:

```bash
node scripts/bootstrap-third-party.mjs
```
