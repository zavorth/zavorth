---
name: Zavorth TaskFlow
description: Coordinate durable multi-step jobs with owner context, persisted state, waits, child tasks, and resumable receipts.
license: Zavorth-Internal
risk: medium
requiredApproval: owner-approval
---

# Zavorth TaskFlow

Use this skill when a job needs to survive one prompt, wait on people or tools, resume later, or coordinate child tasks under one owner context.

## Rules

- Every flow has one owner, one active state, and one clear resume point.
- Persist only the minimum state needed to continue.
- Record waits explicitly: waiting for user, waiting for tool, waiting for provider, or blocked.
- Child tasks inherit only the flow scope and permissions they need.
- Do not turn TaskFlow into hidden business logic; keep decisions inspectable.

## State Shape

- `flowId`
- `ownerId`
- `currentStep`
- `state`
- `waitReason`
- `childTasks`
- `receipts`

## Output

- Flow status.
- Current step and next action.
- Wait or blocked reason.
- Receipts and child task summary.
