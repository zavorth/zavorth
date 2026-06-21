---
name: Safe Process Launcher
description: Safely execute external CLI tools or desktop applications inside path-safe containment.
license: Zavorth-Internal
---

# Safe Process Launcher

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: safely execute external cli tools or desktop applications inside path-safe containment.

## Operating Rules

- Require user confirmation and policy broker approvals before spawning any host process.
- Execute inside path-safe containment to prevent privilege escalation.
- Filter output streams for raw keys or credential leaks.

## Output

Return process execution states, system output streams, and status logs.
