# Universal skill install

Install skills from **any** source (path, Git URL, zip, npm, registry) with a
governed pipeline: **preview → consent → apply → receipt**. Brand-agnostic:
no third-party product allowlists are required.

## Operator CLI

```bash
# Discover (local; add --remote for GitHub when online)
zavorth skill search "PR review"
zavorth skill discover "https://github.com/org/skill-pack"

# Preview (no disk write)
zavorth skill preview ./path/to/skill
zavorth skill preview https://github.com/org/repo

# Apply only with explicit consent
zavorth skill install ./path/to/skill --consent
zavorth skill install https://github.com/org/repo --only my-skill --consent

# Receipts + trust
zavorth skill receipt
zavorth skill trust
zavorth skill trust add domain github.com/my-org/
```

## Agent tools

With `ZAVORTH_TOOL_EXPOSURE_PROFILE=daily-ops` (recommended):

| Tool | Actions |
|------|---------|
| `zavorth_skill_marketplace` | `search` / `discover`, `preview`, `install` (+ `consent=true`), `receipt`, `trust`, `list` |
| `plugin_suggest` | Find plugins when a capability is missing |
| `zavorth_action` | Governed product operations |

Install flow for the model:

1. `action=preview source=<url-or-path>`
2. Show plan to user if needed
3. `action=install source=... consent=true`
4. `action=receipt` if needed

## Trust profiles

Env: `ZAVORTH_SKILL_TRUST_PROFILE=safe|daily|power` (default **daily**).

| Profile | Behavior |
|---------|----------|
| `safe` | Prefer local / owner-trusted / Zavorth-owned; reject unknown remotes |
| `daily` | Remote allowed after preview; first-seen domains need consent |
| `power` | Lower floors for operators; receipts still required |

Auto-consent is **evidence-based** (score + policy), never by competitor brand name.

## Skill ↔ executors

After install, declared tool names are bound:

- **direct** — name exists on the tool registry
- **aliased** — e.g. `sandbox_execution` → `run_sandbox_code`
- **gateway** — missing tools map to `zavorth_action` / `plugin_suggest`
- **unresolved** — documented; model must not invent phantoms

See install receipt `toolBinds` and the skill snapshot prompt (resolved names only).

## Related

- [Workers mesh](./workers-mesh.md)
- [Agent harness readiness](../agent-harness-readiness.md)
- [Plugin OS marketplace](../plugin-os-marketplace.md)
