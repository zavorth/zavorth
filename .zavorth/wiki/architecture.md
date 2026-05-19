---
title: Architecture
status: active
owner: zavorth
updated_at: 2026-05-18
confidence: medium
tags:
  - architecture
  - runtime
  - governance
sources:
  - docs/architecture.md
  - README.md
---

## Purpose

Capture stable architecture facts and decisions that the agent should reuse
across sessions.

## Current Facts

- Zavorth is a local-first governed agent runtime.
- Natural language enters the gateway before being classified into chat, memory,
  approval, tool, provider, review, swarm, or execution paths.
- Sensitive actions are routed through policy, preview, approval, and receipt.

## Decisions

- Keep identity, governance, memory, and approval logic Zavorth-native.
- Prefer explicit readiness and receipts over false live status.
- Treat external providers, channels, sandboxes, and agents as configurable
  capabilities.

## Open Questions

- Which runtime surfaces should receive Mnemos wiki context first.
- How much wiki context should be injected by default in lightweight replies.

## Source Links

- `docs/architecture.md`
- `docs/security.md`
- `README.md`

## Maintenance Notes

- Update when gateway contracts, approval boundaries, or runtime authority
  changes.
