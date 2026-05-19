# Zavorth Memory Wiki Schema

This schema defines how `.zavorth/wiki` pages must be written and maintained.

## Purpose

The wiki is the human-readable semantic memory layer for the workspace. It stores
consolidated facts, decisions, constraints, and lessons. It is not a raw log
dump and it is not a secret store.

## Required Frontmatter

Every wiki page must start with:

```yaml
---
title: Short page title
status: draft | active | needs-review | deprecated
owner: zavorth
updated_at: YYYY-MM-DD
confidence: low | medium | high
tags:
  - tag
sources:
  - source-id-or-path
---
```

## Required Sections

Each page must contain:

- `## Purpose`
- `## Current Facts`
- `## Decisions`
- `## Open Questions`
- `## Source Links`
- `## Maintenance Notes`

## Rules

- Never store raw credentials, tokens, cookies, private keys, or `.env` values.
- Link facts to sources whenever possible.
- Prefer short, stable facts over long pasted logs.
- Mark uncertainty explicitly with `confidence: low` or an open question.
- Do not delete a still-true decision just because a newer source is ingested.
- Move obsolete facts to `Open Questions` or mark the page `needs-review`.
- Raw sources belong in `.zavorth/raw`; synthesized knowledge belongs in `.zavorth/wiki`.
- Broad writes or critical architecture rewrites require explicit approval.

## Page Lifecycle

```text
draft -> active -> needs-review -> active/deprecated
```

The lint loop may mark a page `needs-review`, but it must not silently resolve
critical contradictions without operator approval.
