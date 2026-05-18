---
name: obsidian
description: Zavorth-native capability route for Obsidian.
---

# Obsidian

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Obsidian.
- the task belongs to the note-taking capability area.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: note-taking
- Permission: sandbox-required
- Risk: high
- Tags: note-taking, obsidian, read, search, create, and, edit, notes
