# Retention gate (R1–R3)

Product retention evidence for beta dogfood. Recorded in `.zavorth/retention-log.json`.

## Criteria

| ID | Name | Meaning | How to record |
|----|------|---------|---------------|
| **R1** | `day0Install` | Operator completed install + day-0 dogfood session | `node scripts/retention-log.mjs --day0-install` |
| **R2** | `day1Return` | Operator returned on a **later calendar day** and reused the product | `node scripts/retention-log.mjs --day1-return` |
| **R3** | `completedMissionWithoutCreator` | At least one mission completed without creator hand-holding | `node scripts/retention-log.mjs --mission-solo` |

## Checks

```bash
npm run retention:check
node scripts/retention-log.mjs --check --soft
```

## Calendar rule for R2

R2 is **not** set on the same UTC calendar day as the first R1 event.
The script refuses `--day1-return` until a later day (unless `ZAVORTH_ALLOW_FAKE_DAY1=1`, which must not be used for product claims).

## Current honesty stance

- Day-0 sessions set **R1** and **R3** only.
- **R2 remains open** until a real next-day return.
- Do not treat soft-check pass as full retention product:ready for calendar R2.

## Product UX vs calendar R2 (no soft-lie)

**Product day-1 return UX exists and is checkable hermetically:**

| Piece | Role |
|-------|------|
| `DailyReturnContinuityService` | Model: last session, pending approvals, next action, `day1ReturnEligible` |
| Desktop `continuityStorage` | Local open clock + remembered session |
| Desktop `ContinuityBanner` | Welcome-back / continue / setup-provider on reopen |
| `npm run value:continuity -- --check` | Hermetic next-action + day-1 eligibility model |

That product model is **not** the same as launch residual **calendar R2** in `retention-log.json`.

| Layer | What it proves | How it passes |
|-------|----------------|---------------|
| Product continuity | Reopen UX and eligibility model work | `npm run value:continuity -- --check` + desktop continuity tests |
| Calendar R2 (`day1Return`) | Operator actually returned on a later UTC day | Real next-day: `node scripts/retention-log.mjs --day1-return` |

### How to pass calendar R2 without soft-lie

1. Record R1 on day 0 (`--day0-install`) after a real install/dogfood session.
2. Wait until a **later UTC calendar day** (script refuses same-day return).
3. Actually reopen the product and do useful work.
4. Record R2 with `node scripts/retention-log.mjs --day1-return`.
5. Never use `ZAVORTH_ALLOW_FAKE_DAY1=1` for product or launch claims.

If calendar R2 is still open, say: **product continuity UX is ready; calendar R2 is ops residual pending real day-1 return** — not “retention complete.”
