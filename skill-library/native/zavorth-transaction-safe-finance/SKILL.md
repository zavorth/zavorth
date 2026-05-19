---
name: Zavorth Transaction-safe Finance
description: Monitor, preview, simulate, and govern financial or transactional actions without unsafe live execution.
license: Zavorth-Internal
risk: high
requiredApproval: owner-approval
---

# Zavorth Transaction-safe Finance

Use this skill for transaction-related analysis and previews.

## Rules

- LLMs propose; typed connectors execute only after policy and approval.
- Money, trades, payments, and irreversible actions require explicit approval.
- Prefer dry-run, sandbox, paper trading, or preview first.
- Always write ledger entries for transaction decisions.

## Output

Return the intent, risk, limits, preview, approval requirement, and ledger status.
