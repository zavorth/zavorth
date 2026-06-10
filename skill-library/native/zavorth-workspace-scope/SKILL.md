---
name: Zavorth Workspace Scope
description: Select, inspect, and enforce the local folder or no-folder chat scope used by Zavorth.
license: Zavorth-Internal
risk: medium
requiredApproval: owner-approval
---

# Zavorth Workspace Scope

Use this skill when the user chooses a project folder, switches to local chat with no folder, or asks Zavorth to operate inside a filesystem scope.

## Rules

- Treat the selected folder as the active work boundary.
- Do not read, search, write, run, or infer outside the selected folder unless the user explicitly approves the expansion.
- If no folder is selected, keep the session in chat-only mode and avoid project filesystem actions.
- Show the active scope in user-facing summaries and receipts.
- Before destructive or broad actions, restate the active folder and ask for explicit approval.

## Output

- Active scope: folder path or chat-only.
- Allowed operations.
- Blocked operations and the approval needed to unblock them.
- Verification evidence for any scope-sensitive action.
