> Archived from public docs tree on 2026-07-11. Historical program notes — not current user documentation.

# Auditoria: Zavorth Code CLI no monorepo (Option C)

**Data:** 2026-07-10  
**Repo:** monorepo Zavorth (`1_PROJETOS_ATIVOS/Zavorth`)  
**Status do programa:** A–G feitos + pós-G: rename `packages/code` / `@zavorth/cli`; hybrid setup/providers/approve; multi-provider opt-in; gateway approvals API client; packaging selective no tarball + typecheck resiliente.

**Plano vivo:** [code-cli-integration.md](./code-cli-integration.md)  
**Superfícies:** [surfaces-code-control-desktop.md](../../product/surfaces-code-control-desktop.md)  
**Capabilities:** [cli-capabilities.md](../../product/cli-capabilities.md)  
**Runtime bridge:** [zavorth-runtime-bridge.md](../../protocol/zavorth-runtime-bridge.md)

---

## 1. Intenção de produto (corrigida vs scaffold dual-bin)

| O que **não** era a meta | O que **é** a meta |
|--------------------------|---------------------|
| Dois CLIs no PATH (`zavorth` agent + `zavorth-code` TUI) | **Um** bin público: `zavorth` |
| Organização de arquivos “ao lado” para sempre | TUI Code **nativa** no monorepo chefe |
| Fundir Desktop/Control no Code | Code = terminal; Control = dashboard; Desktop = app |

**Frase-resumo:** a TUI do zavorth-code vira a CLI nativa do monorepo; a CLI agent legada deixa de ser produto público e vira backend interno onde ainda for preciso.

---

## 2. O que já foi feito (histórico resumido)

### 2.1 Antes do merge (Onda 1–2 / bridge)

- Polish TUI Code (home, TrustLens, footer, identidade, paste/markdown).
- Bridge de arquivos (`ops-bridge`, companion) consumido por Control e Desktop.
- API `/api/code-bridge` no ai-gateway; testes de bridge.

### 2.2 Merge seletivo (árvore Code no monorepo)

- Scaffold `packages/code/` (cli, shared, plugin, script, sdk-js, …).
- Sync: `scripts/sync-zavorth-code-from-sibling.mjs` + `npm run code:sync`.
- Workspace **Bun** sob `packages/code` (monorepo root continua npm).
- **Não** entram app/desktop/console/web do Code como Control/Desktop.

### 2.3 Option C — fases de unificação

| Fase | Nome | Status | Entrega principal |
|------|------|--------|-------------------|
| **A** | Decisão & docs | Done | Option C replacement documentado |
| **B** | Casa nativa da TUI | Parcial | Árvore + sync + Bun; CI/freeze sibling ainda abertos |
| **C** | Entry único `zavorth` → TUI | Done | `bin/zavorth.js` default TUI; hatch agent só maintainer |
| **D** | Runtime monorepo atrás da TUI | Done (camada contrato) | env + `runtime-bridge.json` + ops check; LLM/policy deep wire incompleto |
| **E** | Capabilities monorepo no shell | Done | `zavorth doctor|setup|…` sem segundo produto |
| **F** | Apagar CLI pública dual | Done | só `bin.zavorth`; sem `zavorth-code` no PATH |
| **G** | Cutover sibling | **Done** | monorepo SoT; export mirror; CI `code-cli.yml` |

---

## 3. Estado atual do entry (pós-F)

```text
zavorth                  → Code TUI (packages/code/cli via Bun)
zavorth <capability> …   → bin/lib/zavorth-capabilities.cjs
                             native: doctor, status, home, open, capabilities
                             hybrid: providers, models, channels, approve, trust
                               (bare summary native; positional subcommands → agent)
                             delegated: setup, memory, mnemos, ask, chat, …
                             (backend: dist/zavorth-cli.js quando existir)
```

**Não é produto público:**

- `bin/zavorth-code.js` — **removido**
- `package.json` bin `zavorth-code` — **removido**
- `@zavorth/cli` npm bin separado — **removido**

**Backend interno (não segundo produto PATH):**

- `dist/zavorth-cli.js` / `src/zavorth-cli.ts` para capabilities **delegated**
- Hatch maintainer: `ZAVORTH_LEGACY_CLI=1` ou `zavorth __agent …` (compat `legacy` ainda funciona, não anunciado)
- Compat silencioso: `zavorth code …` só stripa o token e abre a TUI

---

## 4. Mapa de arquivos relevantes

### Entry / launch

| Path | Papel |
|------|--------|
| `bin/zavorth.js` | **Único** public entry |
| `bin/lib/resolve-zavorth-entry.cjs` | tui vs agent-runtime hatch |
| `bin/lib/launch-code-tui.cjs` | Spawna Bun + TUI; env monorepo; anti-loop PATH |
| `bin/lib/launch-legacy-cli.cjs` | Spawna `dist/zavorth-cli.js` (interno) |
| `bin/lib/zavorth-capabilities.cjs` | Inventário + native/delegated |

### Code TUI no monorepo

| Path | Papel |
|------|--------|
| `packages/code/` | Bun workspace (`@zavorth/code`) — home canônico pós-rename (não `packages/zavorth-code`) |
| `packages/code/cli` | TUI / coding shell (`@zavorth/cli`, sem bin público próprio) |
| `packages/code/cli/src/util/host-runtime.ts` | Lê contrato monorepo |
| `packages/code/cli/src/cli/cmd/tui/util/ops-bridge.ts` | ops-bridge + check monorepo-runtime |

### Runtime bridge / Code bridge

| Path | Papel |
|------|--------|
| `scripts/lib/zavorth-runtime-bridge.mjs` | write/read `runtime-bridge.json`, child env |
| `scripts/lib/zavorth-code-bridge.mjs` | ops/companion para Control/Desktop |
| `docs/protocol/zavorth-runtime-bridge.md` | Contrato runtime host |
| `docs/protocol/zavorth-code-bridge.md` | Ponte Control/Desktop |

### Smokes / testes

| Comando / path | O quê |
|----------------|--------|
| `npm run code:single-bin:smoke` | Só um bin público |
| `npm run code:entry:smoke` | Entry TUI + hatch |
| `npm run code:capabilities:smoke` | Capabilities |
| `npm run code:runtime-bridge:smoke` | Runtime bridge |
| `npm run code:dispatch:smoke` | Compat strip (sem dual product) |
| `npm run code:smoke` | Workspace Bun Code |
| `tests/cli/ZavorthCapabilities.test.ts` | Registry capabilities |
| `tests/cli/ZavorthRuntimeBridge.test.ts` | Runtime bridge |
| `tests/cli/ZavorthCodeCliDispatcher.test.ts` | Resolver legado (ainda presente no tree se existir) |

### Docs de produto

| Path | Papel |
|------|--------|
| `docs/archive/product/code-cli-integration.md` | Plano A–G (archived) |
| `docs/product/code-cli-packaging.md` | Packaging: dev Bun, tarball root, opções release, Windows |
| `docs/product/cli-capabilities.md` | Inventário capabilities |
| `docs/product/surfaces-code-control-desktop.md` | Code ≠ Control ≠ Desktop |
| **este arquivo** | Auditoria consolidada (archived) |

---

## 5. Gaps honestos (não maquiar)

1. **Capabilities delegated** ainda executam `dist/zavorth-cli.js` — UX de um bin, não um único processo in-process.
2. **Stage D** = contrato (env + `runtime-bridge.json` + check ops); **não** todo LLM/approvals já roteiam pelo ai-gateway monorepo.
3. **Stage B residual:** monorepo como primary edit path / CI forte / freeze do sibling ainda incompletos.
4. **Package publish:** monorepo `files` **não** empacota `packages/code` (rename/home canônico: **`packages/code`**, não `packages/zavorth-code`). TUI nativa no **clone + Bun**; tarball npm root leva só entry `zavorth` + dist agent. Estratégia e opções de release: [code-cli-packaging.md](../../product/code-cli-packaging.md).
5. **Desktop visual** não foi redesenhado (correto por política).
6. **Código agent** (`src/zavorth-cli.ts`) **não foi apagado** — internalizado como backend (Fase F).

---

## 6. Política de nomenclatura / jargão

- Em **código, bins, testes e protocol público de produto:** evitar “Stage C/D/E” como string de produto (já limpo nos entry/capabilities/smokes de unificação).
- Em **docs de programa** (`code-cli-integration.md`, este audit): phases A–G ok como tracker interno.
- Features do Code tipo “compose Stage 2” são fases de **workflow**, não do merge.

---

## 7. Como validar agora

```powershell
cd "C:\TESTES DEV\1_PROJETOS_ATIVOS\Zavorth"

npm run code:cutover:smoke
npm run code:single-bin:smoke
npm run code:entry:smoke
npm run code:capabilities:smoke
npm run code:runtime-bridge:smoke
npm run code:typecheck   # Bun + packages/code

node bin/zavorth.js doctor
node bin/zavorth.js home
node bin/zavorth.js capabilities
# node bin/zavorth.js          # TUI (precisa Bun + packages/code)
```

---

## 8. Próximos passos (ordenados)

### Pós–Fase G (programa de merge/cutover fechado)

1. **Reduzir delegated:** portar setup/providers/approve para nativo ou gateway até `dist/zavorth-cli` ser opcional.
2. **Execution truth:** TUI LLM/approvals alinhados ao monorepo gateway/policy (além do contrato env/file).
3. **Packaging/release:** ver [code-cli-packaging.md](../../product/code-cli-packaging.md) — opções A (ship `packages/code`), B (publish `@zavorth/cli` sem segundo bin), C (monorepo+Bun only, default honesto).
4. **CI:** workflow `code-cli.yml` já roda cutover gates + workspace smoke + **typecheck** (`bun run --cwd packages/code typecheck`). Hard-fail se typecheck quebrar no GHA; falhas locais Windows documentadas no packaging doc.
5. **Opcional:** branding path já é `packages/code` (não reverter para `packages/zavorth-code`); remover compat `legacy` do user surface; arquivar AUDIT-TEMP no sibling apontando aqui.

### Explicitamente fora do escopo deste programa

- Redesign visual do **Desktop**.
- Promover Code app/web/console a Control.
- Big-bang delete de todo `src/` agent sem migração de capabilities.

---

## 9. Checklist rápido “estamos nativos?”

| Pergunta | Hoje |
|----------|------|
| TUI Code no monorepo? | **Sim** |
| Um bin público `zavorth`? | **Sim** (F) |
| Usuário precisa de `zavorth-code` no PATH? | **Não** |
| Agent CLI ainda existe como código/backend? | **Sim** (delegated) |
| Tudo um único processo? | **Não** ainda |
| Sibling cutover? | **Sim** (G — monorepo SoT; sibling mirror/export) |

---

## 10. Histórico de decisões-chave

1. Option **B** (colocation dual-bin) foi scaffold e foi **superseded**.
2. Option **C** (replacement) é a verdade de produto: um shell, capabilities no monorepo entry.
3. dual-bin Stage 4 dispatcher foi **transitório**; F remove o segundo bin público.
4. Control/Desktop continuam produtos separados; bridge de arquivos permanece.

---

*Atualizar este arquivo quando a Fase G fechar ou quando delegated for eliminado. Não commitar segredos.*
