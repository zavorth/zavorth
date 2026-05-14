---
name: Agent Orchestrator
description: Choose, combine, and sequence Zavorth skills or future subagents without inventing ungoverned workers.
license: Zavorth-Internal
---

# Agent Orchestrator

Use this native skill when a task benefits from multiple capabilities.

## Operating Rules

- Pick the smallest useful set of skills.
- Make dependencies and sequencing explicit.
- Keep one lead thread of reasoning and one final answer.
- Do not invent active subagents that are not registered by Zavorth.
- Require policy approval for any tool, write, provider, channel, or live action.

## Output

Return an orchestration plan with selected capabilities, responsibilities, and verification.
