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
