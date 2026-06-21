---
title: "Memory"
description: "Zavorth can remember decisions, project context, and your preferences — and recall them weeks later."
---

## The problem with AI memory

Most AI tools forget everything when you close the chat. Every session starts from scratch. You re-explain the project, re-state your preferences, and wonder why the AI keeps making the same mistakes it made last week.

Zavorth keeps memory across sessions. Not as a hidden blob that might leak — but as readable files you can inspect, edit, and manage.

## How memory is organized

Zavorth uses four memory tiers, each with a different purpose:

| Tier | What it stores | Example |
|---|---|---|
| **Working** | Active session context | What you asked in the last 20 messages |
| **Episodic** | Past runs, decisions, receipts | "You approved a file rewrite on May 12" |
| **Semantic** | Project knowledge, architecture decisions | "This repo uses Postgres, not SQLite" |
| **Procedural** | Your habits and preferences | "Always use tabs, not spaces" |

Working memory is automatic. The other tiers are populated when Zavorth learns something worth keeping — and always with your knowledge.

## Querying memory

Ask naturally:

```
What did we decide about the database schema?
How did we fix that timeout problem last week?
What's the architecture of this project?
```

Or query directly:

```bash
zavorth memory query "database schema"
zavorth memory query "timeout fix"
```

Memory search uses full-text search across all stored sessions — fast, local, no cloud.

## What gets stored and when

Zavorth does not silently add things to memory. When it learns something worth keeping, it shows you a suggestion first:

```
I noticed you prefer short answers by default.
Store this as a preference? [yes / no / edit]
```

You approve it, edit it, or dismiss it. Memory is earned, not assumed.

## The wiki

Semantic memory lives in a local wiki at `.zavorth/wiki/`. These are plain Markdown files — one per topic, readable and editable. You can open them in any text editor, search them with grep, or version-control them with git.

The wiki is the source of truth. Zavorth also maintains an SQLite index for fast search, but the Markdown files are what actually matter.

## Managing memory

```bash
zavorth memory query "any topic"   # search memory
zavorth memory ingest               # index new documents you added
zavorth memory lint                 # check for stale or contradictory entries
```

From the ZavorthControl dashboard, you can browse memory, promote or demote entries, and see which memories are recent vs. old.

## What memory never stores

- Raw API keys or secrets
- Passwords or tokens
- Private context from one conversation that should not appear in another

Sensitive values are referenced by name, never stored in full.

## Related

- [Approvals](/docs/product/concepts/approvals)
- [Skills](/docs/product/skills)
- [ZavorthControl](/docs/product/interfaces/zavorthcontrol)
