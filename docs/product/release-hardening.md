# Release Hardening (P15)

Ship confidence for Zavorth Proof OS and the wider monorepo: **feature preservation**, **public identity clean**, and **gates documented + partially automated**.

This package does **not** force full product certification (that remains `qa:zavorth-product-certification`). It is a focused pre-ship gate.

## Policy

- **Zero intentional removals** of product features (chat, approvals, receipts, absorb, import, mnemos, channels honesty, certification matrix, demo, desktop panels).
- Public identity surfaces stay Zavorth-native (`identity:public`).
- Historical phase plans stay under `docs/archive/` only — not as live public stubs.
- Golden path proves the hermetic Proof OS trust loop; full product certification is still required before a formal release.

## Checklist (master plan §15)

| # | Check | How |
| --- | --- | --- |
| 1 | i18n completeness (en-US + pt-BR product namespaces) | `npm run i18n:check` |
| 2 | Golden path (Proof OS trust loop) | `npm run qa:zavorth-golden-path` |
| 3 | Public identity clean | `npm run identity:public` |
| 4 | Surface syntax / packaging sanity | `npm run surfaces:check` |
| 5 | Governance docs present | `SECURITY.md`, `CONTRIBUTING.md` |
| 6 | Archive + golden-path docs present | `docs/archive/README.md`, `docs/product/golden-path.md` |
| 7 | No public phase-plan stubs | e.g. `docs/CLI-VISUAL-OVERHAUL-PLAN.md` must not exist outside archive |
| 8 | Proof OS modules present | ledger, approval presentation, risk budget, change preview, memory privacy, honesty, golden path script |
| 9 | Feature preservation inventory | chat, approvals, receipts, absorb, import, mnemos, channels honesty, cert matrix, demo, desktop panels |

## Commands

Full gate (includes golden path — may take a few minutes):

```bash
npm run qa:zavorth-release-hardening
```

Alias:

```bash
npm run zavorth:release-hardening
```

Local quick mode (skips golden path with a **warn**, not a fail unless strict):

```bash
# Windows PowerShell
$env:ZAVORTH_RELEASE_SKIP_GOLDEN=1; npm run zavorth:release-hardening

# POSIX
ZAVORTH_RELEASE_SKIP_GOLDEN=1 npm run zavorth:release-hardening
```

Strict mode treats a skipped golden path as a **failure**:

```bash
ZAVORTH_RELEASE_STRICT=1 ZAVORTH_RELEASE_SKIP_GOLDEN=1 npm run zavorth:release-hardening
# → fails (skip + strict)
```

Individual gates:

```bash
npm run i18n:check
npm run qa:zavorth-golden-path
npm run identity:public
npm run surfaces:check
```

On success the runner best-effort writes `.zavorth/release-hardening-last.json`.

## Feature preservation table

| Feature | Intent | Preservation signal |
| --- | --- | --- |
| **Chat** | Terminal / product chat remains first-class | CLI tree + CLI product docs |
| **Approvals** | Request → scope → lease → decision → receipt | `ApprovalPresentationService` + approvals docs |
| **Receipts / proof** | Auditable proof ledger | `ProofLedgerService` + `zavorth proof` CLI |
| **Absorb** | Skills/plugins/MCP under quarantine + risk report | Absorb risk report + capability absorption scripts |
| **Import** | Workspace / migration profiles | Migration product docs + absorption tooling |
| **Mnemos** | Memory companion service | `apps/mnemos` |
| **Channels honesty** | Catalog ≠ live | `ReadinessHonesty` + honesty readiness docs |
| **Cert matrix** | Product certification gate still available | `zavorth-product-certification-check.mjs` |
| **Demo** | Product demo entrypoints | `zavorth-product-demo.ts` |
| **Desktop panels** | Desktop cockpit surfaces | `apps/zavorth-desktop` |

**Note: zero intentional removals.** Release hardening only *verifies* these surfaces still exist. It does not delete, retire, or feature-flag them off.

## Proof OS modules (static inventory)

| Module | Path |
| --- | --- |
| Proof ledger | `src/services/proof/ProofLedgerService.ts` |
| Approval presentation | `src/services/approval/ApprovalPresentationService.ts` |
| Risk budget | `src/services/risk/RiskBudgetService.ts` |
| Change preview | `src/services/preview/ChangePreviewPresenter.ts` |
| Memory privacy | `src/services/memory/MemoryPrivacyService.ts` |
| Readiness honesty | `src/services/honesty/ReadinessHonesty.ts` |
| Golden path runner | `scripts/zavorth-golden-path.mjs` |

## Relationship to other gates

| Gate | Role |
| --- | --- |
| **Release hardening** (`qa:zavorth-release-hardening`) | Pre-ship confidence: i18n, identity, surfaces, docs hygiene, feature inventory, optional/full golden path |
| **Golden path** (`qa:zavorth-golden-path`) | Hermetic Proof OS unit + smoke trust loop |
| **Product certification** (`qa:zavorth-product-certification`) | Full user-facing readiness (heavier; still required for formal release) |

## Related docs

- [Golden path](./golden-path.md)
- [Honesty readiness](./honesty-readiness.md)
- [Approvals](./concepts/approvals.md)
- [Memory privacy](./concepts/memory-privacy.md)
- [Migration / workspace import](./migration-workspace.md)
- [Docs archive](../archive/README.md)
