---
name: github-pr-workflow
description: Zavorth-native capability route for Github Pr Workflow.
---

# Github Pr Workflow

ZAVORTH_EXPANSION_GENERATED: true

This skill is a Zavorth-native capability stub. It gives the agent routing context and operating guardrails, but it does not copy or execute upstream skill scripts.

## When To Use

- the user asks for Github Pr Workflow.
- the task belongs to the github capability area.
- nearby skills include github-auth, github-code-review.

## Operating Contract

- Route through Natural First Runtime before any tool use.
- Treat external services, account changes, writes, payments, messaging, code execution and system changes as approval-required.
- Use typed Zavorth connectors when available; otherwise produce a preview and ask for operator approval.
- Do not run upstream scripts directly from this skill.
- Record receipts for actions, denials and fallbacks.

## Capability Metadata

- Category: github
- Permission: sandbox-required
- Risk: high
- Tags: github, pull-requests, ci-cd, git, automation, merge, github-pr-workflow, workflow, lifecycle, branch, commit, open
