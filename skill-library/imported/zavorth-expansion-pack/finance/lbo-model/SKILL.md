---
name: lbo-model
description: Zavorth-native capability route for Lbo Model.
---

# Lbo Model

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Lbo Model.
- the task belongs to the finance capability area.
- nearby skills include excel-author, pptx-author, dcf-model, 3-statement-model.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: finance
- Permission: sandbox-required
- Risk: high
- Tags: finance, valuation, lbo, private-equity, excel, openpyxl, modeling, lbo-model, model, build, leveraged, buyout, models
