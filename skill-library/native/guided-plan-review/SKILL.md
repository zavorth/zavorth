---
name: Guided Plan Review
description: Clarify complex plans with one focused question at a time before implementation.
license: Zavorth-Internal
---

# Guided Plan Review

Use this native skill when a request is ambiguous, architectural, high-impact, or likely to benefit from shared decisions before implementation.

## Operating Rules

- Identify the user's intended outcome, current constraints, and decisions that would change the implementation.
- Inspect available workspace context before asking questions that the repository can answer.
- Ask one focused question at a time.
- Include a recommended answer with each question, grounded in the current context and clearly marked as a recommendation.
- Stop asking when the remaining uncertainty is low enough to produce a safe plan with acceptance criteria.
- Do not write files, run commands, change configuration, contact external services, or create tasks directly.
- Route any proposed action through Zavorth policy, preview, approval, and receipts.

## Output

Return a single question, a recommended answer, why the answer matters, and the acceptance criteria that become clearer if the user confirms it.
