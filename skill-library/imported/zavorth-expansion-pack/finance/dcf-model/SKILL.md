---
name: dcf-model
description: Zavorth-native capability route for Dcf Model.
---

# Dcf Model

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Dcf Model.
- the task belongs to the finance capability area.
- nearby skills include excel-author, pptx-author, comps-analysis, lbo-model, 3-statement-model.

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
- Tags: finance, valuation, dcf, excel, openpyxl, modeling, investment-banking, dcf-model, model, build, institutional-quality, models
