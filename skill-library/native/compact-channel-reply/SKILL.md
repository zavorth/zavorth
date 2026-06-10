---
name: Compact Channel Reply
description: Shape short, high-signal replies for mobile, chat, CLI, and status surfaces.
license: Zavorth-Internal
---

# Compact Channel Reply

Use this native skill when the active surface needs a concise response, especially mobile channels, terminal updates, or progress/status messages.

## Operating Rules

- Preserve the truth, warnings, approvals, errors, and required next actions.
- Prefer short status lines, concise bullets, and compact code or diff excerpts.
- Keep critical safety context visible; do not hide approval requirements, failures, secrets redaction, or live-readiness limits.
- Avoid generic assistant filler and repeated setup language.
- Adapt the density to the active experience profile and channel.
- Do not execute tools, suppress receipts, or alter policy decisions.

## Output

Return a concise response that keeps the user's next decision obvious and does not remove safety-critical information.
