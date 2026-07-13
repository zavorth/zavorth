---
name: registry-ops-fixture
description: Canonical signed fixture for skill-registry ops CI and UI dry-runs
version: 1.0.0
---

# Registry ops fixture

Local-only skill package used by:

- CI skill-registry-sign workflow (index export + publish-plan)
- Desktop / Control Registry Ops panels
- `npm run skill-registry:ops` smoke (alongside temp fixtures)

This skill is intentionally minimal. It does not perform network calls.

## Tools

- `read_file` — declare only; no custom runtime side effects
