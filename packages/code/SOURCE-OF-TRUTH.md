# Source of truth: monorepo

**Canonical home for the Zavorth Code terminal CLI/TUI:**

```text
Zavorth/packages/code/
```

| Item | Policy |
|------|--------|
| **Develop here** | Yes — daily TUI/coding CLI work |
| **Public bin** | Monorepo root **`zavorth`** only (`bin/zavorth.js`) |
| **Sibling `../zavorth-code`** | Mirror or archive — **not** primary |
| **Import from sibling** | Exceptional only: `npm run code:sync -- --from-sibling` |
| **Export to sibling** | `npm run code:export` |

Cutover docs: [docs/product/code-cli-integration.md](../../docs/product/code-cli-integration.md) · [docs/product/AUDIT-code-cli.md](../../docs/product/AUDIT-code-cli.md)

Do **not** reintroduce a separate public `zavorth-code` bin.
