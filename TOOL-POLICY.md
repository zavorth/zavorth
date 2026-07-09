# TOOL-POLICY.md - Tool Usage Policies

Fine-grained control over which tools require approval.

Calibrated for local development on Windows: low friction inside the workspace,
approval kept for shell, network, email, and other external effects.

## Policies

- [file.read] allow
- [file.write] allow | workspace only
- [shell.execute] ask
- [network.fetch] ask
- [email.send] ask
- [calendar.write] ask
- [subagent.delegate] allow
- [mcp.execute] ask

## Default Level

- **Default:** ask

## File boundary

What belongs here:
- tool permission levels (allow/ask/deny)
- conditions for each tool

What does not belong here:
- runtime security policy (config/runtime-permissions.json)
- behavioral rules (RULES.md)

## Maintenance rule

When the user adjusts tool permissions, update this file.
When new tools become available, add them here.
