---
name: ocr-and-documents
description: Zavorth-native capability route for Ocr And Documents.
---

# Ocr And Documents

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Ocr And Documents.
- the task belongs to the productivity capability area.
- nearby skills include powerpoint.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: productivity
- Permission: approval-required
- Risk: medium
- Tags: productivity, pdf, documents, research, arxiv, text-extraction, ocr, ocr-and-documents, and, extract, text, from, pdfs
