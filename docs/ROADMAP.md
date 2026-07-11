# Roadmap (product-facing)

High-level direction. Not a commit diary.

## Value program (intelligence, habit, wow, audiences)

Execution waves that close the gap beyond trust/governance-only differentiation:

→ **[WAVES-VALUE-INTELLIGENCE-HABIT.md](./product/WAVES-VALUE-INTELLIGENCE-HABIT.md)**

Order: V0 baseline → V1 smartness scoreboard ∥ V2 daily loop → V3 first delight → V4 audiences → V5 memory integrity → V6 day-1 continuity → V7 narrative rebalance.

**Status:** Value Waves **V0–V7 foundation DONE** / **value-ready (local)**. Residual work is ops and live cells, not “start V1–V3.”

Any agent continuing this work should open that file first (status table + residual next).

**Done + residual log (read this to continue):**

→ **[SESSION-STATUS-VALUE-AND-DYNAMIC.md](./product/SESSION-STATUS-VALUE-AND-DYNAMIC.md)**

**How to test everything value-related:**

```bash
npm run value:test-all
npm run value:test-all -- --live
```

See [product/HOW-TO-TEST-VALUE.md](./product/HOW-TO-TEST-VALUE.md).

**Session handoff (done + residual):** [product/SESSION-STATUS-HANDOFF.md](./product/SESSION-STATUS-HANDOFF.md)

## Value-ready (local) vs Launch-ready (ops)

| Bar | Meaning | Evidence |
|-----|---------|----------|
| **Value-ready (local)** | Product is useful daily on a developer/operator machine: measured agent quality, short happy path, honest wow, audiences wired, memory integrity, day-1 continuity hooks, narrative rebalanced — **without** claiming public launch. | Waves V0–V7 foundation; hermetic gates (`value:test-all`, smartness, daily PE, golden path); honesty intact (catalog ≠ Live). |
| **Launch-ready (ops)** | Public/store announce bar: signed installers, live credentialed provider/channel cells, calendar day-1 retention (R2), residual release ops. | [launch-readiness.md](./product/launch-readiness.md) residual checklist. |

Do **not** say “launched” or “fully shipped” from local hermetic green alone.

## Now (value-ready local)

- Value Waves V0–V7 foundation complete (local)
- Hermetic dogfood matrix + day-0 session
- Security CI + installer readiness (npm package mode)
- Host + AI gateway local ops when operator starts them
- Desktop first-run audience (personal / developer / business) + profile manifests

## Next (residual) — unified closeout V8–V12

Executable program: **[WAVES-UNIFIED-CLOSEOUT.md](./product/WAVES-UNIFIED-CLOSEOUT.md)**

| Wave | Focus | Status |
|------|--------|--------|
| **V8** | Live multi-step with **user-selected** provider + measured TTFU | **DONE** — credentialed evidence + 15.4s TTFU |
| **V9** | Desktop/Control primary + secondary + channel pickers; no legacy Auto/Gemini copy; i18n/device locale | **DONE** |
| **V10** | Autopilot + catalog neutral defaults (no silent gemini-cli) | **DONE** |
| **V11** | Reopen ritual, non-dev jargon, killer demos executed, Code daily loop | READY |
| **V12** | Launch ops: calendar day-1, signing, live cells, public announce checklist | residual |

Order: `(V8 ∥ V9 ∥ V10) → V11 → V12`. Next product wave: **V11**.

## Later

- Store listings and broader channel packaging
- Optional experience `privacy` persona (or keep mapped to personal + strict)

See [launch-readiness.md](./product/launch-readiness.md) for residual honesty.
