---
name: page-agent
description: Zavorth-native capability route for Page Agent.
---

# Page Agent

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Page Agent.
- the task belongs to the web-development capability area.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: web-development
- Permission: sandbox-required
- Risk: high
- Tags: web-development, web, javascript, agent, browser, gui, alibaba, embed, copilot, saas, page-agent, page, into, your
