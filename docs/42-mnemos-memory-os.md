# Mnemos Memory OS

Mnemos is Zavorth's governed local memory layer. It keeps useful context across
sessions without turning memory into a hidden black box.

## What It Does

- Maintains working, episodic, semantic and procedural memory layers.
- Uses bounded context compaction to reduce token waste.
- Stores synthesized project knowledge in the `.zavorth/wiki` workspace wiki.
- Supports local ingest, query and lint commands for memory hygiene.
- Preserves approval, security and receipt boundaries.

## Memory Tiers

| Tier | Purpose |
| --- | --- |
| Working | Active session context and recent turns. |
| Episodic | Receipts, run summaries, timelines and failures. |
| Semantic | Project facts, architecture decisions and workspace wiki pages. |
| Procedural | Operator preferences and governed habits. |

## Core Commands

```bash
npm run mnemos:ingest
npm run mnemos:query -- "provider readiness"
npm run mnemos:lint
npm run mnemos:certify
npm run mnemos:certify:check
```

## Safety Model

- No raw secrets are stored in wiki pages.
- Ingest is preview-first when it may write durable memory.
- Query uses local knowledge sources and does not grant tool authority.
- Procedural memory captures preferences, not credentials.
- Handoff envelopes are structured summaries, not permission grants.

## Operator Guidance

Use Mnemos when you want Zavorth to answer questions like:

- "What did we decide about providers?"
- "How did we solve that permission problem?"
- "Summarize the architecture docs I gave you."
- "Which project facts look stale or contradictory?"

If a memory action would broaden scope or persist new knowledge, Zavorth should
show a preview and require the appropriate approval.

## Certification

The Mnemos certification command verifies this memory surface with local checks
only. In other words: local checks only. It does not call providers, does not
perform network access, and does not mutate durable memory while certifying
readiness.
