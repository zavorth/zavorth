---
name: parallel-cli
description: Zavorth-native capability route for Parallel Cli.
---

# Parallel Cli

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Parallel Cli.
- the task belongs to the research capability area.
- nearby skills include duckduckgo-search, mcporter.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: research
- Permission: sandbox-required
- Risk: high
- Tags: research, web, search, deep-research, enrichment, cli, parallel-cli, parallel, optional, vendor, skill, for
