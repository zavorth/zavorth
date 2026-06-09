---
name: Zavorth Subagent Development
description: Coordinate independent implementation tasks through registered Zavorth subagents and staged reviews.
license: Zavorth-Internal
risk: medium
requiredApproval: owner-approval
---

# Zavorth Subagent Development

Use this skill when a plan has independent implementation tracks that benefit from isolated agents, staged review, or parallel work.

## Rules

- Dispatch only registered Zavorth subagents or approved execution lanes.
- Give each subagent a narrow task, exact files or scope, expected output, and verification criteria.
- Keep one owner thread responsible for integration and final judgment.
- Review each result for spec compliance before quality review.
- Do not let subagents expand permissions, providers, folders, or tools by themselves.

## Workflow

1. Split the plan into independent tasks.
2. Assign one registered lane per task.
3. Collect implementation evidence and test output.
4. Run spec review.
5. Run quality and safety review.
6. Integrate only accepted changes.

## Output

- Task split and assigned lane.
- Required permissions.
- Review status.
- Integration decision and remaining risk.
