---
name: blackbox
description: Zavorth-native capability route for Blackbox.
---

# Blackbox

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Blackbox.
- the task belongs to the autonomous-ai-agents capability area.
- nearby skills include claude-code, codex, hermes-agent.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: autonomous-ai-agents
- Permission: sandbox-required
- Risk: high
- Tags: autonomous-ai-agents, coding-agent, blackbox, multi-agent, judge, multi-model, delegate, coding, tasks, cli, agent
