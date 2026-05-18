---
name: excel-author
description: Zavorth-native capability route for Excel Author.
---

# Excel Author

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Excel Author.
- the task belongs to the finance capability area.
- nearby skills include pptx-author, dcf-model, comps-analysis, lbo-model, 3-statement-model.

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
- Tags: finance, excel, openpyxl, spreadsheet, modeling, excel-author, author, build, auditable, workbooks, headless
