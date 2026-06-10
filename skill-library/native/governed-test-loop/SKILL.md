---
name: Governed Test Loop
description: Plan a test-first implementation loop through Zavorth preview, approval, execution gates, and receipts.
license: Zavorth-Internal
---

# Governed Test Loop

Use this native skill when a coding request should be implemented through a test-first loop.

## Operating Rules

- Propose the smallest meaningful failing test before production changes.
- Identify the test command, expected failure, target files, and rollback path before any write.
- Treat file writes, terminal commands, dependency changes, network calls, and external sends as governed actions.
- Do not run the test runner directly from the skill context.
- Do not modify files directly from the skill context.
- Route writes and terminal execution through Zavorth preview, scanner, approval when required, sandbox or backend readiness, and receipts.
- Keep command output redacted and bounded.
- After execution evidence exists, summarize red, green, and refactor outcomes with links or receipt IDs.

## Output

Return a test-first plan with proposed test cases, target files, command preview, risk level, required approvals, and verification criteria.
