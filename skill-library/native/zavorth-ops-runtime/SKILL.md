---
name: Zavorth Ops Runtime
description: Diagnose runtime readiness, services, channels, providers, logs, and operator health.
license: Zavorth-Internal
risk: medium
requiredApproval: tool-preview
---

# Zavorth Ops Runtime

Use this skill for operational checks and recovery.

## Rules

- Prefer readiness snapshots before direct action.
- Distinguish ready, attention, blocked, and not configured.
- Do not restart or mutate services without approval.
- Emit receipts for recovery and keepalive decisions.

## Output

Return the current status, cause, safe fix, and verification command.
