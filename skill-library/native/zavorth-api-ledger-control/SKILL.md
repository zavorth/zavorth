---
name: API Usage & Token Ledger
description: Track model tokens and financial costs against local usage limits.
license: Zavorth-Internal
---

# API Usage & Token Ledger

Use this native skill when:
- The task requires operations in the 'security' domain.
- Performing actions matching: track model tokens and financial costs against local usage limits.

## Operating Rules

- Calculate costs per query using updated pricing metadata.
- Update local memory budgets and check limits.
- Raise alerts if budget limits are crossed.

## Output

Return cumulative query costs, remaining token limits, and usage budget warnings.
