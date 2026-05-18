---
name: debugging-hermes-tui-commands
description: Zavorth-native capability route for Debugging Hermes Tui Commands.
---

# Debugging Hermes Tui Commands

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Debugging Hermes Tui Commands.
- the task belongs to the software-development capability area.
- nearby skills include python-debugpy, node-inspect-debugger, systematic-debugging.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: software-development
- Permission: sandbox-required
- Risk: high
- Tags: software-development, debugging, hermes-agent, tui, slash-commands, typescript, python, debugging-hermes-tui-commands, hermes, commands, debug
