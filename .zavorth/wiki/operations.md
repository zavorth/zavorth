---
title: Operations
status: active
owner: zavorth
updated_at: 2026-05-18
confidence: medium
tags:
  - operations
  - readiness
  - approvals
sources:
  - docs/operations.md
  - docs/runtime-readiness.md
---

## Purpose

Capture daily operator facts and safe runtime procedures.

## Current Facts

- Daily readiness is checked through operator and ready-to-go commands.
- Approval UX supports natural language, dashboard actions, and remote channels
  while keeping policy boundaries.
- Break-glass style permissions remain explicit, scoped, auditable, and
  revocable.

## Decisions

- Avoid noisy status notifications; prefer summarized actionable updates.
- Keep remote use dependent on readiness, provider status, dashboard health, and
  approval health.

## Open Questions

- Which memory health signal should appear first in the dashboard.

## Source Links

- `docs/operations.md`
- `docs/runtime-readiness.md`
- `docs/zavorth-cli.md`

## Maintenance Notes

- Update when operator commands, readiness gates, or remote approval flows
  change.
