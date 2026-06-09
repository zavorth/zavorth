---
name: Zavorth Model Routing
description: Route requests across connected providers, selected models, and effort levels without treating UI labels as decoration.
license: Zavorth-Internal
risk: medium
requiredApproval: tool-preview
---

# Zavorth Model Routing

Use this skill when selecting a connected model, changing provider readiness, or mapping effort levels such as low, medium, high, and highest to real runtime behavior.

## Rules

- Only present models that are connected, configured, and allowed by the active profile.
- Treat effort as a real runtime knob, not a label. Map it to the Zavorth reasoning or execution policy before sending a request.
- Prefer local or user-configured providers when the session is local-first.
- If a requested model is unavailable, explain whether the cause is missing credentials, provider outage, policy, or not installed.
- Never expose raw provider keys, tokens, or secret values.

## Effort Mapping

- Low: fast, cheap, shallow planning.
- Medium: balanced default for ordinary work.
- High: deeper planning, broader verification, more careful tool use.
- Highest: only for complex, risky, long-running, or owner-requested work.

## Output

- Selected provider and model.
- Effort level and runtime mapping.
- Fallback or blocked reason.
- Provider setup action if the user needs to add more providers.
