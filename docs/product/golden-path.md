# Golden Path (Proof OS Trust Loop)

The **golden path** is a hermetic, single-command gate that proves the core
Zavorth Proof OS trust loop without live network:

**seed/setup path → plan/preview → approval → receipt/proof → optional forget → honesty checks.**

It is intentionally narrower and faster than full product certification. Use it
for local development feedback and as a CI pre-check. Full product certification
remains required before release.

## What It Covers

| Stage | Coverage |
| --- | --- |
| Unit gate | Critical Jest suites for proof, approval, risk budget, change preview, honesty readiness, memory privacy, and Control Proof OS model |
| Proof ledger | Append demo event, list, markdown export title |
| Approval | `fromLooseRequest` + `recordDecision` with in-memory proof ledger |
| Risk budget | Temp state file; observer mode blocks disk spend |
| Change preview | Plan steps produce non-empty bullets (honest confidence) |
| Memory privacy | `seedDemo` + `forgetInDemo` under temp store |
| Honesty | Catalog-only readiness is **not** live |
| Absorb risk | Minimal fabric snapshot report |
| Migration profile | Detect `tests/fixtures/migration-homes/generic` |

All file adapters use OS temp directories (or in-memory stores) so the repo stays clean.
Network I/O is not required.

## How To Run

```bash
npm run qa:zavorth-golden-path
```

Alias:

```bash
npm run zavorth:golden-path
```

Exit code is non-zero on any failure. On success you should see `[pass]` lines
for `unit-gate` and `service-smoke`, plus a summary.

When `.zavorth/` exists, the runner best-effort writes
`.zavorth/golden-path-last.json` with the last report.

## Relationship To Product Certification

| Gate | Purpose | Speed | Network |
| --- | --- | --- | --- |
| **Golden path** | Hermetic Proof OS trust loop | Fast (target &lt; 3 min) | None |
| **Product certification** (`qa:zavorth-product-certification`) | Full user-facing readiness: agent kernel, channels, HUD, streaming E2E, release scan, etc. | Longer | May include live/canary steps where configured |

**Full product certification is still required for release.** Golden path does
not replace `qa:zavorth-product-certification`, honesty docs checks, or i18n
gates. It is a focused consolidation of the trust-loop unit + smoke path.

Existing cert scripts (including `qa:zavorth-product-certification`) are
unchanged and remain the release authority for product readiness.

## Release-Blocking Recommendation

Before cutting a release candidate, run at least:

1. `npm run qa:zavorth-golden-path` — hermetic trust loop
2. Honesty / readiness checks (e.g. product honesty docs and readiness honesty suites)
3. `npm run i18n:check` (or the repo’s current i18n gate)
4. `npm run qa:zavorth-product-certification` — full product certification

Treat golden path as a fast fail gate; treat product certification as the
release readiness authority.

## Suggested CI Job

Add a dedicated job that fails the PR when the golden path fails. Example
GitHub Actions snippet:

```yaml
# .github/workflows/golden-path.yml (suggested)
name: Golden path

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  golden-path:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - name: Hermetic Proof OS golden path
        run: npm run qa:zavorth-golden-path
        env:
          CI: '1'
          NO_COLOR: '1'
```

Optional: artifact-upload `.zavorth/golden-path-last.json` when present for
post-mortem of flaky runs (the file is only written if `.zavorth/` exists).

## Implementation Map

| Artifact | Role |
| --- | --- |
| `scripts/zavorth-golden-path.mjs` | Orchestrator (unit gate + smoke + report) |
| `scripts/zavorth-golden-path-smoke.ts` | In-process service smoke checks |
| `package.json` → `qa:zavorth-golden-path` / `zavorth:golden-path` | npm entrypoints |

## Notes

- English-only code and script output for maintainers.
- Hermetic: no live providers, channels, or external HTTP required.
- Failures print `[fail]` and exit non-zero so CI and local shells can gate.
