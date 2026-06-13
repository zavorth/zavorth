# Desktop Shell + Read-Only File Explorer — Checkpoint

> **Status:** Fases 10, 11, 11A encerradas e aprovadas.
> **Data:** 2026-06-13

---

## 1. Commits envolvidos

| Fase | Hash | Mensagem |
|------|------|----------|
| 10 — Shell/Layout (primitives) | `8afec88` | `feat(desktop): add premium pane and layout primitives` |
| 10 — Shell/Layout (components) | `ca716f3` | `feat(desktop): add multi-pane shell and preview rail components` |
| 10 — Shell/Layout (App integration) | `93d5d09` | `feat(desktop): integrate multi-pane shell in main App viewport` |
| 10 — Shell/Layout (tests) | `027e084` | `test(desktop): add multi-pane shell layout integration tests` |
| 11 — FileExplorer (component) | `b4ecac0` | `feat(desktop): add read-only FileExplorer component` |
| 11 — FileExplorer (rail integration) | `9ae05bf` | `feat(desktop): integrate FileExplorer panel in contextual preview rail` |
| 11 — FileExplorer (integration tests) | `9392676` | `test(desktop): add read-only FileExplorer integration tests` |
| 11A — FileExplorer (render coverage) | `2568bef` | `test(desktop): add real render coverage for read-only FileExplorer` |

---

## 2. Componentes adicionados

### `ZavorthPaneShell` — `apps/zavorth-desktop/src/shell/ZavorthPaneShell.tsx`
- Container root do cockpit multi-pane.
- Organiza `Pane` filhos em layout flexível com suporte a orientação e proporções configuráveis.
- Não expõe filesystem, IPC, MCP ou runtime ao renderer.

### `DesktopPreviewRail` — `apps/zavorth-desktop/src/shell/DesktopPreviewRail.tsx`
- Trilho lateral contextual que hospeda painéis de suporte, incluindo `FileExplorer`.
- Controlado por prop `activePanel`; sem lógica de escrita.

### `Pane` — `apps/zavorth-desktop/src/shell/Pane.tsx`
- Unidade atômica de painel: recebe `title`, `children` e dimensões opcionais.
- Sem estado global ou efeitos colaterais.

### `FileExplorer` — `apps/zavorth-desktop/src/components/FileExplorer.tsx`
- Árvore de arquivos visual, **somente leitura**.
- Aceita apenas a estrutura segura:
  ```ts
  type FileExplorerNode = {
    name: string;
    relativePath: string;
    type: 'file' | 'directory';
    children?: FileExplorerNode[];
  };
  ```
- Callback de seleção: `onSelectFile?: (relativePath: string) => void`
  - Recebe apenas `relativePath`.
  - Não lê conteúdo, não chama filesystem, não chama MCP tools, não envia ao LLM.

---

## 3. Garantias de segurança

| Garantia | Mecanismo |
|----------|-----------|
| **Read-only** | Nenhum botão/link write/delete/rename/create/upload/drag-drop exposto |
| **Sem filesystem/IPC no renderer** | Nenhum import de `fs`, `path`, `electron`, IPC ou Node APIs no componente |
| **Sem path absoluto** | `sanitizeTree` filtra nodes com `relativePath` contendo `C:\`, `/Users/`, `../`, `..\` ou padrões de traversal antes de renderizar |
| **Sem leitura de conteúdo** | `onSelectFile` recebe apenas `relativePath`; nenhuma leitura de arquivo ocorre dentro do componente |
| **Sem novas ferramentas MCP** | Nenhuma adição ao manifesto MCP; nenhuma tool call gerada pelo componente |
| **Modal de write approval preservada** | `WorkspaceWriteApprovalModal` mantida como sibling top-level em `App.tsx`, sem alterações |
| **Validação defensiva** | `isSuspiciousPath` rejeita paths absolutos e traversal antes de repassar ao callback |
| **Sem drag-and-drop** | Nenhum event handler `onDrop`, `onDragOver` ou `draggable` implementado |

---

## 4. CSS namespacing

Todos os seletores adicionados em `apps/zavorth-desktop/src/styles.css` são namespaced:

```
.zavorth-pane-shell
.zavorth-preview-rail
.zavorth-pane
.zavorth-mock-terminal
.zavorth-file-explorer
.zavorth-file-tree
.zavorth-file-node
.zavorth-file-node-directory
.zavorth-file-node-file
```

Seletores globais (`body`, `#root`, `*`, `button`, `input`) **não foram alterados**.  
Nenhuma `<style>` embutida nos componentes TSX.

---

## 5. Gates de verificação

### Build e tipo

```bash
npm run build
npx tsc --noEmit
```

### Suíte de testes desktop

```bash
npx jest \
  tests/apps/zavorth-desktop/WorkspaceWriteApprovalModal.test.ts \
  tests/apps/zavorth-desktop/DesktopChatReferenceAndContextSurface.test.ts \
  tests/apps/zavorth-desktop/DesktopNewChatAndConversationSurface.test.ts \
  tests/apps/zavorth-desktop/DesktopProductReadyCockpit.test.ts \
  tests/apps/zavorth-desktop/DesktopReadOnlyFileExplorer.test.ts
```

---

## 6. Backlog técnico (fora do escopo atual)

- **Jest + JSDOM real**: Os testes de render da Fase 11A utilizam mock DOM manual (JSDOM não está configurado no preset atual). Quando o setup Jest/TSX suportar `jest-environment-jsdom` + `@testing-library/react`, substituir o mock por renderização real com `@testing-library/react` e `userEvent`.
- **Inspeção de `__reactProps$`**: A inspeção de propriedades internas do React no teste de render deve ser eliminada assim que `@testing-library/react` estiver disponível — usar `screen.getByRole` e `fireEvent` convencionais.

---

## 7. Arquivos fora do escopo (não alterados)

- MCP Trust / runtime / agent
- Write approvals 9B–9F
- `InteractiveTerminal.tsx`
- `hub-skin/`
- `themePresets.ts`
- Painéis reais fora de `panelPrimitives.tsx`
- Seletores CSS globais
