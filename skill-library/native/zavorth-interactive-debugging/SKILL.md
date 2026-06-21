---
name: Runtime Debugger Hook
description: Attach debug hooks, interpret stack traces, and test patches for local runtimes.
license: Zavorth-Internal
---

# Runtime Debugger Hook

Use this native skill when:
- The task requires operations in the 'devops' domain.
- Performing actions matching: attach debug hooks, interpret stack traces, and test patches for local runtimes.

## Operating Rules

- Attach to debug sockets or parse runtime crash reports safely.
- Do not expose local process environment variables.
- Suggest minimal, clean code fixes based on stack traces.

## Output

Return stack traces, captured memory snapshots, and proposed bug fixes.
