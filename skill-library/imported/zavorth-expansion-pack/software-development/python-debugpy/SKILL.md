---
name: python-debugpy
description: Zavorth-native capability route for Python Debugpy.
---

# Python Debugpy

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Python Debugpy.
- the task belongs to the software-development capability area.
- nearby skills include systematic-debugging, node-inspect-debugger, debugging-hermes-tui-commands.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: software-development
- Permission: approval-required
- Risk: medium
- Tags: software-development, debugging, python, pdb, debugpy, breakpoints, dap, post-mortem, python-debugpy, debug, repl
