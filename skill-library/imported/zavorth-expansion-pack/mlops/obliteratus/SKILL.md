---
name: obliteratus
description: Zavorth-native capability route for Obliteratus.
---

# Obliteratus

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Obliteratus.
- the task belongs to the mlops capability area.
- nearby skills include vllm, gguf, huggingface-tokenizers.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: mlops
- Permission: sandbox-required
- Risk: high
- Tags: mlops, abliteration, uncensoring, refusal-removal, llm, weight-projection, svd, mechanistic-interpretability, huggingface, model-surgery, obliteratus, abliterate, refusals, diff-in-means
