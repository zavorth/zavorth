---
title: Memory
status: active
owner: zavorth
updated_at: 2026-05-18
confidence: high
tags:
  - mnemos
  - memory
  - compaction
sources:
  - docs/42-mnemos-memory-os.md
  - src/contracts/ZavorthMnemosMemoryOsContract.ts
---

## Purpose

Define the semantic memory baseline for Mnemos Memory OS.

## Current Facts

- Mnemos Memory OS uses four layers: working, episodic, semantic, and procedural.
- Working memory is volatile prompt/session context.
- Episodic memory is receipt-backed run history.
- Semantic memory lives in `.zavorth/wiki`.
- Procedural memory stores governed habits and preferences, not credentials.
- Context compaction is separate from durable memory persistence.

## Decisions

- Microcompaction clears stale bulky tool output without calling an LLM.
- Anchored compaction preserves recent turns and writes a structured session
  summary.
- Handoff envelopes are preview-only until explicitly persisted or injected.

## Open Questions

- What exact wiki pages should be updated first by the ingest loop.
- How should contradiction severity be scored by the lint loop.

## Source Links

- `docs/42-mnemos-memory-os.md`
- `src/services/ContextCompactionService.ts`
- `src/services/ZavorthHandoffEnvelopeService.ts`

## Maintenance Notes

- Update after phases 4, 5, 6, and 7 add ingest, query, lint, and procedural
  memory.
