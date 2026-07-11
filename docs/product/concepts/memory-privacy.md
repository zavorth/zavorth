---
title: "Memory Privacy OS"
description: "What does Zavorth remember? Why? Forget it — with proof."
---

# Memory Privacy OS

Memory Privacy is the product narrative layer over Mnemos. It answers three questions clearly:

1. **What does it remember?** — a readable list of memory items with origin labels
2. **Why?** — a human explanation (`whyIKnowThis`) for each item
3. **Forget it.** — mark an item forgotten and record a **proof event**

It does **not** replace the Mnemos engine, dream cycle (`MnemosDreamCycleService`), encryption, or existing memory panels. Those keep working; Privacy OS is the UX/contract face.

## Origins

| Origin | Meaning |
|---|---|
| `conversation` | Stored from a past conversation in this workspace |
| `skill` | Captured while running or installing a skill |
| `import` | Imported from migration or external pack |
| `dream-cycle` | Proposed by the Mnemos dream consolidation cycle |
| `user-stated` | You explicitly asked Zavorth to remember this |
| `system` | System-critical (often not forgettable) |
| `unknown` | Origin not fully known |

## Forget + proof

Forgetting through Privacy OS:

```bash
zavorth memory-privacy seed-demo
zavorth memory-privacy list
zavorth memory-privacy explain mem-demo-pref-tabs
zavorth memory-privacy forget mem-demo-secret-flag --yes
```

With `--yes`, the CLI:

- Marks the item forgotten in the **demo store** (`.zavorth/memory-privacy-demo.json`)
- Appends a proof ledger event: `kind=memory`, title **"Memory forgotten"**

Live product Mnemos stores are **not** wiped unless a host wire exists. Secret-like items are flagged without echoing secret values in views or proof metadata.

## CLI surface

```bash
zavorth memory-privacy
zavorth memory-privacy status [--json]
zavorth memory-privacy list [--json]
zavorth memory-privacy explain <id>
zavorth memory-privacy forget <id> [--yes]
zavorth memory-privacy seed-demo
```

Aliases: `memory-privacy-os`, `privacy-memory`.

## Desktop

The Memory panel maps learned rows through `memoryPrivacyBridge` so each row can show:

- **Origin** (conversation, skill, …)
- **Why I know this** instead of a generic “Governed context memory.” blurb

Encryption / protection tabs stay intact.

## Related

- [Memory](/docs/product/concepts/memory) — tiers, wiki, query
- [Approvals](/docs/product/concepts/approvals) — consent before lasting change
- Proof ledger: `zavorth proof list --kind memory`
