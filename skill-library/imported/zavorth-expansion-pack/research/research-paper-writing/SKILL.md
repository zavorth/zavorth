---
name: research-paper-writing
description: Zavorth-native capability route for Research Paper Writing.
---

# Research Paper Writing

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Research Paper Writing.
- the task belongs to the research capability area.
- nearby skills include arxiv, ml-paper-writing, subagent-driven-development, plan.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: research
- Permission: approval-required
- Risk: medium
- Tags: research, paper-writing, experiments, ml, ai, neurips, icml, iclr, acl, aaai, colm, latex, citations, statistical-analysis, research-paper-writing, paper
