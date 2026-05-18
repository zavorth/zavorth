---
name: gitnexus-explorer
description: Zavorth-native capability route for Gitnexus Explorer.
---

# Gitnexus Explorer

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Gitnexus Explorer.
- the task belongs to the research capability area.
- nearby skills include native-mcp, codebase-inspection.

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
- Tags: research, gitnexus, code-intelligence, knowledge-graph, visualization, gitnexus-explorer, explorer, index, codebase, with, and
