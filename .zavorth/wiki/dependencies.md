---
title: Dependencies
status: active
owner: zavorth
updated_at: 2026-05-18
confidence: medium
tags:
  - dependencies
  - providers
  - runtime
sources:
  - package.json
---

## Purpose

Track stable dependency and provider facts that matter to runtime memory.

## Current Facts

- The project is TypeScript and Node-based.
- Provider SDKs, MCP, browser automation, Telegram, Discord, SQLite, and document
  extraction libraries are represented in the dependency graph.
- Runtime checks should distinguish cataloged capabilities from configured live
  capabilities.

## Decisions

- Do not mark a provider, media route, or connector as live without configured
  credentials and proof.
- Keep secret values out of wiki pages, logs, prompts, receipts, and screenshots.

## Open Questions

- Which long-tail provider adapters should be promoted from catalog-only to
  executable first.

## Source Links

- `package.json`
- `docs/provider-mesh.md`

## Maintenance Notes

- Update after major dependency upgrades, provider activation changes, or
  security audit changes.
