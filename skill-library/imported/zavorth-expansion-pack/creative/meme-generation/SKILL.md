---
name: meme-generation
description: Zavorth-native capability route for Meme Generation.
---

# Meme Generation

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Meme Generation.
- the task belongs to the creative capability area.
- nearby skills include ascii-art, generative-widgets.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: creative
- Permission: approval-required
- Risk: medium
- Tags: creative, memes, humor, images, meme-generation, meme, generation, generate, real, picking
