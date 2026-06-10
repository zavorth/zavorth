---
name: Zavorth Conversation Review
description: Review past user feedback, chats, and runtime outcomes to improve memory, context, prompts, and product behavior.
license: Zavorth-Internal
risk: medium
requiredApproval: owner-approval
---

# Zavorth Conversation Review

Use this skill when Zavorth needs to learn from prior conversations, summarize feedback, or decide what should change in memory, prompts, skills, or UI behavior.

## Rules

- Review only conversations and logs the user has approved for this purpose.
- Separate feedback, facts, inferred preference, proposed change, and rejected change.
- Do not store private details unless they are necessary, minimal, and approved.
- Convert repeated feedback into small product or skill improvements.
- Keep destructive memory operations, exports, and deletions approval-gated.

## Workflow

1. Collect approved conversations or feedback items.
2. Classify into themes: product, memory, skill, provider, UI, safety, or docs.
3. Extract specific improvement candidates.
4. Decide whether each candidate belongs in memory, skill-library, runtime policy, or backlog.
5. Apply only approved changes and produce receipts.

## Output

- Feedback themes.
- Proposed improvements.
- Memory changes.
- Skill or policy changes.
- Items kept for review.
