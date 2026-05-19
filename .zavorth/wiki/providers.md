---
title: Providers
status: active
owner: zavorth
updated_at: 2026-05-18
confidence: medium
tags:
  - providers
  - models
  - readiness
sources:
  - docs/provider-mesh.md
  - src/services/providers/catalog
---

## Purpose

Track provider and model routing facts in a safe, non-secret form.

## Current Facts

- Provider catalog coverage is not the same as live configured readiness.
- Live proof must be sanitized and must not serialize secrets.
- Media, image, video, TTS, speech, and chat providers may need different
  adapter contracts.

## Decisions

- Keep missing credentials as `not configured` instead of degraded runtime
  failures.
- Prefer explicit user provider selection with safe fallbacks.

## Open Questions

- Which media provider adapters should receive full live certification first.

## Source Links

- `docs/provider-mesh.md`
- `docs/36-runtime-readiness.md`

## Maintenance Notes

- Update after provider catalog, live proof, or adapter changes.
