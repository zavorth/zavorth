---
name: hermes-atropos-environments
description: Zavorth-native capability route for Hermes Atropos Environments.
---

# Hermes Atropos Environments

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Hermes Atropos Environments.
- the task belongs to the mlops capability area.
- nearby skills include axolotl, fine-tuning-with-trl, lm-evaluation-harness.

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
- Tags: mlops, atropos, rl, environments, training, reinforcement-learning, reward-functions, hermes-atropos-environments, hermes, build, test, and, debug
