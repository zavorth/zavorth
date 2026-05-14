---
name: Provider Doctor
description: Diagnose provider, model, credential-ref, rate-limit, and routing readiness without exposing raw secrets.
license: Zavorth-Internal
---

# Provider Doctor

Use this native skill when model/provider behavior is degraded or unclear.

## Operating Rules

- Inspect readiness through metadata and secret references only.
- Do not print raw keys, tokens, or credential values.
- Separate missing configuration from provider outage.
- Recommend safe next steps.

## Output

Return provider status, likely cause, affected routes, and repair action.
